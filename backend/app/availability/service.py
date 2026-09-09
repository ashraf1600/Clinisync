import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, or_, func
from app.availability.models import Availability, AvailabilityException
from app.availability.schemas import (
    DoctorDayAvailabilityResponse, TimeSlot, ShiftItem,
    RecurringShiftsUpdateRequest, ExceptionCreateRequest, ExceptionRead,
    BulkGenerateRequest, BulkGenerateResponse, ChamberShiftRead, ChamberShiftCreate,
    DayScheduleSummary, DoctorMultiDayScheduleResponse
)
from app.doctors.models import Doctor
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException

def to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


try:
    from zoneinfo import ZoneInfo
    DHAKA_TZ = ZoneInfo("Asia/Dhaka")
except Exception:
    # Fallback for minimal containers without tzdata: fixed UTC+6 (no DST in Bangladesh)
    DHAKA_TZ = timezone(timedelta(hours=6))


def dhaka_wall_to_utc(target_date: date, t: time) -> datetime:
    """Interpret a chamber wall-clock TIME on a Dhaka calendar date as UTC.

    Chamber shift hours (e.g. 17:00-21:00) are stored as local wall-clock times.
    The API contract returns UTC ISO timestamps, so convert Dhaka -> UTC here.
    """
    local_dt = datetime(
        target_date.year, target_date.month, target_date.day,
        t.hour, t.minute, t.second, tzinfo=DHAKA_TZ,
    )
    return local_dt.astimezone(timezone.utc)


def dhaka_day_bounds_utc(target_date: date) -> tuple[datetime, datetime]:
    """UTC window covering one full Dhaka calendar day [00:00, next 00:00)."""
    start_local = datetime(
        target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=DHAKA_TZ
    )
    start_utc = start_local.astimezone(timezone.utc)
    return start_utc, start_utc + timedelta(days=1)

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

    async def get_slots_for_date(self, doctor_id: uuid.UUID, target_date: date, location_id: uuid.UUID | None = None) -> DoctorDayAvailabilityResponse:
        # 1. Verify doctor exists
        from app.doctors.models import DoctorLocation
        doc_res = await self.db.execute(select(Doctor).where(Doctor.id == doctor_id))
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundException(f"Doctor '{doctor_id}' not found")

        # Load locations mapping
        locs_res = await self.db.execute(select(DoctorLocation).where(DoctorLocation.doctor_id == doctor_id))
        locations_list = locs_res.scalars().all()
        loc_map = {loc.id: loc for loc in locations_list}

        target_location_name = loc_map[location_id].facility_name if (location_id and location_id in loc_map) else doctor.facility_name

        # 2. Check for date exceptions (e.g. holiday or off day)
        exception = None
        try:
            exc_res = await self.db.execute(
                select(AvailabilityException).where(
                    and_(
                        AvailabilityException.doctor_id == doctor_id,
                        AvailabilityException.exception_date == target_date
                    )
                )
            )
            exception = exc_res.scalar_one_or_none()
        except Exception:
            exception = None
        if exception and not exception.is_available:
            # Entire day is blocked
            return DoctorDayAvailabilityResponse(
                doctor_id=doctor_id,
                date=target_date.isoformat(),
                location_id=location_id,
                facility_name=target_location_name,
                slot_duration_minutes=30,
                buffer_minutes=10,
                slots=[]
            )

        # 3. Find recurring shift for this day of week
        # Python weekday: Monday=0, Sunday=6 -> PostgreSQL standard: Sunday=0, Monday=1, ..., Saturday=6
        py_weekday = target_date.weekday()
        day_of_week = (py_weekday + 1) % 7

        shift_query = select(Availability).where(
            and_(
                Availability.doctor_id == doctor_id,
                Availability.day_of_week == day_of_week,
                Availability.is_active == True
            )
        )
        if location_id:
            shift_query = shift_query.where(or_(Availability.location_id == location_id, Availability.location_id == None))

        avail_res = await self.db.execute(shift_query)
        shifts = avail_res.scalars().all()

        # 4. Fetch booked appointments for this doctor on this day
        # Use Dhaka-day boundaries so appointments are matched to the local calendar date
        from app.appointments.models import Appointment
        start_of_day, end_of_day = dhaka_day_bounds_utc(target_date)

        appts_query = select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.status.in_(["pending", "confirmed", "completed"]),
                Appointment.start_time >= start_of_day,
                Appointment.start_time < end_of_day,
            )
        )
        if location_id:
            appts_query = appts_query.where(or_(Appointment.location_id == location_id, Appointment.location_id == None))

        appts_res = await self.db.execute(appts_query)
        booked_appts = appts_res.scalars().all()
        booked_ranges = [(a.start_time, a.end_time) for a in booked_appts]

        # 5. Generate slots across shifts (or default shift if none stored)
        generated_slots: List[TimeSlot] = []
        primary_duration = 30
        primary_buffer = 10

        effective_shifts = list(shifts)
        if not effective_shifts:
            # Check if doctor has any active shifts configured at all
            all_shifts_count = await self.db.scalar(
                select(func.count(Availability.id)).where(
                    and_(
                        Availability.doctor_id == doctor_id,
                        Availability.is_active == True
                    )
                )
            )
            # If the doctor has configured shifts, but none for this day/location, return empty slots
            if all_shifts_count and all_shifts_count > 0:
                return DoctorDayAvailabilityResponse(
                    doctor_id=doctor_id,
                    date=target_date.isoformat(),
                    location_id=location_id,
                    facility_name=target_location_name,
                    slot_duration_minutes=30,
                    buffer_minutes=10,
                    slots=[]
                )

            # Generate sensible default 12-slot shift (17:00 - 21:00 Dhaka) only for unconfigured/demo doctors
            default_start = time(17, 0)
            default_end = time(21, 0)
            current_time = dhaka_wall_to_utc(target_date, default_start)
            shift_end_dt = dhaka_wall_to_utc(target_date, default_end)

            while current_time + timedelta(minutes=30) <= shift_end_dt:
                slot_end = current_time + timedelta(minutes=30)
                is_available = True
                for b_start, b_end in booked_ranges:
                    if max(to_utc(current_time), to_utc(b_start)) < min(to_utc(slot_end), to_utc(b_end)):
                        is_available = False
                        break

                generated_slots.append(
                    TimeSlot(
                        start_time=current_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        end_time=slot_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        is_available=is_available,
                        location_id=location_id,
                        facility_name=target_location_name,
                        chamber_room=doctor.chamber_room
                    )
                )
                current_time = slot_end + timedelta(minutes=10)
        else:
            for shift in effective_shifts:
                primary_duration = shift.slot_duration_minutes
                primary_buffer = shift.buffer_minutes
                current_time = dhaka_wall_to_utc(target_date, shift.start_time)
                shift_end_dt = dhaka_wall_to_utc(target_date, shift.end_time)
                shift_loc = loc_map.get(shift.location_id) if shift.location_id else None
                loc_name = shift_loc.facility_name if shift_loc else doctor.facility_name
                loc_room = shift_loc.chamber_room if shift_loc else doctor.chamber_room

                while current_time + timedelta(minutes=shift.slot_duration_minutes) <= shift_end_dt:
                    slot_end = current_time + timedelta(minutes=shift.slot_duration_minutes)
                    
                    # Check collision with existing booked appointments
                    is_available = True
                    for b_start, b_end in booked_ranges:
                        if max(to_utc(current_time), to_utc(b_start)) < min(to_utc(slot_end), to_utc(b_end)):
                            is_available = False
                            break

                    generated_slots.append(
                        TimeSlot(
                            start_time=current_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                            end_time=slot_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                            is_available=is_available,
                            location_id=shift.location_id or location_id,
                            facility_name=loc_name,
                            chamber_room=loc_room
                        )
                    )

                    current_time = slot_end + timedelta(minutes=shift.buffer_minutes)

        return DoctorDayAvailabilityResponse(
            doctor_id=doctor_id,
            date=target_date.isoformat(),
            location_id=location_id,
            facility_name=target_location_name,
            slot_duration_minutes=primary_duration,
            buffer_minutes=primary_buffer,
            slots=generated_slots
        )

    async def set_recurring_shifts(self, doctor_id: uuid.UUID, shifts: List[ShiftItem]):
        # Clear existing shifts for matching locations or all if none
        await self.db.execute(delete(Availability).where(Availability.doctor_id == doctor_id))
        
        for s in shifts:
            start_parts = [int(p) for p in s.start_time.split(":")]
            end_parts = [int(p) for p in s.end_time.split(":")]
            avail = Availability(
                doctor_id=doctor_id,
                location_id=s.location_id,
                day_of_week=s.day_of_week,
                start_time=time(start_parts[0], start_parts[1]),
                end_time=time(end_parts[0], end_parts[1]),
                slot_duration_minutes=s.slot_duration_minutes,
                buffer_minutes=s.buffer_minutes,
                is_active=True
            )
            self.db.add(avail)
        await self.db.commit()

    async def add_exception(self, doctor_id: uuid.UUID, data: ExceptionCreateRequest) -> ExceptionRead:
        # Check existing
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
        return ExceptionRead(
            id=exc.id,
            doctor_id=exc.doctor_id,
            exception_date=exc.exception_date,
            is_available=exc.is_available,
            reason=exc.reason,
            created_at=exc.created_at
        )

    async def bulk_generate_slots(self, doctor_id: uuid.UUID, data: BulkGenerateRequest) -> BulkGenerateResponse:
        from app.doctors.models import DoctorLocation
        
        # Verify doctor and location
        doc_res = await self.db.execute(select(Doctor).where(Doctor.id == doctor_id))
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundException(f"Doctor '{doctor_id}' not found")

        facility_name = doctor.facility_name
        if data.location_id:
            loc_res = await self.db.execute(select(DoctorLocation).where(DoctorLocation.id == data.location_id))
            loc = loc_res.scalar_one_or_none()
            if loc:
                facility_name = loc.facility_name

        # Calculate slots per day
        s_h, s_m = [int(x) for x in data.start_time.split(":")]
        e_h, e_m = [int(x) for x in data.end_time.split(":")]
        shift_minutes = (e_h * 60 + e_m) - (s_h * 60 + s_m)
        interval = data.slot_duration_minutes + data.buffer_minutes
        slots_per_day = shift_minutes // interval if interval > 0 else 0

        # Cleanly replace shifts for the selected days and location
        delete_conditions = [
            Availability.doctor_id == doctor_id,
            Availability.day_of_week.in_(data.days_of_week)
        ]
        if data.location_id is not None:
            delete_conditions.append(Availability.location_id == data.location_id)
        
        await self.db.execute(delete(Availability).where(and_(*delete_conditions)))

        for day in data.days_of_week:
            new_shift = Availability(
                doctor_id=doctor_id,
                location_id=data.location_id,
                day_of_week=day,
                start_time=time(s_h, s_m),
                end_time=time(e_h, e_m),
                slot_duration_minutes=data.slot_duration_minutes,
                buffer_minutes=data.buffer_minutes,
                is_active=True
            )
            self.db.add(new_shift)

        await self.db.commit()

        current_date = data.start_date
        total_working_days = 0
        total_holidays_skipped = 0
        total_slots = 0

        while current_date <= data.end_date:
            py_weekday = current_date.weekday()
            day_of_week = (py_weekday + 1) % 7

            if day_of_week in data.days_of_week:
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

    DAY_NAMES = {
        0: "Sunday",
        1: "Monday",
        2: "Tuesday",
        3: "Wednesday",
        4: "Thursday",
        5: "Friday",
        6: "Saturday",
    }

    async def list_shifts(self, doctor_id: uuid.UUID, location_id: uuid.UUID | None = None) -> List[ChamberShiftRead]:
        from app.doctors.models import DoctorLocation
        doc_res = await self.db.execute(select(Doctor).where(Doctor.id == doctor_id))
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundException(f"Doctor '{doctor_id}' not found")

        locs_res = await self.db.execute(select(DoctorLocation).where(DoctorLocation.doctor_id == doctor_id))
        locations = locs_res.scalars().all()
        loc_map = {loc.id: loc for loc in locations}

        query = select(Availability).where(
            and_(
                Availability.doctor_id == doctor_id,
                Availability.is_active == True
            )
        )
        if location_id is not None:
            query = query.where(Availability.location_id == location_id)

        query = query.order_by(Availability.day_of_week, Availability.start_time)
        result = await self.db.execute(query)
        shifts = result.scalars().all()

        items = []
        for s in shifts:
            loc = loc_map.get(s.location_id) if s.location_id else None
            fac_name = loc.facility_name if loc else doctor.facility_name
            room_name = loc.chamber_room if loc else doctor.chamber_room
            items.append(
                ChamberShiftRead(
                    id=s.id,
                    doctor_id=s.doctor_id,
                    location_id=s.location_id,
                    facility_name=fac_name,
                    chamber_room=room_name,
                    day_of_week=s.day_of_week,
                    day_name=self.DAY_NAMES.get(s.day_of_week, "Unknown"),
                    start_time=s.start_time.strftime("%H:%M"),
                    end_time=s.end_time.strftime("%H:%M"),
                    slot_duration_minutes=s.slot_duration_minutes,
                    buffer_minutes=s.buffer_minutes,
                    is_active=s.is_active,
                )
            )
        return items

    async def add_chamber_shifts(self, doctor_id: uuid.UUID, data: ChamberShiftCreate) -> List[ChamberShiftRead]:
        from app.doctors.models import DoctorLocation
        doc_res = await self.db.execute(select(Doctor).where(Doctor.id == doctor_id))
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundException(f"Doctor '{doctor_id}' not found")

        facility_name = doctor.facility_name
        chamber_room = doctor.chamber_room
        if data.location_id is not None:
            loc_res = await self.db.execute(
                select(DoctorLocation).where(
                    DoctorLocation.id == data.location_id,
                    DoctorLocation.doctor_id == doctor_id
                )
            )
            loc = loc_res.scalar_one_or_none()
            if not loc:
                raise NotFoundException(f"Chamber location '{data.location_id}' not found for this doctor")
            facility_name = loc.facility_name
            chamber_room = loc.chamber_room

        # Parse times
        s_parts = [int(p) for p in data.start_time.split(":")]
        e_parts = [int(p) for p in data.end_time.split(":")]
        st = time(s_parts[0], s_parts[1])
        et = time(e_parts[0], e_parts[1])
        if st >= et:
            raise BadRequestException("Start time must be before end time")

        created_shifts = []
        for day in data.days_of_week:
            if day < 0 or day > 6:
                raise BadRequestException("Day of week must be between 0 (Sun) and 6 (Sat)")

            existing = await self.db.execute(
                select(Availability).where(
                    and_(
                        Availability.doctor_id == doctor_id,
                        Availability.location_id == data.location_id,
                        Availability.day_of_week == day,
                        Availability.start_time == st,
                        Availability.end_time == et,
                    )
                )
            )
            avail = existing.scalar_one_or_none()
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
            result_items.append(
                ChamberShiftRead(
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
            )
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
        from app.doctors.models import Doctor, DoctorLocation
        from app.appointments.models import Appointment

        # 1. Verify doctor exists and load chamber metadata
        doc_res = await self.db.execute(select(Doctor).where(Doctor.id == doctor_id))
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundException(f"Doctor '{doctor_id}' not found")

        locs_res = await self.db.execute(select(DoctorLocation).where(DoctorLocation.doctor_id == doctor_id))
        locations_list = locs_res.scalars().all()
        loc_map = {loc.id: loc for loc in locations_list}

        target_loc = loc_map.get(location_id) if location_id else None
        facility_name = target_loc.facility_name if target_loc else (doctor.facility_name or "Main Medical Chamber")
        chamber_room = target_loc.chamber_room if target_loc else doctor.chamber_room
        fee = float(doctor.consultation_fee) if doctor.consultation_fee else 1000.0

        # 2. Date range calculation (Asia/Dhaka UTC+6)
        dhaka_tz = timezone(timedelta(hours=6))
        now_local = datetime.now(dhaka_tz)
        start_date = from_date or now_local.date()
        end_date = start_date + timedelta(days=days_count)

        # 3. Load active recurring shifts strictly for this doctor and chamber location
        if location_id:
            shift_query = select(Availability).where(
                and_(
                    Availability.doctor_id == doctor_id,
                    Availability.location_id == location_id,
                    Availability.is_active == True
                )
            )
            shifts_res = await self.db.execute(shift_query)
            shifts = shifts_res.scalars().all()
            if not shifts:
                # If no shifts tied specifically to this location ID, fallback to general shifts
                shift_query = select(Availability).where(
                    and_(
                        Availability.doctor_id == doctor_id,
                        Availability.location_id == None,
                        Availability.is_active == True
                    )
                )
                shifts_res = await self.db.execute(shift_query)
                shifts = shifts_res.scalars().all()
        else:
            shift_query = select(Availability).where(
                and_(
                    Availability.doctor_id == doctor_id,
                    Availability.is_active == True
                )
            )
            shifts_res = await self.db.execute(shift_query)
            shifts = shifts_res.scalars().all()

        has_custom_shifts = len(shifts) > 0
        shifts_by_dow: dict[int, list[Availability]] = {}
        if has_custom_shifts:
            for s in shifts:
                shifts_by_dow.setdefault(s.day_of_week, []).append(s)

        # Compute general sitting days & hours summary
        if has_custom_shifts:
            active_dows = sorted(list(shifts_by_dow.keys()))
            sitting_days = [self.DAY_NAMES[d] for d in active_dows if d in self.DAY_NAMES]
            sitting_days_bn = [self.DAY_NAMES_BN[d] for d in active_dows if d in self.DAY_NAMES_BN]
            first_shift = shifts[0]
            sitting_hours = f"{first_shift.start_time.strftime('%I:%M %p')} - {first_shift.end_time.strftime('%I:%M %p')}"
        else:
            # Default doctor chamber practice: Saturday to Thursday (17:00 - 21:00)
            active_dows = [6, 0, 1, 2, 3, 4]
            sitting_days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
            sitting_days_bn = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"]
            sitting_hours = "05:00 PM - 09:00 PM"

        # 4. Load all exceptions in the date range
        exceptions_by_date = {}
        try:
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
        except Exception:
            exceptions_by_date = {}

        # 5. Load all booked appointments across the window in a single batch
        # Window covers full Dhaka calendar days (converted to UTC) so local-day
        # appointments are never missed at the UTC midnight boundary.
        day_start_utc, _ = dhaka_day_bounds_utc(start_date)
        _, day_after_end_utc = dhaka_day_bounds_utc(end_date - timedelta(days=1))
        start_dt_utc = day_start_utc
        end_dt_utc = day_after_end_utc - timedelta(seconds=1)

        appts_query = select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.status.in_(["pending", "confirmed", "completed"]),
                Appointment.start_time >= start_dt_utc,
                Appointment.start_time <= end_dt_utc,
            )
        )
        if location_id:
            appts_query = appts_query.where(or_(Appointment.location_id == location_id, Appointment.location_id == None))

        appts_res = await self.db.execute(appts_query)
        booked_appts = appts_res.scalars().all()
        booked_ranges = [(a.start_time, a.end_time) for a in booked_appts]

        # 6. Build day-by-day availability summary
        days_summary: list[DayScheduleSummary] = []
        next_available_date = None
        next_available_slot = None

        for day_offset in range(days_count):
            cur_date = start_date + timedelta(days=day_offset)
            py_weekday = cur_date.weekday()
            dow = (py_weekday + 1) % 7
            day_name = self.DAY_NAMES.get(dow, "Unknown")
            day_name_bn = self.DAY_NAMES_BN.get(dow, "অজানা")
            formatted_date = cur_date.strftime("%b %d")
            is_today = (cur_date == now_local.date())

            # Check if doctor marked this day as off/holiday exception
            exc = exceptions_by_date.get(cur_date)
            if exc and not exc.is_available:
                days_summary.append(
                    DayScheduleSummary(
                        date=cur_date.isoformat(),
                        day_of_week=dow,
                        day_name=day_name,
                        day_name_bn=day_name_bn,
                        formatted_date=formatted_date,
                        is_today=is_today,
                        has_shift=False,
                        chamber_timing=exc.reason or "Clinic Holiday",
                        total_slots=0,
                        available_slots_count=0,
                        is_full=False,
                        slots=[]
                    )
                )
                continue

            # Determine shifts for this day
            day_shifts = shifts_by_dow.get(dow, [])
            if not has_custom_shifts and dow in active_dows:
                default_start = time(17, 0)
                default_end = time(21, 0)
                cur_timing = "05:00 PM - 09:00 PM"
                effective_day_shifts = [
                    Availability(
                        doctor_id=doctor_id,
                        location_id=location_id,
                        day_of_week=dow,
                        start_time=default_start,
                        end_time=default_end,
                        slot_duration_minutes=30,
                        buffer_minutes=10,
                        is_active=True
                    )
                ]
            else:
                effective_day_shifts = day_shifts
                if effective_day_shifts:
                    cur_timing = f"{effective_day_shifts[0].start_time.strftime('%I:%M %p')} - {effective_day_shifts[0].end_time.strftime('%I:%M %p')}"
                else:
                    cur_timing = None

            if not effective_day_shifts:
                days_summary.append(
                    DayScheduleSummary(
                        date=cur_date.isoformat(),
                        day_of_week=dow,
                        day_name=day_name,
                        day_name_bn=day_name_bn,
                        formatted_date=formatted_date,
                        is_today=is_today,
                        has_shift=False,
                        chamber_timing="Doctor Off",
                        total_slots=0,
                        available_slots_count=0,
                        is_full=False,
                        slots=[]
                    )
                )
                continue

            # Generate individual time slots for this day
            # Shift TIME values are Dhaka wall-clock; convert to UTC for the API response
            day_slots: list[TimeSlot] = []
            for s in effective_day_shifts:
                cur_slot_time = dhaka_wall_to_utc(cur_date, s.start_time)
                shift_end_dt = dhaka_wall_to_utc(cur_date, s.end_time)
                dur = s.slot_duration_minutes or 30
                buf = s.buffer_minutes or 10

                s_loc = loc_map.get(s.location_id) if s.location_id else target_loc
                s_loc_name = s_loc.facility_name if s_loc else facility_name
                s_loc_room = s_loc.chamber_room if s_loc else chamber_room

                while cur_slot_time + timedelta(minutes=dur) <= shift_end_dt:
                    slot_end = cur_slot_time + timedelta(minutes=dur)

                    # Collision check against existing appointments
                    is_collided = False
                    for b_start, b_end in booked_ranges:
                        if max(to_utc(cur_slot_time), to_utc(b_start)) < min(to_utc(slot_end), to_utc(b_end)):
                            is_collided = True
                            break

                    # Past time check for same-day slots
                    is_past = False
                    if is_today:
                        slot_local = cur_slot_time.astimezone(dhaka_tz)
                        if slot_local <= now_local:
                            is_past = True

                    is_avail = (not is_collided) and (not is_past)

                    slot_obj = TimeSlot(
                        start_time=cur_slot_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        end_time=slot_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        is_available=is_avail,
                        is_past=is_past,
                        location_id=s.location_id or location_id,
                        facility_name=s_loc_name,
                        chamber_room=s_loc_room
                    )
                    day_slots.append(slot_obj)

                    # Pick earliest upcoming free slot
                    if is_avail and not next_available_slot:
                        next_available_slot = slot_obj
                        next_available_date = cur_date.isoformat()

                    cur_slot_time = slot_end + timedelta(minutes=buf)

            avail_count = sum(1 for slot in day_slots if slot.is_available)
            days_summary.append(
                DayScheduleSummary(
                    date=cur_date.isoformat(),
                    day_of_week=dow,
                    day_name=day_name,
                    day_name_bn=day_name_bn,
                    formatted_date=formatted_date,
                    is_today=is_today,
                    has_shift=True,
                    chamber_timing=cur_timing,
                    total_slots=len(day_slots),
                    available_slots_count=avail_count,
                    is_full=(avail_count == 0),
                    slots=day_slots
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

