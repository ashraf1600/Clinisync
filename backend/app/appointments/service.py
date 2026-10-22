import uuid
from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
import hashlib
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text
from sqlalchemy.exc import IntegrityError
from app.appointments.models import Appointment
from app.doctors.models import Doctor, DoctorLocation
from app.users.models import User
from app.appointments.schemas import (
    AppointmentBookRequest, AppointmentRead, AppointmentRescheduleRequest,
    DoctorQueueItem, DoctorQueueResponse, QueuePauseRequest, QueuePauseResponse,
    QueueResumeResponse, AppointmentVerifyResponse, WalkInRequest
)
from app.availability.service import AvailabilityService, MAX_APPOINTMENT_MINUTES
from app.core.exceptions import NotFoundException, ConflictException, SlotConflictException, BadRequestException, ForbiddenException
from app.core.timezone import DHAKA_TZ, to_utc, dhaka_date, dhaka_day_bounds_utc, format_local
from app.notifications.models import Notification

# Global memory state for queue breaks (per process; use Redis when running several workers)
queue_pause_registry = {}

# Appointments a patient can still attend
ACTIVE_STATUSES = ["pending", "confirmed"]
# Statuses that occupy the doctor's time; mirrors the DB exclusion constraint (status <> 'cancelled')
BLOCKING_STATUSES = ["pending", "confirmed", "completed", "no_show"]

# Visit lifecycle. Same-status updates are always allowed (e.g. editing notes).
ALLOWED_TRANSITIONS = {
    "pending": {"confirmed", "completed", "cancelled", "no_show"},
    "confirmed": {"completed", "cancelled", "no_show"},
    "no_show": {"completed"},  # patient turned up late after all
    "completed": set(),
    "cancelled": set(),
}

# Ephemeral walk-in patients get placeholder emails on this domain
WALKIN_EMAIL_DOMAIN = "@guest.local"


def _mask_name(name: Optional[str]) -> str:
    """Privacy mask: 'Rahim Uddin' -> 'R***m U***n'."""
    if not name or not name.strip():
        return "Patient"
    return " ".join(
        (p[0] + "*" * max(1, len(p) - 2) + p[-1]) if len(p) > 2 else (p[0] + "*")
        for p in name.strip().split()
    )


def _fee_for(doctor: Optional[Doctor], visit_type: Optional[str]) -> float:
    """Follow-up visits are charged the doctor's follow-up fee."""
    if not doctor:
        return 0.0
    if (visit_type or "").lower() == "followup" and doctor.followup_fee is not None:
        return float(doctor.followup_fee)
    return float(doctor.consultation_fee) if doctor.consultation_fee is not None else 0.0


class AppointmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------ helpers

    def _queue_notification(
        self,
        user_id: uuid.UUID,
        ntype: str,
        title: str,
        body: str,
        appointment_id: uuid.UUID | None = None,
        metadata: dict | None = None,
    ) -> None:
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

    async def _commit_notifications(self) -> None:
        """Fail-safe: notifications must never break the (already committed) main change."""
        try:
            await self.db.commit()
        except Exception:
            await self.db.rollback()

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
        start_utc, end_utc = dhaka_day_bounds_utc(datetime.now(DHAKA_TZ).date())
        res = await self.db.execute(
            select(Appointment).where(
                and_(
                    Appointment.doctor_id == doctor_id,
                    Appointment.status.in_(ACTIVE_STATUSES),
                    Appointment.start_time >= start_utc,
                    Appointment.start_time < end_utc,
                )
            ).order_by(Appointment.token_number.asc())
        )
        return list(res.scalars().all())

    async def get_by_id(self, appointment_id: uuid.UUID) -> Appointment | None:
        result = await self.db.execute(
            select(Appointment)
            .where(Appointment.id == appointment_id)
            .execution_options(populate_existing=True)
        )
        return result.scalar_one_or_none()

    async def _get_doctor(self, doctor_id: uuid.UUID) -> Doctor:
        doc_res = await self.db.execute(select(Doctor).where(Doctor.id == doctor_id))
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundException(f"Doctor '{doctor_id}' not found")
        return doctor

    async def _get_bookable_doctor(self, doctor_id: uuid.UUID) -> Doctor:
        doctor = await self._get_doctor(doctor_id)
        if doctor.user is not None and not doctor.user.is_active:
            raise BadRequestException("This doctor is not accepting appointments")
        return doctor

    @staticmethod
    def _resolve_location(doctor: Doctor, location_id: Optional[uuid.UUID]) -> Optional[DoctorLocation]:
        if not location_id:
            return None
        location = next((item for item in doctor.locations if item.id == location_id and item.is_active), None)
        if not location:
            raise NotFoundException("Selected doctor location not found or inactive")
        return location

    @staticmethod
    async def _assert_doctor_access(doctor: Doctor, actor: User) -> None:
        """Doctors may only act on their own chamber; admins on any."""
        if actor.role == "admin":
            return
        if actor.role != "doctor" or doctor.user_id != actor.id:
            raise ForbiddenException("You can only manage your own chamber")

    @staticmethod
    def _normalize_window(start: datetime, end: datetime) -> tuple[datetime, datetime]:
        st, et = to_utc(start), to_utc(end)
        if et <= st:
            raise BadRequestException("End time must be after start time.")
        return st, et

    async def _assert_slot_free(
        self, doctor_id: uuid.UUID, st: datetime, et: datetime, exclude_id: Optional[uuid.UUID] = None, message: Optional[str] = None
    ) -> None:
        conditions = [
            Appointment.doctor_id == doctor_id,
            Appointment.status.in_(BLOCKING_STATUSES),
            # Half-open interval overlap: [st, et) intersects [start, end)
            Appointment.start_time < et,
            Appointment.end_time > st,
        ]
        if exclude_id is not None:
            conditions.append(Appointment.id != exclude_id)
        existing = await self.db.execute(select(Appointment.id).where(and_(*conditions)).limit(1))
        if existing.first():
            raise SlotConflictException(message or "The selected appointment slot has just been booked. Please select another slot.")

    async def _assert_patient_free(
        self, patient_id: uuid.UUID, doctor_id: uuid.UUID, st: datetime, et: datetime, exclude_id: Optional[uuid.UUID] = None
    ) -> None:
        """A patient may hold one active serial per doctor per day and never two overlapping visits."""
        base = [Appointment.patient_id == patient_id, Appointment.status.in_(ACTIVE_STATUSES)]
        if exclude_id is not None:
            base.append(Appointment.id != exclude_id)

        overlap = await self.db.execute(
            select(Appointment.id).where(and_(*base, Appointment.start_time < et, Appointment.end_time > st)).limit(1)
        )
        if overlap.first():
            raise ConflictException("You already have another appointment at this time.", code="PATIENT_DOUBLE_BOOKING")

        day_start, day_end = dhaka_day_bounds_utc(dhaka_date(st))
        same_day = await self.db.execute(
            select(Appointment.token_number).where(
                and_(
                    *base,
                    Appointment.doctor_id == doctor_id,
                    Appointment.start_time >= day_start,
                    Appointment.start_time < day_end,
                )
            ).limit(1)
        )
        token = same_day.scalar()
        if token is not None:
            raise ConflictException(
                f"You already hold serial #{token} with this doctor on that day. Reschedule it instead of booking again.",
                code="PATIENT_DOUBLE_BOOKING",
            )

    async def _next_token(self, doctor_id: uuid.UUID, day: date, exclude_id: Optional[uuid.UUID] = None) -> int:
        """Daily serials are per doctor per Dhaka calendar day."""
        day_start, day_end = dhaka_day_bounds_utc(day)
        conditions = [
            Appointment.doctor_id == doctor_id,
            Appointment.start_time >= day_start,
            Appointment.start_time < day_end,
        ]
        if exclude_id is not None:
            conditions.append(Appointment.id != exclude_id)
        res = await self.db.execute(select(func.max(Appointment.token_number)).where(and_(*conditions)))
        return (res.scalar_one_or_none() or 0) + 1

    def _to_read(self, a: Appointment) -> AppointmentRead:
        doctor = a.doctor
        location = a.location
        return AppointmentRead(
            id=a.id,
            patient_id=a.patient_id,
            patient_name=a.patient.name if a.patient else None,
            doctor_id=a.doctor_id,
            location_id=a.location_id,
            doctor_name=doctor.user.name if doctor and doctor.user else "Doctor",
            specialization=doctor.specialization if doctor else "General",
            facility_name=location.facility_name if location else (doctor.facility_name if doctor else None),
            chamber_room=location.chamber_room if location else (doctor.chamber_room if doctor else None),
            branch_area=location.branch_area if location else None,
            token_number=a.token_number,
            start_time=a.start_time,
            end_time=a.end_time,
            status=a.status,
            payment_status=a.payment_status,
            fee=_fee_for(doctor, a.visit_type),
            chief_complaint=a.chief_complaint,
            created_at=a.created_at,
        )

    # ------------------------------------------------------------------ booking

    async def book(self, patient_id: uuid.UUID, data: AppointmentBookRequest, idempotency_key: Optional[str] = None) -> AppointmentRead:
        # 0. Idempotency: a replayed request returns the original booking
        if idempotency_key:
            replay = await self._idempotent_replay(patient_id, idempotency_key)
            if replay:
                return replay

        # 1. Verify doctor and chamber
        doctor = await self._get_bookable_doctor(data.doctor_id)
        self._resolve_location(doctor, data.location_id)

        # 1b. Past-booking guard and doctor's sitting hours
        st, et = self._normalize_window(data.start_time, data.end_time)
        if st <= datetime.now(timezone.utc):
            raise BadRequestException("Cannot book a past time slot. Please choose a future slot.")
        await AvailabilityService(self.db).ensure_bookable(data.doctor_id, st, et, data.location_id)

        # 1c. Serialize per doctor-day (Dhaka calendar) so concurrent books can't both pass the checks
        day = dhaka_date(st)
        await self._acquire_slot_lock(data.doctor_id, day)

        # 2. Slot conflict (application layer + DB exclusion backstop), then patient double-booking
        await self._assert_slot_free(data.doctor_id, st, et)
        await self._assert_patient_free(patient_id, data.doctor_id, st, et)

        # 3. Daily sequential token number
        next_token = await self._next_token(data.doctor_id, day)

        # 4. Insert appointment
        appt = Appointment(
            patient_id=patient_id,
            doctor_id=data.doctor_id,
            location_id=data.location_id,
            token_number=next_token,
            chief_complaint=data.chief_complaint,
            visit_type=data.visit_type,
            start_time=st,
            end_time=et,
            status="confirmed",
            payment_status="pay_at_chamber",
            idempotency_key=idempotency_key,
        )
        self.db.add(appt)

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            # Lost a race on the same Idempotency-Key: return the winner's booking
            if idempotency_key:
                replay = await self._idempotent_replay(patient_id, idempotency_key)
                if replay:
                    return replay
            raise SlotConflictException("The selected appointment slot has just been booked. Please select another slot.")

        appt = await self.get_by_id(appt.id)
        read = self._to_read(appt)

        # 5. Notify patient and doctor (fail-safe)
        when = format_local(st)
        self._queue_notification(
            patient_id,
            "booking_confirmed",
            "Appointment Confirmed! 🎫",
            f"Serial #{next_token:02d} assigned with {read.doctor_name} for {when}.",
            appointment_id=appt.id,
            metadata={"tokenNumber": next_token, "doctorName": read.doctor_name},
        )
        if doctor.user_id:
            self._queue_notification(
                doctor.user_id,
                "booking_confirmed",
                "New Booking 📋",
                f"Serial #{next_token:02d} · {read.patient_name or 'Patient'} booked {when}.",
                appointment_id=appt.id,
                metadata={"tokenNumber": next_token, "patientName": read.patient_name or "Patient", "startTime": st.isoformat()},
            )
        await self._commit_notifications()
        return read

    async def _idempotent_replay(self, patient_id: uuid.UUID, idempotency_key: str) -> Optional[AppointmentRead]:
        res = await self.db.execute(select(Appointment).where(Appointment.idempotency_key == idempotency_key))
        existing = res.scalar_one_or_none()
        if not existing:
            return None
        if existing.patient_id != patient_id:
            # Never reveal (or hijack) another patient's booking through a reused key
            raise ConflictException("This Idempotency-Key has already been used for a different request.", code="IDEMPOTENCY_KEY_REUSED")
        return self._to_read(existing)

    async def reschedule(self, appointment_id: uuid.UUID, actor: User, data: AppointmentRescheduleRequest) -> AppointmentRead:
        appt = await self.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        if appt.patient_id != actor.id and actor.role != "admin":
            raise ForbiddenException("Only the booking patient or an admin can reschedule this appointment")
        if appt.status not in ACTIVE_STATUSES:
            raise BadRequestException(f"Cannot reschedule appointment in status '{appt.status}'")

        now = datetime.now(timezone.utc)
        if to_utc(appt.start_time) <= now:
            raise BadRequestException("This appointment has already started and can no longer be rescheduled.")

        ns, ne = self._normalize_window(data.new_start_time, data.new_end_time)

        # Same-slot no-op guard
        if to_utc(appt.start_time) == ns and to_utc(appt.end_time) == ne:
            raise BadRequestException("New slot is the same as the current slot. Pick a different time.")
        if ns <= now:
            raise BadRequestException("Cannot reschedule to a past time slot.")
        await AvailabilityService(self.db).ensure_bookable(appt.doctor_id, ns, ne, appt.location_id)

        # Serialize per doctor-day BEFORE checking (same race as booking)
        new_day = dhaka_date(ns)
        await self._acquire_slot_lock(appt.doctor_id, new_day)

        await self._assert_slot_free(
            appt.doctor_id, ns, ne, exclude_id=appt.id,
            message="The requested new slot is already booked. Please choose another time.",
        )
        await self._assert_patient_free(appt.patient_id, appt.doctor_id, ns, ne, exclude_id=appt.id)

        # Retoken: new serial for the new calendar day (tokens are per doctor per Dhaka day)
        if new_day != dhaka_date(appt.start_time):
            appt.token_number = await self._next_token(appt.doctor_id, new_day, exclude_id=appt.id)

        appt.start_time = ns
        appt.end_time = ne
        appt.reschedule_count = (appt.reschedule_count or 0) + 1
        appt.version = (appt.version or 1) + 1
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise SlotConflictException("The requested new slot is already booked. Please choose another time.")

        appt = await self.get_by_id(appt.id)
        read = self._to_read(appt)

        new_when = format_local(ns)
        self._queue_notification(
            appt.patient_id,
            "queue_update",
            "Appointment Rescheduled 🔄",
            f"Serial #{appt.token_number} with {read.doctor_name} moved to {new_when}.",
            appointment_id=appt.id,
            metadata={"tokenNumber": appt.token_number, "doctorName": read.doctor_name, "newStartTime": ns.isoformat()},
        )
        if appt.doctor and appt.doctor.user_id:
            pat_name = read.patient_name or "Patient"
            self._queue_notification(
                appt.doctor.user_id,
                "queue_update",
                "Patient Rescheduled 🔄",
                f"{pat_name} (serial #{appt.token_number}) moved to {new_when}.",
                appointment_id=appt.id,
                metadata={"tokenNumber": appt.token_number, "patientName": pat_name, "newStartTime": ns.isoformat()},
            )
        await self._commit_notifications()
        return read

    async def cancel(self, appointment_id: uuid.UUID, reason: str = "Cancelled by user", actor: Optional[User] = None) -> dict:
        appt = await self.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        # Ownership: the booking patient, the assigned doctor, or an admin
        is_owner = actor is None or appt.patient_id == actor.id
        is_staff = actor is not None and (
            actor.role == "admin" or (actor.role == "doctor" and appt.doctor is not None and appt.doctor.user_id == actor.id)
        )
        if not is_owner and not is_staff:
            raise ForbiddenException("Only the booking patient or an admin can cancel this appointment")
        if appt.status == "cancelled":
            raise BadRequestException("Appointment is already cancelled")
        if appt.status not in ACTIVE_STATUSES:
            raise BadRequestException(f"Cannot cancel an appointment in status '{appt.status}'")
        if not is_staff and to_utc(appt.start_time) <= datetime.now(timezone.utc):
            raise BadRequestException("This appointment has already started. Please contact the chamber.")

        appt.status = "cancelled"
        appt.cancellation_reason = reason
        appt.version = (appt.version or 1) + 1
        await self.db.commit()

        doc_name = appt.doctor.user.name if (appt.doctor and appt.doctor.user) else "Doctor"
        pat_name = appt.patient.name if appt.patient else "Patient"
        when = format_local(appt.start_time)
        by_patient = actor is None or actor.id == appt.patient_id
        self._queue_notification(
            appt.patient_id,
            "cancelled",
            "Appointment Cancelled ❌",
            f"Serial #{appt.token_number} with {doc_name} on {when} is cancelled."
            + ("" if by_patient else " It was cancelled by the clinic."),
            appointment_id=appt.id,
            metadata={"tokenNumber": appt.token_number, "doctorName": doc_name, "reason": reason},
        )
        if appt.doctor and appt.doctor.user_id and (actor is None or actor.id != appt.doctor.user_id):
            who = pat_name if by_patient else "The clinic"
            self._queue_notification(
                appt.doctor.user_id,
                "cancelled",
                "Appointment Cancelled ❌",
                f"{who} cancelled serial #{appt.token_number} ({pat_name}) for {when}.",
                appointment_id=appt.id,
                metadata={"tokenNumber": appt.token_number, "patientName": pat_name, "reason": reason},
            )
        await self._commit_notifications()
        return {"id": str(appt.id), "status": "cancelled", "cancelledAt": datetime.now(timezone.utc).isoformat()}

    async def update_status(self, appointment_id: uuid.UUID, new_status: str, actor: Optional[User] = None, doctor_notes: Optional[str] = None) -> dict:
        appt = await self.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        # Only the assigned doctor or an admin may change visit status
        if actor is not None and actor.role != "admin":
            if not appt.doctor or appt.doctor.user_id != actor.id:
                raise ForbiddenException("Only the assigned doctor or an admin can update this appointment status")
        if new_status not in ALLOWED_TRANSITIONS:
            raise BadRequestException(f"Invalid status '{new_status}'")

        old_status = appt.status
        if new_status != old_status:
            if new_status not in ALLOWED_TRANSITIONS.get(old_status, set()):
                raise BadRequestException(
                    f"Cannot change status from '{old_status}' to '{new_status}'", code="INVALID_STATUS_TRANSITION"
                )
            now = datetime.now(timezone.utc)
            if new_status == "no_show" and to_utc(appt.start_time) > now:
                raise BadRequestException("A patient can only be marked no-show after the appointment time")
            if new_status == "completed" and dhaka_date(appt.start_time) > datetime.now(DHAKA_TZ).date():
                raise BadRequestException("Cannot complete a visit scheduled for a future day")

        appt.status = new_status
        if new_status == "cancelled" and old_status != "cancelled":
            appt.cancellation_reason = appt.cancellation_reason or "Cancelled by the clinic"
        if doctor_notes is not None:
            appt.doctor_notes = doctor_notes.strip() or None
        appt.version = (appt.version or 1) + 1
        try:
            await self.db.commit()
        except IntegrityError:
            # e.g. a no-show turned completed while the slot was rebooked
            await self.db.rollback()
            raise SlotConflictException("This time slot is now held by another appointment.")

        if new_status != old_status:
            doc_name = appt.doctor.user.name if (appt.doctor and appt.doctor.user) else "Doctor"
            meta = {"tokenNumber": appt.token_number, "doctorName": doc_name}
            if new_status == "completed":
                self._queue_notification(
                    appt.patient_id, "system", "Visit Completed ✅",
                    f"Serial #{appt.token_number} with {doc_name} is marked completed. Get well soon!",
                    appointment_id=appt.id, metadata=meta,
                )
            elif new_status == "no_show":
                self._queue_notification(
                    appt.patient_id, "system", "Marked as No-Show ⚠️",
                    f"Serial #{appt.token_number} with {doc_name} was marked as no-show. Please contact the chamber to rebook.",
                    appointment_id=appt.id, metadata=meta,
                )
            elif new_status == "cancelled":
                self._queue_notification(
                    appt.patient_id, "cancelled", "Appointment Cancelled ❌",
                    f"Serial #{appt.token_number} with {doc_name} was cancelled by the clinic.",
                    appointment_id=appt.id, metadata=meta,
                )
            await self._commit_notifications()
        return {"id": str(appt.id), "status": appt.status, "doctorNotes": appt.doctor_notes, "updatedAt": datetime.now(timezone.utc).isoformat()}

    async def update_payment(self, appointment_id: uuid.UUID, new_status: str, actor: Optional[User] = None) -> dict:
        appt = await self.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        if actor is not None and actor.role != "admin":
            if not appt.doctor or appt.doctor.user_id != actor.id:
                raise ForbiddenException("Only the assigned doctor or an admin can update payment")
        if new_status not in ("pay_at_chamber", "paid", "waived"):
            raise BadRequestException("Invalid payment status")
        if appt.status == "cancelled" and new_status == "paid":
            raise BadRequestException("Cannot record a payment for a cancelled appointment")
        appt.payment_status = new_status
        await self.db.commit()
        return {"id": str(appt.id), "paymentStatus": appt.payment_status, "updatedAt": datetime.now(timezone.utc).isoformat()}

    async def walk_in(self, actor: User, data: WalkInRequest) -> AppointmentRead:
        """Reception/doctor creates a walk-in serial (no prior patient account)."""
        if actor.role not in ("doctor", "admin"):
            raise ForbiddenException("Only doctors or clinic staff can add walk-ins")
        doctor = await self._get_doctor(data.doctor_id)
        await self._assert_doctor_access(doctor, actor)
        self._resolve_location(doctor, data.location_id)

        st, et = self._normalize_window(data.start_time, data.end_time)
        if st <= datetime.now(timezone.utc):
            raise BadRequestException("Walk-in slot must be in the future")
        if (et - st) > timedelta(minutes=MAX_APPOINTMENT_MINUTES):
            raise BadRequestException(f"A visit cannot be longer than {MAX_APPOINTMENT_MINUTES} minutes")

        day = dhaka_date(st)
        await self._acquire_slot_lock(data.doctor_id, day)
        await self._assert_slot_free(data.doctor_id, st, et, message="Walk-in slot conflicts with an existing booking")

        # Resolve patient: reuse a patient record with this phone, else create a guest
        phone = (data.patient_phone or "").strip() or None
        name = data.patient_name.strip()
        patient = None
        if phone:
            pres = await self.db.execute(
                select(User)
                .where(User.phone == phone, User.role == "patient", User.is_active.is_(True))
                .order_by(User.created_at.asc())
                .limit(1)
            )
            patient = pres.scalar_one_or_none()
        if not patient:
            patient = User(
                name=name,
                email=f"walkin_{uuid.uuid4().hex[:12]}{WALKIN_EMAIL_DOMAIN}",
                password_hash="$walkin$",
                role="patient",
                phone=phone,
                timezone="Asia/Dhaka",
            )
            self.db.add(patient)
            await self.db.flush()
        elif patient.email.endswith(WALKIN_EMAIL_DOMAIN) and patient.name != name:
            # Only guest records follow the latest spelling; registered accounts own their name
            patient.name = name

        next_token = await self._next_token(data.doctor_id, day)
        appt = Appointment(
            patient_id=patient.id,
            doctor_id=data.doctor_id,
            location_id=data.location_id,
            token_number=next_token,
            chief_complaint=data.chief_complaint,
            visit_type=data.visit_type,
            start_time=st,
            end_time=et,
            status="confirmed",
            payment_status="pay_at_chamber",
        )
        self.db.add(appt)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise SlotConflictException("Walk-in slot just taken")

        appt = await self.get_by_id(appt.id)
        read = self._to_read(appt)
        self._queue_notification(
            patient.id, "booking_confirmed", "Walk-in Serial Added 🎫",
            f"Serial #{next_token:02d} with {read.doctor_name} at {format_local(st)}.",
            appointment_id=appt.id, metadata={"tokenNumber": next_token},
        )
        await self._commit_notifications()
        return read

    async def verify_for_checkin(self, appointment_id: uuid.UUID, actor: User) -> AppointmentVerifyResponse:
        """Reception check-in: validate a scanned chamber-pass QR code."""
        if actor.role not in ("doctor", "admin"):
            raise ForbiddenException("Only doctors and clinic staff can verify chamber passes")
        appt = await self.get_by_id(appointment_id)
        if not appt:
            raise NotFoundException("Appointment not found")
        if actor.role == "doctor" and (not appt.doctor or appt.doctor.user_id != actor.id):
            raise ForbiddenException("This chamber pass belongs to another doctor's chamber")

        full_name = appt.patient.name if appt.patient else "Patient"
        # Treating doctor sees the real name; admins/reception see a masked name per clinical privacy rules
        shown_name = full_name if actor.role == "doctor" else _mask_name(full_name)

        # A pass is valid for an active booking on today's (or a later) clinic day
        today = datetime.now(DHAKA_TZ).date()
        is_valid = appt.status in ACTIVE_STATUSES and dhaka_date(appt.start_time) >= today

        doc_name = appt.doctor.user.name if (appt.doctor and appt.doctor.user) else "Doctor"
        return AppointmentVerifyResponse(
            id=appt.id,
            token_number=appt.token_number,
            status=appt.status,
            valid=is_valid,
            patient_name=shown_name,
            doctor_name=doc_name,
            specialization=appt.doctor.specialization if appt.doctor else "General",
            facility_name=appt.location.facility_name if appt.location else (appt.doctor.facility_name if appt.doctor else None),
            chamber_room=appt.location.chamber_room if appt.location else (appt.doctor.chamber_room if appt.doctor else None),
            start_time=appt.start_time,
            end_time=appt.end_time,
            payment_status=appt.payment_status,
            fee=_fee_for(appt.doctor, appt.visit_type),
        )

    # ------------------------------------------------------------------ queue

    async def get_doctor_queue(self, doctor_id: uuid.UUID, target_date: date, viewer: Optional[User], location_id: Optional[uuid.UUID] = None) -> DoctorQueueResponse:
        # Queue days are Dhaka calendar days
        start_of_day, end_of_day = dhaka_day_bounds_utc(target_date)
        now_utc = datetime.now(timezone.utc)

        doctor = await self._get_doctor(doctor_id)
        doctor_name = doctor.user.name if doctor.user else "Specialist Doctor"
        location = next((loc for loc in doctor.locations if loc.id == location_id), None) if location_id else None

        # Only the treating doctor sees identifiable clinical details
        full_view = viewer is not None and viewer.role == "doctor" and doctor.user_id == viewer.id

        query = select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.start_time >= start_of_day,
                Appointment.start_time < end_of_day,
                Appointment.status != "cancelled",
            )
        )
        if location_id:
            query = query.where(Appointment.location_id == location_id)
        query = query.order_by(Appointment.token_number.asc())

        res = await self.db.execute(query)
        appts = res.scalars().all()

        # Running/paused states only exist for today's live queue
        dhaka_today = datetime.now(DHAKA_TZ).date()
        is_future_day = target_date > dhaka_today

        is_paused = False
        pause_message = None
        pause_data = queue_pause_registry.get(str(doctor_id))
        if pause_data:
            if pause_data.get("resume_at") and pause_data["resume_at"] > now_utc:
                is_paused = target_date == dhaka_today
                if is_paused:
                    pause_message = pause_data.get("reason") or "Doctor is on a short clinical break"
            else:
                queue_pause_registry.pop(str(doctor_id), None)

        items = []
        current_running_serial = None
        current_running_patient_name = None
        waiting_count = 0
        completed_count = 0

        for a in appts:
            p = a.patient
            p_name = p.name if p else "Patient"
            if a.status in ["in_consultation", "in_progress", "in_chamber"]:
                current_running_serial = a.token_number
                current_running_patient_name = p_name if full_view else _mask_name(p_name)
            elif a.status in ACTIVE_STATUSES:
                waiting_count += 1
            elif a.status == "completed":
                completed_count += 1

            age = None
            if p and p.birth_date:
                today = dhaka_today
                age = today.year - p.birth_date.year - ((today.month, today.day) < (p.birth_date.month, p.birth_date.day))

            # Clinical privacy rule: the treating doctor receives full details; everyone else sees masked data
            items.append(
                DoctorQueueItem(
                    id=a.id,
                    serial=a.token_number,
                    patient_id=a.patient_id,
                    patient_name=p_name if full_view else _mask_name(p_name),
                    phone=(p.phone if p else None) if full_view else None,
                    age=age,
                    gender=p.gender if p else None,
                    blood_group=(p.blood_group if p else None) if full_view else None,
                    address=(p.address if p else None) if full_view else None,
                    visit_type=a.visit_type,
                    chief_complaint=a.chief_complaint if full_view else "🔒 Clinical Problem Masked",
                    start_time=a.start_time,
                    end_time=a.end_time,
                    status=a.status
                )
            )

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
                first_waiting = next((a for a in appts if a.status in ACTIVE_STATUSES), None)
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
            facility_name=location.facility_name if location else doctor.facility_name,
            chamber_room=location.chamber_room if location else doctor.chamber_room,
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

        is_upcoming = and_(Appointment.status.in_(ACTIVE_STATUSES), Appointment.end_time > now)
        if filter_type == "upcoming":
            # Still attendable (including a visit currently in progress), soonest first
            query = query.where(is_upcoming).order_by(Appointment.start_time.asc())
        else:
            # History: everything else, most recent first
            query = query.where(~is_upcoming).order_by(Appointment.start_time.desc())

        res = await self.db.execute(query)
        return [self._to_read(a) for a in res.scalars().all()]

    async def pause_queue(self, doctor_id: uuid.UUID, data: QueuePauseRequest, actor: User) -> QueuePauseResponse:
        doctor = await self._get_doctor(doctor_id)
        await self._assert_doctor_access(doctor, actor)
        doc_name = doctor.user.name if doctor.user else "Doctor"

        # Enforce Doctor Break "Empty Chamber" Invariant:
        # complete any in-chamber appointment for today so the chamber is empty during break
        start_utc, end_utc = dhaka_day_bounds_utc(datetime.now(DHAKA_TZ).date())
        active_res = await self.db.execute(
            select(Appointment).where(
                and_(
                    Appointment.doctor_id == doctor_id,
                    Appointment.status.in_(["in_consultation", "in_progress", "in_chamber"]),
                    Appointment.start_time >= start_utc,
                    Appointment.start_time < end_utc,
                )
            )
        )
        completed_any = False
        for act in active_res.scalars().all():
            act.status = "completed"
            completed_any = True
        if completed_any:
            await self.db.commit()

        now = datetime.now(timezone.utc)
        resume_at = now + timedelta(minutes=data.pause_minutes)

        queue_pause_registry[str(doctor_id)] = {
            "is_paused": True,
            "resume_at": resume_at,
            "pause_minutes": data.pause_minutes,
            "reason": data.reason,
        }

        # Notify today's waiting patients (this is what trackers display)
        for w in await self._today_waiting(doctor_id):
            self._queue_notification(
                w.patient_id,
                "doctor_break",
                "Doctor on a Short Break ☕",
                f"{doc_name} paused the queue for ~{data.pause_minutes} min. Your serial #{w.token_number} is held — please stay nearby.",
                appointment_id=w.id,
                metadata={"tokenNumber": w.token_number, "doctorName": doc_name, "pauseMinutes": data.pause_minutes},
            )
        await self._commit_notifications()

        return QueuePauseResponse(
            is_paused=True,
            chamber_status="EMPTY (BREAK)",
            pause_minutes=data.pause_minutes,
            resume_at=resume_at,
            message="Chamber queue paused. Patient waiting trackers notified."
        )

    async def resume_queue(self, doctor_id: uuid.UUID, actor: User) -> QueueResumeResponse:
        doctor = await self._get_doctor(doctor_id)
        await self._assert_doctor_access(doctor, actor)
        doc_name = doctor.user.name if doctor.user else "Doctor"

        queue_pause_registry.pop(str(doctor_id), None)

        waiting = await self._today_waiting(doctor_id)
        next_serial = waiting[0].token_number if waiting else 0
        for w in waiting:
            self._queue_notification(
                w.patient_id,
                "queue_update",
                "Queue Resumed ▶️",
                f"{doc_name} is back. Serial #{w.token_number} — please be ready, now serving #{next_serial}.",
                appointment_id=w.id,
                metadata={"tokenNumber": w.token_number, "doctorName": doc_name, "nowServing": next_serial},
            )
        await self._commit_notifications()

        return QueueResumeResponse(
            is_paused=False,
            currently_serving_serial=next_serial,
            chamber_status="ACTIVE",
            message=f"Queue resumed. Calling Serial #{next_serial:02d} into chamber." if next_serial else "Queue resumed. No patients waiting.",
        )
