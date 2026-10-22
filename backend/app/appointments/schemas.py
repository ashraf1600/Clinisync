import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import Field, field_validator
from app.core.base_schema import CamelModel

VISIT_TYPES = {"new_consultation", "followup", "report_review"}
_FOLLOWUP_ALIASES = {"follow_up", "follow-up", "followup"}


def normalize_visit_type(v: Optional[str]) -> str:
    value = (v or "new_consultation").strip().lower()
    if value in _FOLLOWUP_ALIASES:
        return "followup"
    if value not in VISIT_TYPES:
        raise ValueError(f"visitType must be one of {sorted(VISIT_TYPES)}")
    return value


def parse_location_id(v):
    """Clients send "default" (or garbage) for the doctor's primary chamber."""
    if not v or v == "default" or str(v).startswith("default"):
        return None
    if isinstance(v, uuid.UUID):
        return v
    try:
        return uuid.UUID(str(v))
    except (ValueError, TypeError):
        return None


class AppointmentBookRequest(CamelModel):
    doctor_id: uuid.UUID
    location_id: Optional[uuid.UUID] = None
    start_time: datetime
    end_time: datetime
    visit_type: str = "new_consultation"
    chief_complaint: Optional[str] = Field(None, max_length=2000)

    @field_validator("location_id", mode="before")
    @classmethod
    def validate_location_id(cls, v):
        return parse_location_id(v)

    @field_validator("visit_type", mode="before")
    @classmethod
    def validate_visit_type(cls, v):
        return normalize_visit_type(v)

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
    doctor_notes: Optional[str] = None
    created_at: datetime

class AppointmentRescheduleRequest(CamelModel):
    new_start_time: datetime
    new_end_time: datetime

class AppointmentCancelRequest(CamelModel):
    reason: Optional[str] = Field("Patient requested cancellation", max_length=255)

class AppointmentStatusUpdateRequest(CamelModel):
    status: str = Field(..., pattern="^(pending|confirmed|completed|cancelled|no_show)$")
    doctor_notes: Optional[str] = Field(None, max_length=5000)

class AppointmentPaymentUpdateRequest(CamelModel):
    payment_status: str = Field(..., pattern="^(pay_at_chamber|paid|waived)$")

class WalkInRequest(CamelModel):
    doctor_id: uuid.UUID
    location_id: Optional[uuid.UUID] = None
    patient_name: str = Field(..., min_length=2, max_length=255)
    patient_phone: Optional[str] = Field(None, max_length=20)
    start_time: datetime
    end_time: datetime
    visit_type: str = "new_consultation"
    chief_complaint: Optional[str] = Field(None, max_length=2000)

    @field_validator("location_id", mode="before")
    @classmethod
    def validate_location_id(cls, v):
        return parse_location_id(v)

    @field_validator("visit_type", mode="before")
    @classmethod
    def validate_visit_type(cls, v):
        return normalize_visit_type(v)

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

class AppointmentVerifyResponse(CamelModel):
    """Reception check-in payload for a scanned chamber-pass QR."""
    id: uuid.UUID
    token_number: int
    status: str
    valid: bool
    patient_name: str
    doctor_name: str
    specialization: str = "General"
    facility_name: Optional[str] = None
    chamber_room: Optional[str] = None
    start_time: datetime
    end_time: datetime
    payment_status: str = "pay_at_chamber"
    fee: float = 0.0

class QueuePauseRequest(CamelModel):
    pause_minutes: int = Field(5, ge=1, le=180)
    reason: Optional[str] = Field("Short clinical break / documentation", max_length=255)

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
