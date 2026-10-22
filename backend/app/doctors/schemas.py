import uuid
from decimal import Decimal
from typing import List, Optional
from pydantic import Field
from app.core.base_schema import CamelModel

class DoctorBase(CamelModel):
    specialization: str
    degrees: str = "MBBS"
    bmdc_number: str = "BMDC-PENDING"
    designation: Optional[str] = None
    facility: str = Field("Popular Diagnostic Centre", alias="facility")
    chamber: str = Field("Room #402, Level 4", alias="chamber")
    profile_photo_url: Optional[str] = None
    bio: Optional[str] = None
    consultation_fee: Decimal = Decimal("1200.00")
    followup_fee: Decimal = Decimal("800.00")

class DoctorCreate(CamelModel):
    user_id: uuid.UUID
    specialization: str = Field(..., min_length=2, max_length=100)
    degrees: str = Field("MBBS", max_length=255)
    bmdc_number: str = Field(..., min_length=1, max_length=50)
    designation: Optional[str] = Field(None, max_length=150)
    facility_name: str = Field("Popular Diagnostic Centre", min_length=1, max_length=255)
    chamber_room: str = Field("Room #402, Level 4", min_length=1, max_length=255)
    profile_photo_url: Optional[str] = None
    bio: Optional[str] = None
    consultation_fee: Decimal = Field(Decimal("1200.00"), ge=0, max_digits=10, decimal_places=2)
    followup_fee: Decimal = Field(Decimal("800.00"), ge=0, max_digits=10, decimal_places=2)
    rating: float = Field(4.9, ge=0, le=5)
    experience_years: int = Field(15, ge=0, le=80)
    locations: List["DoctorLocationCreate"] = Field(default_factory=list)


class DoctorLocationCreate(CamelModel):
    facility_name: str = Field(..., min_length=1, max_length=255)
    branch_area: Optional[str] = Field(None, max_length=255)
    chamber_room: str = Field(..., min_length=1, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    contact_phone: Optional[str] = Field(None, max_length=30)


class DoctorLocationUpdate(CamelModel):
    facility_name: Optional[str] = Field(None, min_length=1, max_length=255)
    branch_area: Optional[str] = Field(None, max_length=255)
    chamber_room: Optional[str] = Field(None, min_length=1, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    contact_phone: Optional[str] = Field(None, max_length=30)
    is_active: Optional[bool] = None


class DoctorLocationRead(DoctorLocationCreate):
    id: uuid.UUID
    is_active: bool = True


class DoctorUpdate(CamelModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    specialization: Optional[str] = Field(None, min_length=2, max_length=100)
    degrees: Optional[str] = Field(None, max_length=255)
    bmdc_number: Optional[str] = Field(None, min_length=1, max_length=50)
    designation: Optional[str] = Field(None, max_length=150)
    bio: Optional[str] = None
    experience_years: Optional[int] = Field(None, ge=0, le=80)
    consultation_fee: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    followup_fee: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    locations: Optional[List[DoctorLocationCreate]] = None

class DoctorRead(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    specialization: str
    degrees: str
    bmdc_number: str
    designation: Optional[str] = None
    facility: str
    chamber: str
    profile_photo_url: Optional[str] = None
    bio: Optional[str] = None
    consultation_fee: float
    rating: float
    experience_years: int
    locations: List[DoctorLocationRead] = Field(default_factory=list)

class PageMeta(CamelModel):
    page: int
    page_size: int
    total_count: int

class DoctorListResponse(CamelModel):
    items: List[DoctorRead]
    meta: PageMeta
