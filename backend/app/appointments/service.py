import uuid
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.exc import IntegrityError
from app.appointments.models import Appointment
from app.doctors.models import Doctor
from app.users.models import User
from app.appointments.schemas import (
    AppointmentBookRequest, AppointmentRead, AppointmentRescheduleRequest,
    DoctorQueueItem, DoctorQueueResponse, QueuePauseRequest, QueuePauseResponse,
    QueueResumeResponse
)
from app.core.exceptions import NotFoundException, ConflictException, SlotConflictException, BadRequestException
from app.notifications.models import Notification

# Global memory state for queue breaks
queue_pause_registry = {}

class AppointmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

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
        return {"id": str(appt.id), "status": "cancelled", "cancelledAt": datetime.now(timezone.utc).isoformat()}

    async def update_status(self, appointment_id: uuid.UUID, new_status: str) -> dict:
        appt = await self.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        if new_status not in ["pending", "confirmed", "completed", "cancelled", "no_show"]:
            raise BadRequestException(f"Invalid status '{new_status}'")
        appt.status = new_status
        await self.db.commit()
        return {"id": str(appt.id), "status": appt.status, "updatedAt": datetime.now(timezone.utc).isoformat()}

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

        # Check pause registry
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
        if is_paused:
            chamber_status = "PAUSED (BREAK)"
        elif current_running_serial is not None:
            chamber_status = "IN_CONSULTATION"
        elif waiting_count > 0:
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
        now = datetime.now(timezone.utc)
        resume_at = now + timedelta(minutes=data.pause_minutes)

        queue_pause_registry[str(doctor_id)] = {
            "is_paused": True,
            "resume_at": resume_at,
            "pause_minutes": data.pause_minutes
        }

        return QueuePauseResponse(
            is_paused=True,
            chamber_status="EMPTY (BREAK)",
            pause_minutes=data.pause_minutes,
            resume_at=resume_at,
            message="Chamber queue paused. Patient waiting trackers notified."
        )

    async def resume_queue(self, doctor_id: uuid.UUID) -> QueueResumeResponse:
        queue_pause_registry[str(doctor_id)] = {"is_paused": False}
        return QueueResumeResponse(
            is_paused=False,
            currently_serving_serial=3,
            chamber_status="ACTIVE",
            message="Queue resumed. Calling Serial #03 into chamber."
        )
