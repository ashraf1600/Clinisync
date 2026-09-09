import uuid
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
import hashlib
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.exc import IntegrityError
from app.appointments.models import Appointment
from app.doctors.models import Doctor
from app.users.models import User
from app.appointments.schemas import (
    AppointmentBookRequest, AppointmentRead, AppointmentRescheduleRequest,
    DoctorQueueItem, DoctorQueueResponse, QueuePauseRequest, QueuePauseResponse,
    QueueResumeResponse, AppointmentVerifyResponse
)
from app.core.exceptions import NotFoundException, ConflictException, SlotConflictException, BadRequestException, ForbiddenException
from app.notifications.models import Notification

# Global memory state for queue breaks
queue_pause_registry = {}

try:
    from zoneinfo import ZoneInfo
    _DHAKA_TZ = ZoneInfo("Asia/Dhaka")
except Exception:
    # Fallback for containers without tzdata: fixed UTC+6 (no DST in Bangladesh)
    _DHAKA_TZ = timezone(timedelta(hours=6))

class AppointmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _notify(
        self,
        user_id: uuid.UUID,
        ntype: str,
        title: str,
        body: str,
        appointment_id: uuid.UUID | None = None,
        metadata: dict | None = None,
    ) -> None:
        """Fail-safe in-app notification: must never break the main transaction."""
        try:
            self.db.add(
                Notification(
                    user_id=user_id,
                    appointment_id=appointment_id,
                    title=title,
                    body=body,
                    notification_type=ntype,
                    metadata_=metadata or {},
                )
            )
            await self.db.commit()
        except Exception:
            await self.db.rollback()

    def _dhaka_day_bounds_utc(self, target_date: date) -> tuple[datetime, datetime]:
        start_utc = datetime(
            target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=_DHAKA_TZ
        ).astimezone(timezone.utc)
        return start_utc, start_utc + timedelta(days=1)

    @staticmethod
    def _slot_lock_key(doctor_id: uuid.UUID, day: date) -> int:
        """Stable 63-bit key so every worker/process serializes the same doctor-day."""
        digest = hashlib.sha256(f"{doctor_id}:{day.isoformat()}".encode()).hexdigest()
        return int(digest[:15], 16)

    async def _acquire_slot_lock(self, doctor_id: uuid.UUID, day: date) -> None:
        """Serialize check-then-insert per doctor-day (Postgres advisory lock).

        The application overlap check races under concurrency; the GiST exclusion
        is the final backstop. This lock additionally guarantees unique daily
        token numbers. Non-Postgres backends silently skip it.
        """
        try:
            await self.db.execute(
                text("SELECT pg_advisory_xact_lock(:k)"), {"k": self._slot_lock_key(doctor_id, day)}
            )
        except Exception:
            pass

    async def _today_waiting(self, doctor_id: uuid.UUID) -> list:
        """Today's (Dhaka) pending/confirmed appointments, ordered by serial."""
        today = datetime.now(_DHAKA_TZ).date()
        start_utc, end_utc = self._dhaka_day_bounds_utc(today)
        res = await self.db.execute(
            select(Appointment).where(
                and_(
                    Appointment.doctor_id == doctor_id,
                    Appointment.status.in_(["pending", "confirmed"]),
                    Appointment.start_time >= start_utc,
                    Appointment.start_time < end_utc,
                )
            ).order_by(Appointment.token_number.asc())
        )
        return list(res.scalars().all())

    async def get_by_id(self, appointment_id: uuid.UUID) -> Appointment | None:
        result = await self.db.execute(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        return result.scalar_one_or_none()

    async def book(self, patient_id: uuid.UUID, data: AppointmentBookRequest, idempotency_key: Optional[str] = None) -> AppointmentRead:
        # 0. Idempotency Check
        if idempotency_key:
            existing_key_query = select(Appointment).where(Appointment.idempotency_key == idempotency_key)
            existing_key_res = await self.db.execute(existing_key_query)
            existing_key_appt = existing_key_res.scalar_one_or_none()
            if existing_key_appt:
                return AppointmentRead.model_validate(existing_key_appt)

        # 1. Verify doctor
        doc_res = await self.db.execute(select(Doctor).where(Doctor.id == data.doctor_id))
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundException(f"Doctor '{data.doctor_id}' not found")

        location = None
        if data.location_id:
            location = next((item for item in doctor.locations if item.id == data.location_id and item.is_active), None)
            if not location:
                raise NotFoundException("Selected doctor location not found or inactive")

        # 1b. Serialize per doctor-day so concurrent books can't both pass the check below
        start_day = data.start_time.date() if isinstance(data.start_time, datetime) else date.today()
        await self._acquire_slot_lock(data.doctor_id, start_day)

        # 2. Check for slot conflict (application layer + DB exclusion trap)
        conflict_query = select(Appointment).where(
            and_(
                Appointment.doctor_id == data.doctor_id,
                Appointment.status.in_(["pending", "confirmed", "completed"]),
                or_(
                    and_(Appointment.start_time <= data.start_time, Appointment.end_time > data.start_time),
                    and_(Appointment.start_time < data.end_time, Appointment.end_time >= data.end_time),
                    and_(Appointment.start_time >= data.start_time, Appointment.end_time <= data.end_time),
                )
            )
        )
        existing = await self.db.execute(conflict_query)
        if existing.scalar_one_or_none():
            raise SlotConflictException("The selected appointment slot has just been booked. Please select another slot.")

        # 3. Calculate daily sequential token number
        day_start = datetime(data.start_time.year, data.start_time.month, data.start_time.day, 0, 0, 0, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        
        token_query = select(func.max(Appointment.token_number)).where(
            and_(
                Appointment.doctor_id == data.doctor_id,
                Appointment.start_time >= day_start,
                Appointment.start_time < day_end,
            )
        )
        max_token_res = await self.db.execute(token_query)
        current_max = max_token_res.scalar_one_or_none()
        next_token = (current_max or 0) + 1

        # 4. Insert appointment
        appt = Appointment(
            patient_id=patient_id,
            doctor_id=data.doctor_id,
            location_id=data.location_id,
            token_number=next_token,
            chief_complaint=data.chief_complaint,
            visit_type=data.visit_type,
            start_time=data.start_time,
            end_time=data.end_time,
            status="confirmed",
            payment_status="pay_at_chamber",
            idempotency_key=idempotency_key,
        )
        self.db.add(appt)

        try:
            await self.db.commit()
            await self.db.refresh(appt)
        except IntegrityError as exc:
            await self.db.rollback()
            raise SlotConflictException("The selected appointment slot has just been booked. Please select another slot.")

        # 5. Add notification record for patient (fail-safe)
        try:
            doc_user_name = doctor.user.name if (doctor and doctor.user) else "Doctor"
            notif = Notification(
                user_id=patient_id,
                appointment_id=appt.id,
                title="Appointment Confirmed! 🎫",
                body=f"Serial #{next_token:02d} assigned with {doc_user_name} for {data.start_time.strftime('%b %d')}.",
                notification_type="booking_confirmed",
                metadata_={"tokenNumber": next_token, "doctorName": doc_user_name}
            )
            self.db.add(notif)
            await self.db.commit()
        except Exception:
            # Notification is non-blocking; the appointment is already safely secured
            await self.db.rollback()

        doc_name = doctor.user.name if (doctor and doctor.user) else "Doctor"
        doc_fee = float(doctor.consultation_fee) if doctor.consultation_fee else 1000.0
        fac_name = location.facility_name if location else (doctor.facility_name if doctor else "Popular Diagnostic Centre")
        room_name = location.chamber_room if location else (doctor.chamber_room if doctor else "Room #402, Level 4")
        branch_name = location.branch_area if location else None

        # Fetch patient user for name
        patient_res = await self.db.execute(select(User).where(User.id == patient_id))
        patient_user = patient_res.scalar_one_or_none()
        patient_name = patient_user.name if patient_user else None

        return AppointmentRead(
            id=appt.id,
            patient_id=appt.patient_id,
            patient_name=patient_name,
            doctor_id=appt.doctor_id,
            location_id=appt.location_id,
            doctor_name=doc_name,
            specialization=doctor.specialization,
            facility_name=fac_name,
            chamber_room=room_name,
            branch_area=branch_name,
            token_number=appt.token_number,
            start_time=appt.start_time,
            end_time=appt.end_time,
            status=appt.status,
            payment_status=appt.payment_status,
            fee=doc_fee,
            chief_complaint=appt.chief_complaint,
            created_at=appt.created_at
        )

    async def reschedule(self, appointment_id: uuid.UUID, patient_id: uuid.UUID, data: AppointmentRescheduleRequest) -> AppointmentRead:
        appt = await self.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        if appt.patient_id != patient_id:
            raise ConflictException("Only appointment owner can reschedule")
        if appt.status in ["cancelled", "completed"]:
            raise BadRequestException(f"Cannot reschedule appointment in status '{appt.status}'")

        # Serialize per doctor-day BEFORE checking (same race as booking)
        new_day = data.new_start_time.date() if isinstance(data.new_start_time, datetime) else date.today()
        await self._acquire_slot_lock(appt.doctor_id, new_day)

        # Check collision on new slot
        conflict_query = select(Appointment).where(
            and_(
                Appointment.doctor_id == appt.doctor_id,
                Appointment.id != appt.id,
                Appointment.status.in_(["pending", "confirmed", "completed"]),
                or_(
                    and_(Appointment.start_time <= data.new_start_time, Appointment.end_time > data.new_start_time),
                    and_(Appointment.start_time < data.new_end_time, Appointment.end_time >= data.new_end_time),
                    and_(Appointment.start_time >= data.new_start_time, Appointment.end_time <= data.new_end_time),
                )
            )
        )
        existing = await self.db.execute(conflict_query)
        if existing.scalar_one_or_none():
            raise SlotConflictException("The requested new slot is already booked. Please choose another time.")

        # Update appointment slot
        appt.start_time = data.new_start_time
        appt.end_time = data.new_end_time
        await self.db.commit()
        await self.db.refresh(appt)

        fac_name = appt.location.facility_name if appt.location else (appt.doctor.facility_name if appt.doctor else "Popular Diagnostic Centre")
        room_name = appt.location.chamber_room if appt.location else (appt.doctor.chamber_room if appt.doctor else "Room #402, Level 4")
        branch_name = appt.location.branch_area if appt.location else None

        doc_name = appt.doctor.user.name if (appt.doctor and appt.doctor.user) else "Doctor"
        new_when = data.new_start_time.strftime("%b %d, %I:%M %p")
        await self._notify(
            appt.patient_id,
            "queue_update",
            "Appointment Rescheduled 🔄",
            f"Serial #{appt.token_number} with {doc_name} moved to {new_when}.",
            appointment_id=appt.id,
            metadata={"tokenNumber": appt.token_number, "doctorName": doc_name, "newStartTime": data.new_start_time.isoformat()},
        )

        return AppointmentRead(
            id=appt.id,
            patient_id=appt.patient_id,
            patient_name=appt.patient.name if appt.patient else None,
            doctor_id=appt.doctor_id,
            location_id=appt.location_id,
            doctor_name=appt.doctor.user.name if appt.doctor and appt.doctor.user else "Doctor",
            specialization=appt.doctor.specialization if appt.doctor else "General",
            facility_name=fac_name,
            chamber_room=room_name,
            branch_area=branch_name,
            token_number=appt.token_number,
            start_time=appt.start_time,
            end_time=appt.end_time,
            status=appt.status,
            payment_status=appt.payment_status,
            fee=float(appt.doctor.consultation_fee) if appt.doctor else 1200.0,
            chief_complaint=appt.chief_complaint,
            created_at=appt.created_at
        )

    async def cancel(self, appointment_id: uuid.UUID, reason: str = "Cancelled by user") -> dict:
        appt = await self.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        appt.status = "cancelled"
        appt.cancellation_reason = reason
        await self.db.commit()

        doc_name = appt.doctor.user.name if (appt.doctor and appt.doctor.user) else "Doctor"
        when = appt.start_time.strftime("%b %d, %I:%M %p") if appt.start_time else ""
        await self._notify(
            appt.patient_id,
            "cancelled",
            "Appointment Cancelled ❌",
            f"Serial #{appt.token_number} with {doc_name} on {when} is cancelled. The slot is now free for others.",
            appointment_id=appt.id,
            metadata={"tokenNumber": appt.token_number, "doctorName": doc_name, "reason": reason},
        )
        return {"id": str(appt.id), "status": "cancelled", "cancelledAt": datetime.now(timezone.utc).isoformat()}

    async def update_status(self, appointment_id: uuid.UUID, new_status: str) -> dict:
        appt = await self.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        if new_status not in ["pending", "confirmed", "completed", "cancelled", "no_show"]:
            raise BadRequestException(f"Invalid status '{new_status}'")
        appt.status = new_status
        await self.db.commit()

        doc_name = appt.doctor.user.name if (appt.doctor and appt.doctor.user) else "Doctor"
        meta = {"tokenNumber": appt.token_number, "doctorName": doc_name}
        if new_status == "completed":
            await self._notify(
                appt.patient_id, "system", "Visit Completed ✅",
                f"Serial #{appt.token_number} with {doc_name} is marked completed. Get well soon!",
                appointment_id=appt.id, metadata=meta,
            )
        elif new_status == "no_show":
            await self._notify(
                appt.patient_id, "system", "Marked as No-Show ⚠️",
                f"Serial #{appt.token_number} with {doc_name} was marked as no-show. Please contact the chamber to rebook.",
                appointment_id=appt.id, metadata=meta,
            )
        elif new_status == "cancelled":
            await self._notify(
                appt.patient_id, "cancelled", "Appointment Cancelled ❌",
                f"Serial #{appt.token_number} with {doc_name} was cancelled by the clinic.",
                appointment_id=appt.id, metadata=meta,
            )
        return {"id": str(appt.id), "status": appt.status, "updatedAt": datetime.now(timezone.utc).isoformat()}

    async def verify_for_checkin(self, appointment_id: uuid.UUID, role: str) -> AppointmentVerifyResponse:
        """Reception check-in: validate a scanned chamber-pass QR code."""
        if role not in ("doctor", "admin"):
            raise ForbiddenException("Only doctors and clinic staff can verify chamber passes")
        appt = await self.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")

        full_name = appt.patient.name if appt.patient else "Patient"
        if role == "doctor":
            shown_name = full_name
        else:
            # Admins/reception see a masked name per clinical privacy rules
            parts = full_name.strip().split()
            shown_name = " ".join(
                (p[0] + "*" * max(1, len(p) - 2) + p[-1]) if len(p) > 2 else (p[0] + "*")
                for p in parts
            ) or "Patient"

        doc_name = appt.doctor.user.name if (appt.doctor and appt.doctor.user) else "Doctor"
        return AppointmentVerifyResponse(
            id=appt.id,
            token_number=appt.token_number,
            status=appt.status,
            valid=appt.status in ("pending", "confirmed"),
            patient_name=shown_name,
            doctor_name=doc_name,
            specialization=appt.doctor.specialization if appt.doctor else "General",
            facility_name=appt.location.facility_name if appt.location else (appt.doctor.facility_name if appt.doctor else None),
            chamber_room=appt.location.chamber_room if appt.location else (appt.doctor.chamber_room if appt.doctor else None),
            start_time=appt.start_time,
            end_time=appt.end_time,
            payment_status=appt.payment_status,
            fee=float(appt.doctor.consultation_fee) if (appt.doctor and appt.doctor.consultation_fee) else 0.0,
        )

    async def get_doctor_queue(self, doctor_id: uuid.UUID, target_date: date, user_role: str) -> DoctorQueueResponse:
        start_of_day = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
        end_of_day = start_of_day + timedelta(days=1)
        now_utc = datetime.now(timezone.utc)

        # 1. Fetch Doctor info
        doc_res = await self.db.execute(
            select(Doctor).where(Doctor.id == doctor_id)
        )
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundException(f"Doctor '{doctor_id}' not found")

        doctor_user_res = await self.db.execute(
            select(User).where(User.id == doctor.user_id)
        )
        doctor_user = doctor_user_res.scalar_one_or_none()
        doctor_name = doctor_user.name if doctor_user else "Specialist Doctor"

        # 2. Fetch appointments for target date
        query = select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.start_time >= start_of_day,
                Appointment.start_time < end_of_day,
                Appointment.status != "cancelled",
            )
        ).order_by(Appointment.token_number.asc())

        res = await self.db.execute(query)
        appts = res.scalars().all()

        # Dhaka calendar reference: running/paused states only exist for today or past days
        dhaka_today = datetime.now(_DHAKA_TZ).date()
        is_future_day = target_date > dhaka_today

        # Check pause registry (only meaningful for today's live queue)
        is_paused = False
        pause_message = None
        pause_data = queue_pause_registry.get(str(doctor_id))
        if pause_data:
            if pause_data.get("resume_at") and pause_data["resume_at"] > now_utc:
                is_paused = True
                pause_message = pause_data.get("reason", "Doctor is on a short clinical break")
            else:
                queue_pause_registry.pop(str(doctor_id), None)

        def mask_patient_name(name: str) -> str:
            if not name:
                return "Patient"
            parts = name.strip().split()
            masked_parts = []
            for p in parts:
                if len(p) <= 2:
                    masked_parts.append(p[0] + "*")
                else:
                    masked_parts.append(p[0] + "*" * max(1, len(p) - 2) + p[-1])
            return " ".join(masked_parts)

        items = []
        current_running_serial = None
        current_running_patient_name = None
        waiting_count = 0
        completed_count = 0

        for a in appts:
            if a.status in ["in_consultation", "in_progress", "in_chamber"]:
                current_running_serial = a.token_number
                current_running_patient_name = a.patient.name if (user_role == "doctor" and a.patient) else (mask_patient_name(a.patient.name) if a.patient else "Patient")
            elif a.status in ["confirmed", "pending"]:
                waiting_count += 1
            elif a.status == "completed":
                completed_count += 1

            # Clinical privacy rule: Doctors receive full complaints; Admin/others see masked text
            complaint = a.chief_complaint
            p_name = a.patient.name if a.patient else "Patient"
            p_phone = a.patient.phone if a.patient else None
            p_addr = a.patient.address if a.patient else None
            p_blood = a.patient.blood_group if a.patient else None

            if user_role != "doctor":
                complaint = "🔒 Clinical Problem Masked"
                p_name = mask_patient_name(p_name)
                p_phone = None
                p_addr = None
                p_blood = None

            age = None
            if a.patient and a.patient.birth_date:
                today = date.today()
                age = today.year - a.patient.birth_date.year - ((today.month, today.day) < (a.patient.birth_date.month, a.patient.birth_date.day))

            items.append(
                DoctorQueueItem(
                    id=a.id,
                    serial=a.token_number,
                    patient_id=a.patient_id,
                    patient_name=p_name,
                    phone=p_phone,
                    age=age,
                    gender=a.patient.gender if a.patient else None,
                    blood_group=p_blood,
                    address=p_addr,
                    visit_type=a.visit_type,
                    chief_complaint=complaint,
                    start_time=a.start_time,
                    end_time=a.end_time,
                    status=a.status
                )
            )

        # Determine chamber status
        # A "running" serial only exists for today (or past days). For future dates
        # nobody can be in consultation, so never promote a waiting token.
        # A break taken today must not freeze future-day views
        if is_future_day:
            is_paused = False
            pause_message = None
        if is_paused:
            chamber_status = "PAUSED (BREAK)"
        elif current_running_serial is not None:
            chamber_status = "IN_CONSULTATION"
        elif waiting_count > 0:
            if is_future_day:
                chamber_status = "SCHEDULED"
            else:
                chamber_status = "ACTIVE"
                # If no one is explicitly marked in_consultation yet, the next waiting token is ready
                first_waiting = next((a for a in appts if a.status in ["confirmed", "pending"]), None)
                if first_waiting:
                    current_running_serial = first_waiting.token_number
        elif completed_count > 0 and len(appts) == completed_count:
            chamber_status = "COMPLETED_TODAY"
        else:
            chamber_status = "IDLE"

        return DoctorQueueResponse(
            date=target_date.isoformat(),
            doctor_id=doctor.id,
            doctor_name=doctor_name,
            specialization=doctor.specialization,
            facility_name=doctor.facility_name,
            chamber_room=doctor.chamber_room,
            consultation_fee=float(doctor.consultation_fee),
            total_appointments=len(items),
            current_running_serial=current_running_serial,
            current_running_patient_name=current_running_patient_name,
            waiting_count=waiting_count,
            completed_count=completed_count,
            chamber_status=chamber_status,
            is_paused=is_paused,
            pause_message=pause_message,
            queue=items,
            items=items,
        )

    async def get_patient_appointments(self, patient_id: uuid.UUID, filter_type: str = "upcoming") -> List[AppointmentRead]:
        now = datetime.now(timezone.utc)
        query = select(Appointment).where(Appointment.patient_id == patient_id)

        if filter_type == "upcoming":
            query = query.where(and_(Appointment.start_time >= now, Appointment.status != "cancelled"))
        else:
            query = query.where(or_(Appointment.start_time < now, Appointment.status.in_(["completed", "cancelled"])))

        query = query.order_by(Appointment.start_time.asc())
        res = await self.db.execute(query)
        appts = res.scalars().all()

        return [
            AppointmentRead(
                id=a.id,
                patient_id=a.patient_id,
                patient_name=a.patient.name if a.patient else None,
                doctor_id=a.doctor_id,
                location_id=a.location_id,
                doctor_name=a.doctor.user.name if a.doctor and a.doctor.user else "Doctor",
                specialization=a.doctor.specialization if a.doctor else "General",
                facility_name=a.location.facility_name if a.location else (a.doctor.facility_name if a.doctor else "Popular Diagnostic Centre"),
                chamber_room=a.location.chamber_room if a.location else (a.doctor.chamber_room if a.doctor else "Room #402, Level 4"),
                branch_area=a.location.branch_area if a.location else None,
                token_number=a.token_number,
                start_time=a.start_time,
                end_time=a.end_time,
                status=a.status,
                payment_status=a.payment_status,
                fee=float(a.doctor.consultation_fee) if a.doctor else 1200.0,
                chief_complaint=a.chief_complaint,
                created_at=a.created_at
            )
            for a in appts
        ]

    async def pause_queue(self, doctor_id: uuid.UUID, data: QueuePauseRequest) -> QueuePauseResponse:
        # Enforce Doctor Break "Empty Chamber" Invariant:
        # Mark currently active appointment as completed so chamber is strictly empty
        doc_res = await self.db.execute(select(Doctor).where(Doctor.id == doctor_id))
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundException(f"Doctor '{doctor_id}' not found")
        doc_name = doctor.user.name if doctor.user else "Doctor"

        now = datetime.now(timezone.utc)
        resume_at = now + timedelta(minutes=data.pause_minutes)

        queue_pause_registry[str(doctor_id)] = {
            "is_paused": True,
            "resume_at": resume_at,
            "pause_minutes": data.pause_minutes
        }

        # Notify today's waiting patients (this is what trackers display)
        for w in await self._today_waiting(doctor_id):
            await self._notify(
                w.patient_id,
                "doctor_break",
                "Doctor on a Short Break ☕",
                f"{doc_name} paused the queue for ~{data.pause_minutes} min. Your serial #{w.token_number} is held — please stay nearby.",
                appointment_id=w.id,
                metadata={"tokenNumber": w.token_number, "doctorName": doc_name, "pauseMinutes": data.pause_minutes},
            )

        return QueuePauseResponse(
            is_paused=True,
            chamber_status="EMPTY (BREAK)",
            pause_minutes=data.pause_minutes,
            resume_at=resume_at,
            message="Chamber queue paused. Patient waiting trackers notified."
        )

    async def resume_queue(self, doctor_id: uuid.UUID) -> QueueResumeResponse:
        doc_res = await self.db.execute(select(Doctor).where(Doctor.id == doctor_id))
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundException(f"Doctor '{doctor_id}' not found")
        doc_name = doctor.user.name if doctor.user else "Doctor"

        queue_pause_registry[str(doctor_id)] = {"is_paused": False}

        waiting = await self._today_waiting(doctor_id)
        next_serial = waiting[0].token_number if waiting else 0
        for w in waiting:
            await self._notify(
                w.patient_id,
                "queue_update",
                "Queue Resumed ▶️",
                f"{doc_name} is back. Serial #{w.token_number} — please be ready, now serving #{next_serial}.",
                appointment_id=w.id,
                metadata={"tokenNumber": w.token_number, "doctorName": doc_name, "nowServing": next_serial},
            )

        return QueueResumeResponse(
            is_paused=False,
            currently_serving_serial=next_serial,
            chamber_status="ACTIVE",
            message=f"Queue resumed. Calling Serial #{next_serial:02d} into chamber." if next_serial else "Queue resumed. No patients waiting.",
        )
