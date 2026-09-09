import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import Field, field_validator
from app.core.base_schema import CamelModel

class AppointmentBookRequest(CamelModel):
    doctor_id: uuid.UUID
    location_id: Optional[uuid.UUID] = None
    start_time: datetime
    end_time: datetime
    visit_type: str = "new_consultation"
    chief_complaint: Optional[str] = None

    @field_validator("location_id", mode="before")
    @classmethod
    def validate_location_id(cls, v):
        if not v or v == "default" or str(v).startswith("default"):
            return None
        if isinstance(v, uuid.UUID):
            return v
        try:
            return uuid.UUID(str(v))
        except (ValueError, TypeError):
            return None

class AppointmentRead(CamelModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: Optional[str] = None
    doctor_id: uuid.UUID
    location_id: Optional[uuid.UUID] = None
    doctor_name: str
    specialization: str
    facility_name: Optional[str] = None
    chamber_room: Optional[str] = None
    branch_area: Optional[str] = None
    token_number: int
    start_time: datetime
    end_time: datetime
    status: str
    payment_status: str
    fee: float
    chief_complaint: Optional[str] = None
    created_at: datetime

class AppointmentRescheduleRequest(CamelModel):
    new_start_time: datetime
    new_end_time: datetime

class AppointmentCancelRequest(CamelModel):
    reason: Optional[str] = "Patient requested cancellation"

class AppointmentStatusUpdateRequest(CamelModel):
    status: str

class DoctorQueueItem(CamelModel):
    id: uuid.UUID
    serial: int
    patient_id: uuid.UUID
    patient_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    visit_type: str
    chief_complaint: Optional[str] = None
    vitals: str = "BP: 120/80 mmHg · Pulse: 72 bpm"
    start_time: datetime
    end_time: datetime
    status: str

class DoctorQueueResponse(CamelModel):
    date: str
    doctor_id: Optional[uuid.UUID] = None
    doctor_name: Optional[str] = None
    specialization: Optional[str] = None
    facility_name: Optional[str] = None
    chamber_room: Optional[str] = None
    consultation_fee: Optional[float] = None
    total_appointments: int = 0
    current_running_serial: Optional[int] = None
    current_running_patient_name: Optional[str] = None
    waiting_count: int = 0
    completed_count: int = 0
    chamber_status: str = "IDLE"
    is_paused: bool = False
    pause_message: Optional[str] = None
    queue: List[DoctorQueueItem] = Field(default_factory=list)
    items: List[DoctorQueueItem] = Field(default_factory=list)

class QueuePauseRequest(CamelModel):
    pause_minutes: int = 5
    reason: Optional[str] = "Short clinical break / documentation"

class QueuePauseResponse(CamelModel):
    is_paused: bool = True
    chamber_status: str = "EMPTY (BREAK)"
    pause_minutes: int
    resume_at: datetime
    message: str

class QueueResumeResponse(CamelModel):
    is_paused: bool = False
    currently_serving_serial: int
    chamber_status: str = "ACTIVE"
    message: str
