import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, or_, func
from app.availability.models import Availability, AvailabilityException
from app.availability.schemas import (
    DoctorDayAvailabilityResponse, TimeSlot, ShiftItem,
    ExceptionCreateRequest, ExceptionRead,
    BulkGenerateRequest, BulkGenerateResponse, ChamberShiftRead, ChamberShiftCreate,
    DayScheduleSummary, DoctorMultiDayScheduleResponse
)
from app.doctors.models import Doctor, DoctorLocation
from app.core.exceptions import NotFoundException, BadRequestException
from app.core.timezone import DHAKA_TZ, to_utc, dhaka_date, dhaka_day_bounds_utc, dhaka_wall_to_utc, format_local

# Statuses that occupy a slot on the doctor's calendar; mirrors the DB exclusion
# constraint (status <> 'cancelled') so a slot never shows free but fails to book
BLOCKING_STATUSES = ["pending", "confirmed", "completed", "no_show"]

# Demo schedule for doctors that have not configured any shifts yet
DEFAULT_SHIFT_START = time(17, 0)
DEFAULT_SHIFT_END = time(21, 0)
DEFAULT_SLOT_MINUTES = 30
DEFAULT_BUFFER_MINUTES = 10
DEFAULT_SITTING_DAYS = [6, 0, 1, 2, 3, 4]  # Saturday - Thursday

MIN_APPOINTMENT_MINUTES = 5
MAX_APPOINTMENT_MINUTES = 240


def _parse_wall_clock(value: str) -> time:
    parts = [int(p) for p in value.split(":")]
    return time(parts[0], parts[1])


def _dow(d: date) -> int:
    """Python weekday (Mon=0) -> clinic convention (Sun=0 ... Sat=6)."""
    return (d.weekday() + 1) % 7


class AvailabilityService:
    DAY_NAMES = {
        0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
        4: "Thursday", 5: "Friday", 6: "Saturday"
    }
    DAY_NAMES_BN = {
        0: "রবিবার", 1: "সোমবার", 2: "মঙ্গলবার", 3: "বুধবার",
        4: "বৃহস্পতিবার", 5: "শুক্রবার", 6: "শনিবার"
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_doctor(self, doctor_id: uuid.UUID) -> Doctor:
        doc_res = await self.db.execute(select(Doctor).where(Doctor.id == doctor_id))
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundException(f"Doctor '{doctor_id}' not found")
        return doctor

    async def _location_map(self, doctor_id: uuid.UUID) -> dict[uuid.UUID, DoctorLocation]:
        locs_res = await self.db.execute(select(DoctorLocation).where(DoctorLocation.doctor_id == doctor_id))
        return {loc.id: loc for loc in locs_res.scalars().all()}

    async def _require_own_location(self, doctor_id: uuid.UUID, location_id: Optional[uuid.UUID]) -> Optional[DoctorLocation]:
        if location_id is None:
            return None
        loc_res = await self.db.execute(
            select(DoctorLocation).where(DoctorLocation.id == location_id, DoctorLocation.doctor_id == doctor_id)
        )
        loc = loc_res.scalar_one_or_none()
        if not loc:
            raise NotFoundException(f"Chamber location '{location_id}' not found for this doctor")
        return loc

    async def _active_shifts(self, doctor_id: uuid.UUID, loc_map: dict[uuid.UUID, DoctorLocation]) -> List[Availability]:
        """Active shifts, excluding those tied to a deactivated chamber."""
        res = await self.db.execute(
            select(Availability)
            .where(and_(Availability.doctor_id == doctor_id, Availability.is_active.is_(True)))
            .order_by(Availability.day_of_week, Availability.start_time)
        )
        return [
            s for s in res.scalars().all()
            if s.location_id is None or (s.location_id in loc_map and loc_map[s.location_id].is_active)
        ]

    async def _booked_ranges(self, doctor_id: uuid.UUID, start_utc: datetime, end_utc: datetime) -> list[tuple[datetime, datetime]]:
        """Busy intervals for the doctor across ALL chambers.

        A doctor cannot sit in two chambers at once, so a booking at chamber A
        must block the same time at chamber B (booking enforces this too).
        """
        from app.appointments.models import Appointment
        res = await self.db.execute(
            select(Appointment.start_time, Appointment.end_time).where(
                and_(
                    Appointment.doctor_id == doctor_id,
                    Appointment.status.in_(BLOCKING_STATUSES),
                    Appointment.start_time < end_utc,
                    Appointment.end_time > start_utc,
                )
            )
        )
        return [(to_utc(s), to_utc(e)) for s, e in res.all()]

    def _default_shift(self, doctor_id: uuid.UUID, dow: int, location_id: Optional[uuid.UUID]) -> Availability:
        return Availability(
            doctor_id=doctor_id,
            location_id=location_id,
            day_of_week=dow,
            start_time=DEFAULT_SHIFT_START,
            end_time=DEFAULT_SHIFT_END,
            slot_duration_minutes=DEFAULT_SLOT_MINUTES,
            buffer_minutes=DEFAULT_BUFFER_MINUTES,
            is_active=True,
        )

    def _build_slots(
        self,
        cur_date: date,
        shifts: List[Availability],
        booked_ranges: list[tuple[datetime, datetime]],
        now_utc: datetime,
        loc_map: dict[uuid.UUID, DoctorLocation],
        location_id: Optional[uuid.UUID],
        fallback_facility: Optional[str],
        fallback_room: Optional[str],
    ) -> List[TimeSlot]:
        """Expand shifts (Dhaka wall-clock) into UTC slots for one calendar day."""
        slots: List[TimeSlot] = []
        for s in shifts:
            cur_slot_time = dhaka_wall_to_utc(cur_date, s.start_time)
            shift_end_dt = dhaka_wall_to_utc(cur_date, s.end_time)
            dur = s.slot_duration_minutes or DEFAULT_SLOT_MINUTES
            # 0 is a valid buffer; only fall back when unset
            buf = s.buffer_minutes if s.buffer_minutes is not None else DEFAULT_BUFFER_MINUTES

            s_loc = loc_map.get(s.location_id) if s.location_id else (loc_map.get(location_id) if location_id else None)
            s_loc_name = s_loc.facility_name if s_loc else fallback_facility
            s_loc_room = s_loc.chamber_room if s_loc else fallback_room

            while cur_slot_time + timedelta(minutes=dur) <= shift_end_dt:
                slot_end = cur_slot_time + timedelta(minutes=dur)
                is_collided = any(max(cur_slot_time, b_start) < min(slot_end, b_end) for b_start, b_end in booked_ranges)
                is_past = cur_slot_time <= now_utc
                slots.append(
                    TimeSlot(
                        start_time=cur_slot_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        end_time=slot_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        is_available=not is_collided and not is_past,
                        is_past=is_past,
                        location_id=s.location_id or location_id,
                        facility_name=s_loc_name,
                        chamber_room=s_loc_room,
                    )
                )
                cur_slot_time = slot_end + timedelta(minutes=buf)
        slots.sort(key=lambda slot: slot.start_time)
        return slots

    async def get_slots_for_date(self, doctor_id: uuid.UUID, target_date: date, location_id: uuid.UUID | None = None) -> DoctorDayAvailabilityResponse:
        doctor = await self._get_doctor(doctor_id)
        loc_map = await self._location_map(doctor_id)
        target_location_name = loc_map[location_id].facility_name if (location_id and location_id in loc_map) else doctor.facility_name

        def empty() -> DoctorDayAvailabilityResponse:
            return DoctorDayAvailabilityResponse(
                doctor_id=doctor_id,
                date=target_date.isoformat(),
                location_id=location_id,
                facility_name=target_location_name,
                slot_duration_minutes=DEFAULT_SLOT_MINUTES,
                buffer_minutes=DEFAULT_BUFFER_MINUTES,
                slots=[]
            )

        # Date exceptions (holiday / off day) block the entire day
        exc_res = await self.db.execute(
            select(AvailabilityException).where(
                and_(
                    AvailabilityException.doctor_id == doctor_id,
                    AvailabilityException.exception_date == target_date
                )
            )
        )
        exception = exc_res.scalar_one_or_none()
        if exception and not exception.is_available:
            return empty()

        dow = _dow(target_date)
        all_shifts = await self._active_shifts(doctor_id, loc_map)
        if all_shifts:
            shifts = [
                s for s in all_shifts
                if s.day_of_week == dow and (location_id is None or s.location_id in (None, location_id))
            ]
            if not shifts:
                # Configured doctor, but no sitting on this day/chamber
                return empty()
        elif dow in DEFAULT_SITTING_DAYS:
            # Default demo schedule only for unconfigured doctors (same days as the multi-day view)
            shifts = [self._default_shift(doctor_id, dow, location_id)]
        else:
            return empty()

        start_of_day, end_of_day = dhaka_day_bounds_utc(target_date)
        booked_ranges = await self._booked_ranges(doctor_id, start_of_day, end_of_day)
        slots = self._build_slots(
            target_date, shifts, booked_ranges, datetime.now(timezone.utc),
            loc_map, location_id, doctor.facility_name, doctor.chamber_room,
        )

        return DoctorDayAvailabilityResponse(
            doctor_id=doctor_id,
            date=target_date.isoformat(),
            location_id=location_id,
            facility_name=target_location_name,
            slot_duration_minutes=shifts[0].slot_duration_minutes,
            buffer_minutes=shifts[0].buffer_minutes,
            slots=slots
        )

    async def ensure_bookable(
        self,
        doctor_id: uuid.UUID,
        start_utc: datetime,
        end_utc: datetime,
        location_id: Optional[uuid.UUID] = None,
    ) -> None:
        """Reject bookings that fall outside the doctor's sitting hours.

        Checks: sane duration, same clinic day, no blocking holiday exception and,
        for doctors with configured shifts, that the window lies inside one of that
        day's shifts (at the requested chamber, if any). Doctors without any
        configured shifts keep the permissive demo schedule.
        """
        start_utc, end_utc = to_utc(start_utc), to_utc(end_utc)
        minutes = (end_utc - start_utc).total_seconds() / 60
        if minutes < MIN_APPOINTMENT_MINUTES or minutes > MAX_APPOINTMENT_MINUTES:
            raise BadRequestException(
                f"Appointment length must be between {MIN_APPOINTMENT_MINUTES} and {MAX_APPOINTMENT_MINUTES} minutes",
                code="SLOT_UNAVAILABLE",
            )
        day = dhaka_date(start_utc)
        if dhaka_date(end_utc - timedelta(microseconds=1)) != day:
            raise BadRequestException("An appointment must start and end on the same day", code="SLOT_UNAVAILABLE")

        exc_res = await self.db.execute(
            select(AvailabilityException).where(
                and_(AvailabilityException.doctor_id == doctor_id, AvailabilityException.exception_date == day)
            )
        )
        exception = exc_res.scalar_one_or_none()
        if exception and not exception.is_available:
            reason = f" ({exception.reason})" if exception.reason else ""
            raise BadRequestException(f"The doctor is not available on {day.isoformat()}{reason}", code="SLOT_UNAVAILABLE")

        loc_map = await self._location_map(doctor_id)
        shifts = await self._active_shifts(doctor_id, loc_map)
        if not shifts:
            return

        dow = _dow(day)
        for s in shifts:
            if s.day_of_week != dow:
                continue
            if location_id is not None and s.location_id not in (None, location_id):
                continue
            if dhaka_wall_to_utc(day, s.start_time) <= start_utc and end_utc <= dhaka_wall_to_utc(day, s.end_time):
                return
        raise BadRequestException(
            f"The selected time ({format_local(start_utc)}) is outside the doctor's chamber hours",
            code="SLOT_UNAVAILABLE",
        )

    async def set_recurring_shifts(self, doctor_id: uuid.UUID, shifts: List[ShiftItem]):
        await self._get_doctor(doctor_id)
        for s in shifts:
            await self._require_own_location(doctor_id, s.location_id)

        # Replace the whole weekly template
        await self.db.execute(delete(Availability).where(Availability.doctor_id == doctor_id))
        for s in shifts:
            self.db.add(
                Availability(
                    doctor_id=doctor_id,
                    location_id=s.location_id,
                    day_of_week=s.day_of_week,
                    start_time=_parse_wall_clock(s.start_time),
                    end_time=_parse_wall_clock(s.end_time),
                    slot_duration_minutes=s.slot_duration_minutes,
                    buffer_minutes=s.buffer_minutes,
                    is_active=True
                )
            )
        await self.db.commit()

    async def add_exception(self, doctor_id: uuid.UUID, data: ExceptionCreateRequest) -> ExceptionRead:
        doctor = await self._get_doctor(doctor_id)
        existing = await self.db.execute(
            select(AvailabilityException).where(
                and_(
                    AvailabilityException.doctor_id == doctor_id,
                    AvailabilityException.exception_date == data.exception_date
                )
            )
        )
        exc = existing.scalar_one_or_none()
        if exc:
            exc.is_available = data.is_available
            exc.reason = data.reason
        else:
            exc = AvailabilityException(
                doctor_id=doctor_id,
                exception_date=data.exception_date,
                is_available=data.is_available,
                reason=data.reason
            )
            self.db.add(exc)

        await self.db.commit()
        await self.db.refresh(exc)

        if not data.is_available:
            await self._notify_day_blocked(doctor, data.exception_date, data.reason)

        return ExceptionRead(
            id=exc.id,
            doctor_id=exc.doctor_id,
            exception_date=exc.exception_date,
            is_available=exc.is_available,
            reason=exc.reason,
            created_at=exc.created_at
        )

    async def _notify_day_blocked(self, doctor: Doctor, day: date, reason: Optional[str]) -> None:
        """Tell patients already booked on a newly blocked day so they can reschedule."""
        from app.appointments.models import Appointment
        from app.notifications.models import Notification

        start_utc, end_utc = dhaka_day_bounds_utc(day)
        res = await self.db.execute(
            select(Appointment).where(
                and_(
                    Appointment.doctor_id == doctor.id,
                    Appointment.status.in_(["pending", "confirmed"]),
                    Appointment.start_time >= start_utc,
                    Appointment.start_time < end_utc,
                )
            )
        )
        doc_name = doctor.user.name if doctor.user else "Doctor"
        affected = list(res.scalars().all())
        for a in affected:
            self.db.add(
                Notification(
                    user_id=a.patient_id,
                    appointment_id=a.id,
                    title="Doctor Unavailable ⚠️",
                    body=f"{doc_name} will not be at the chamber on {format_local(a.start_time, '%b %d')}"
                         f"{f' ({reason})' if reason else ''}. Please reschedule serial #{a.token_number}.",
                    notification_type="queue_update",
                    metadata_={"tokenNumber": a.token_number, "doctorName": doc_name, "reason": reason},
                )
            )
        if affected:
            try:
                await self.db.commit()
            except Exception:
                # Notifications are best-effort; the exception itself is already saved
                await self.db.rollback()

    async def bulk_generate_slots(self, doctor_id: uuid.UUID, data: BulkGenerateRequest) -> BulkGenerateResponse:
        doctor = await self._get_doctor(doctor_id)
        loc = await self._require_own_location(doctor_id, data.location_id)
        facility_name = loc.facility_name if loc else doctor.facility_name

        st = _parse_wall_clock(data.start_time)
        et = _parse_wall_clock(data.end_time)
        days_of_week = sorted(set(data.days_of_week))

        # Slots per day mirrors the generator: each slot needs `duration`, buffers sit between slots
        shift_minutes = (et.hour * 60 + et.minute) - (st.hour * 60 + st.minute)
        interval = data.slot_duration_minutes + data.buffer_minutes
        slots_per_day = 0
        if shift_minutes >= data.slot_duration_minutes:
            slots_per_day = (shift_minutes - data.slot_duration_minutes) // interval + 1

        # Cleanly replace shifts for the selected days and location
        delete_conditions = [
            Availability.doctor_id == doctor_id,
            Availability.day_of_week.in_(days_of_week)
        ]
        if data.location_id is not None:
            delete_conditions.append(Availability.location_id == data.location_id)

        await self.db.execute(delete(Availability).where(and_(*delete_conditions)))

        for day in days_of_week:
            self.db.add(
                Availability(
                    doctor_id=doctor_id,
                    location_id=data.location_id,
                    day_of_week=day,
                    start_time=st,
                    end_time=et,
                    slot_duration_minutes=data.slot_duration_minutes,
                    buffer_minutes=data.buffer_minutes,
                    is_active=True
                )
            )

        await self.db.commit()

        # Count working days in range, honouring blocked holiday exceptions
        blocked_dates: set[date] = set()
        if data.apply_holidays:
            exc_res = await self.db.execute(
                select(AvailabilityException.exception_date).where(
                    and_(
                        AvailabilityException.doctor_id == doctor_id,
                        AvailabilityException.is_available.is_(False),
                        AvailabilityException.exception_date >= data.start_date,
                        AvailabilityException.exception_date <= data.end_date,
                    )
                )
            )
            blocked_dates = set(exc_res.scalars().all())

        current_date = data.start_date
        total_working_days = 0
        total_holidays_skipped = 0
        total_slots = 0

        while current_date <= data.end_date:
            if _dow(current_date) in days_of_week and current_date not in blocked_dates:
                total_working_days += 1
                total_slots += slots_per_day
            else:
                total_holidays_skipped += 1
            current_date += timedelta(days=1)

        return BulkGenerateResponse(
            total_slots_created=total_slots,
            date_range=f"{data.start_date.isoformat()} to {data.end_date.isoformat()}",
            working_days_count=total_working_days,
            holidays_skipped=total_holidays_skipped,
            slots_per_day=slots_per_day,
            location_id=data.location_id,
            facility_name=facility_name,
            message=f"{total_slots} slots successfully generated for {facility_name} across {total_working_days} working days."
        )

    def _shift_read(self, s: Availability, facility_name: Optional[str], chamber_room: Optional[str]) -> ChamberShiftRead:
        return ChamberShiftRead(
            id=s.id,
            doctor_id=s.doctor_id,
            location_id=s.location_id,
            facility_name=facility_name,
            chamber_room=chamber_room,
            day_of_week=s.day_of_week,
            day_name=self.DAY_NAMES.get(s.day_of_week, "Unknown"),
            start_time=s.start_time.strftime("%H:%M"),
            end_time=s.end_time.strftime("%H:%M"),
            slot_duration_minutes=s.slot_duration_minutes,
            buffer_minutes=s.buffer_minutes,
            is_active=s.is_active,
        )

    async def list_shifts(self, doctor_id: uuid.UUID, location_id: uuid.UUID | None = None) -> List[ChamberShiftRead]:
        doctor = await self._get_doctor(doctor_id)
        loc_map = await self._location_map(doctor_id)

        query = select(Availability).where(
            and_(
                Availability.doctor_id == doctor_id,
                Availability.is_active.is_(True)
            )
        )
        if location_id is not None:
            query = query.where(Availability.location_id == location_id)

        query = query.order_by(Availability.day_of_week, Availability.start_time)
        result = await self.db.execute(query)

        items = []
        for s in result.scalars().all():
            loc = loc_map.get(s.location_id) if s.location_id else None
            items.append(
                self._shift_read(
                    s,
                    loc.facility_name if loc else doctor.facility_name,
                    loc.chamber_room if loc else doctor.chamber_room,
                )
            )
        return items

    async def add_chamber_shifts(self, doctor_id: uuid.UUID, data: ChamberShiftCreate) -> List[ChamberShiftRead]:
        doctor = await self._get_doctor(doctor_id)
        loc = await self._require_own_location(doctor_id, data.location_id)
        facility_name = loc.facility_name if loc else doctor.facility_name
        chamber_room = loc.chamber_room if loc else doctor.chamber_room

        st = _parse_wall_clock(data.start_time)
        et = _parse_wall_clock(data.end_time)

        created_shifts = []
        for day in sorted(set(data.days_of_week)):
            location_filter = (
                Availability.location_id.is_(None) if data.location_id is None
                else Availability.location_id == data.location_id
            )
            existing = await self.db.execute(
                select(Availability).where(
                    and_(
                        Availability.doctor_id == doctor_id,
                        location_filter,
                        Availability.day_of_week == day,
                        Availability.start_time == st,
                        Availability.end_time == et,
                    )
                )
            )
            avail = existing.scalars().first()
            if avail:
                avail.slot_duration_minutes = data.slot_duration_minutes
                avail.buffer_minutes = data.buffer_minutes
                avail.is_active = data.is_active
            else:
                avail = Availability(
                    doctor_id=doctor_id,
                    location_id=data.location_id,
                    day_of_week=day,
                    start_time=st,
                    end_time=et,
                    slot_duration_minutes=data.slot_duration_minutes,
                    buffer_minutes=data.buffer_minutes,
                    is_active=data.is_active,
                )
                self.db.add(avail)
            created_shifts.append(avail)

        await self.db.commit()

        result_items = []
        for s in created_shifts:
            await self.db.refresh(s)
            result_items.append(self._shift_read(s, facility_name, chamber_room))
        return result_items

    async def delete_shift(self, doctor_id: uuid.UUID, shift_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            select(Availability).where(
                and_(
                    Availability.id == shift_id,
                    Availability.doctor_id == doctor_id
                )
            )
        )
        shift = result.scalar_one_or_none()
        if not shift:
            raise NotFoundException("Chamber shift not found")
        await self.db.delete(shift)
        await self.db.commit()
        return True

    async def get_multi_day_schedule(
        self,
        doctor_id: uuid.UUID,
        from_date: date | None = None,
        days_count: int = 14,
        location_id: uuid.UUID | None = None
    ) -> DoctorMultiDayScheduleResponse:
        # 1. Verify doctor exists and load chamber metadata
        doctor = await self._get_doctor(doctor_id)
        loc_map = await self._location_map(doctor_id)

        target_loc = loc_map.get(location_id) if location_id else None
        facility_name = target_loc.facility_name if target_loc else (doctor.facility_name or "Main Medical Chamber")
        chamber_room = target_loc.chamber_room if target_loc else doctor.chamber_room
        fee = float(doctor.consultation_fee) if doctor.consultation_fee is not None else 1000.0

        # 2. Date range calculation (Asia/Dhaka)
        now_utc = datetime.now(timezone.utc)
        today_local = now_utc.astimezone(DHAKA_TZ).date()
        start_date = from_date or today_local
        end_date = start_date + timedelta(days=days_count)

        # 3. Active recurring shifts; chamber-specific shifts win, else general ones
        all_shifts = await self._active_shifts(doctor_id, loc_map)
        if location_id:
            shifts = [s for s in all_shifts if s.location_id == location_id]
            if not shifts:
                shifts = [s for s in all_shifts if s.location_id is None]
        else:
            shifts = all_shifts

        has_custom_shifts = len(shifts) > 0
        shifts_by_dow: dict[int, list[Availability]] = {}
        for s in shifts:
            shifts_by_dow.setdefault(s.day_of_week, []).append(s)

        # Compute general sitting days & hours summary
        if has_custom_shifts:
            active_dows = sorted(shifts_by_dow.keys())
            sitting_days = [self.DAY_NAMES[d] for d in active_dows]
            sitting_days_bn = [self.DAY_NAMES_BN[d] for d in active_dows]
            first_shift = shifts[0]
            sitting_hours = f"{first_shift.start_time.strftime('%I:%M %p')} - {first_shift.end_time.strftime('%I:%M %p')}"
        else:
            active_dows = DEFAULT_SITTING_DAYS
            sitting_days = [self.DAY_NAMES[d] for d in active_dows]
            sitting_days_bn = [self.DAY_NAMES_BN[d] for d in active_dows]
            sitting_hours = f"{DEFAULT_SHIFT_START.strftime('%I:%M %p')} - {DEFAULT_SHIFT_END.strftime('%I:%M %p')}"

        # 4. Load all exceptions in the date range
        exc_res = await self.db.execute(
            select(AvailabilityException).where(
                and_(
                    AvailabilityException.doctor_id == doctor_id,
                    AvailabilityException.exception_date >= start_date,
                    AvailabilityException.exception_date < end_date,
                )
            )
        )
        exceptions_by_date = {e.exception_date: e for e in exc_res.scalars().all()}

        # 5. Load all booked intervals across the window (full Dhaka days) in one batch
        window_start_utc, _ = dhaka_day_bounds_utc(start_date)
        _, window_end_utc = dhaka_day_bounds_utc(end_date - timedelta(days=1))
        booked_ranges = await self._booked_ranges(doctor_id, window_start_utc, window_end_utc)

        # 6. Build day-by-day availability summary
        days_summary: list[DayScheduleSummary] = []
        next_available_date = None
        next_available_slot = None

        for day_offset in range(days_count):
            cur_date = start_date + timedelta(days=day_offset)
            dow = _dow(cur_date)
            base = dict(
                date=cur_date.isoformat(),
                day_of_week=dow,
                day_name=self.DAY_NAMES.get(dow, "Unknown"),
                day_name_bn=self.DAY_NAMES_BN.get(dow, "অজানা"),
                formatted_date=cur_date.strftime("%b %d"),
                is_today=(cur_date == today_local),
            )

            exc = exceptions_by_date.get(cur_date)
            if exc and not exc.is_available:
                day_shifts: list[Availability] = []
                timing = exc.reason or "Clinic Holiday"
            elif has_custom_shifts:
                day_shifts = shifts_by_dow.get(dow, [])
                timing = (
                    f"{day_shifts[0].start_time.strftime('%I:%M %p')} - {day_shifts[0].end_time.strftime('%I:%M %p')}"
                    if day_shifts else "Doctor Off"
                )
            elif dow in active_dows:
                day_shifts = [self._default_shift(doctor_id, dow, location_id)]
                timing = sitting_hours
            else:
                day_shifts = []
                timing = "Doctor Off"

            if not day_shifts:
                days_summary.append(
                    DayScheduleSummary(
                        **base,
                        has_shift=False,
                        chamber_timing=timing,
                        total_slots=0,
                        available_slots_count=0,
                        is_full=False,
                        available_count=0,
                        status="off",
                        slots=[],
                    )
                )
                continue

            day_slots = self._build_slots(
                cur_date, day_shifts, booked_ranges, now_utc,
                loc_map, location_id, facility_name, chamber_room,
            )
            avail_count = sum(1 for slot in day_slots if slot.is_available)
            if next_available_slot is None:
                first_free = next((slot for slot in day_slots if slot.is_available), None)
                if first_free:
                    next_available_slot = first_free
                    next_available_date = cur_date.isoformat()

            days_summary.append(
                DayScheduleSummary(
                    **base,
                    has_shift=True,
                    chamber_timing=timing,
                    total_slots=len(day_slots),
                    available_slots_count=avail_count,
                    is_full=(avail_count == 0),
                    available_count=avail_count,
                    status="available" if avail_count > 0 else "full",
                    slots=day_slots,
                )
            )

        return DoctorMultiDayScheduleResponse(
            doctor_id=doctor_id,
            location_id=location_id,
            facility_name=facility_name,
            chamber_room=chamber_room,
            consultation_fee=fee,
            sitting_days=sitting_days,
            sitting_days_bn=sitting_days_bn,
            sitting_hours=sitting_hours,
            next_available_date=next_available_date,
            next_available_slot=next_available_slot,
            days=days_summary
        )
