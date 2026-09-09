import uuid
from datetime import date, datetime
from typing import List, Optional
from pydantic import Field
from app.core.base_schema import CamelModel

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

class ShiftItem(CamelModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str
    end_time: str
    location_id: Optional[uuid.UUID] = None
    facility_name: Optional[str] = None
    chamber_room: Optional[str] = None
    slot_duration_minutes: int = 30
    buffer_minutes: int = 10

class RecurringShiftsUpdateRequest(CamelModel):
    shifts: List[ShiftItem]

class ExceptionCreateRequest(CamelModel):
    exception_date: date
    is_available: bool = False
    reason: Optional[str] = "Weekly Clinic Holiday"

class ExceptionRead(CamelModel):
    id: uuid.UUID
    doctor_id: uuid.UUID
    exception_date: date
    is_available: bool
    reason: Optional[str] = None
    created_at: datetime

class BulkGenerateRequest(CamelModel):
    target_range: str = "month"
    start_date: date
    end_date: date
    location_id: Optional[uuid.UUID] = None
    days_of_week: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 6])
    start_time: str = "09:00"
    end_time: str = "13:00"
    slot_duration_minutes: int = 30
    buffer_minutes: int = 10
    apply_holidays: bool = True

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

class ChamberShiftCreate(CamelModel):
    location_id: Optional[uuid.UUID] = None
    days_of_week: List[int] = Field(..., min_length=1)
    start_time: str
    end_time: str
    slot_duration_minutes: int = 20
    buffer_minutes: int = 5
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

