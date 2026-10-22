import uuid
from datetime import date, datetime
from typing import Annotated, List, Optional
from pydantic import Field, model_validator
from app.core.base_schema import CamelModel

# Chamber wall-clock time "HH:MM" or "HH:MM:SS" (24h, Asia/Dhaka)
WallClock = Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$")]
DayOfWeek = Annotated[int, Field(ge=0, le=6)]
SlotMinutes = Annotated[int, Field(ge=5, le=240)]
BufferMinutes = Annotated[int, Field(ge=0, le=120)]


class _ShiftWindow(CamelModel):
    @model_validator(mode="after")
    def check_window(self):
        if self.start_time >= self.end_time:
            raise ValueError("startTime must be before endTime")
        return self

class TimeSlot(CamelModel):
    start_time: str
    end_time: str
    is_available: bool
    is_past: bool = False
    location_id: Optional[uuid.UUID] = None
    facility_name: Optional[str] = None
    chamber_room: Optional[str] = None

class DoctorDayAvailabilityResponse(CamelModel):
    doctor_id: uuid.UUID
    date: str
    location_id: Optional[uuid.UUID] = None
    facility_name: Optional[str] = None
    slot_duration_minutes: int
    buffer_minutes: int
    slots: List[TimeSlot]

class ShiftItem(_ShiftWindow):
    day_of_week: DayOfWeek
    start_time: WallClock
    end_time: WallClock
    location_id: Optional[uuid.UUID] = None
    facility_name: Optional[str] = None
    chamber_room: Optional[str] = None
    slot_duration_minutes: SlotMinutes = 30
    buffer_minutes: BufferMinutes = 10

class RecurringShiftsUpdateRequest(CamelModel):
    shifts: List[ShiftItem]

class ExceptionCreateRequest(CamelModel):
    exception_date: date
    is_available: bool = False
    reason: Optional[str] = Field("Weekly Clinic Holiday", max_length=255)

class ExceptionRead(CamelModel):
    id: uuid.UUID
    doctor_id: uuid.UUID
    exception_date: date
    is_available: bool
    reason: Optional[str] = None
    created_at: datetime

class BulkGenerateRequest(_ShiftWindow):
    target_range: str = "month"
    start_date: date
    end_date: date
    location_id: Optional[uuid.UUID] = None
    days_of_week: List[DayOfWeek] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 6], min_length=1)
    start_time: WallClock = "09:00"
    end_time: WallClock = "13:00"
    slot_duration_minutes: SlotMinutes = 30
    buffer_minutes: BufferMinutes = 10
    apply_holidays: bool = True

    @model_validator(mode="after")
    def check_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("endDate must be on or after startDate")
        if (self.end_date - self.start_date).days > 366:
            raise ValueError("Date range cannot exceed one year")
        return self

class BulkGenerateResponse(CamelModel):
    total_slots_created: int
    date_range: str
    working_days_count: int
    holidays_skipped: int
    slots_per_day: int
    location_id: Optional[uuid.UUID] = None
    facility_name: Optional[str] = None
    message: str

class ChamberShiftRead(CamelModel):
    id: uuid.UUID
    doctor_id: uuid.UUID
    location_id: Optional[uuid.UUID] = None
    facility_name: Optional[str] = None
    chamber_room: Optional[str] = None
    day_of_week: int
    day_name: str
    start_time: str
    end_time: str
    slot_duration_minutes: int
    buffer_minutes: int
    is_active: bool

class ChamberShiftCreate(_ShiftWindow):
    location_id: Optional[uuid.UUID] = None
    days_of_week: List[DayOfWeek] = Field(..., min_length=1)
    start_time: WallClock
    end_time: WallClock
    slot_duration_minutes: SlotMinutes = 20
    buffer_minutes: BufferMinutes = 5
    is_active: bool = True

class ChamberShiftResponse(CamelModel):
    created_shifts: List[ChamberShiftRead]
    message: str

class DayScheduleSummary(CamelModel):
    date: str
    day_of_week: int
    day_name: str
    day_name_bn: str
    formatted_date: str
    is_today: bool
    has_shift: bool
    chamber_timing: Optional[str] = None
    total_slots: int
    available_slots_count: int
    is_full: bool
    # Contract aliases (API_CONTRACT): availableCount mirrors availableSlotsCount,
    # status is "available" | "full" | "off"
    available_count: int = 0
    status: str = "off"
    slots: List[TimeSlot]

class DoctorMultiDayScheduleResponse(CamelModel):
    doctor_id: uuid.UUID
    location_id: Optional[uuid.UUID] = None
    facility_name: Optional[str] = None
    chamber_room: Optional[str] = None
    consultation_fee: float = 1000.0
    sitting_days: List[str] = Field(default_factory=list)
    sitting_days_bn: List[str] = Field(default_factory=list)
    sitting_hours: str
    next_available_date: Optional[str] = None
    next_available_slot: Optional[TimeSlot] = None
    days: List[DayScheduleSummary]

