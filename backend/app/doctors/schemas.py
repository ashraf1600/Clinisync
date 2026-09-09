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
    specialization: str
    degrees: str = "MBBS"
    bmdc_number: str
    designation: Optional[str] = None
    facility_name: str = "Popular Diagnostic Centre"
    chamber_room: str = "Room #402, Level 4"
    profile_photo_url: Optional[str] = None
    bio: Optional[str] = None
    consultation_fee: Decimal = Decimal("1200.00")
    followup_fee: Decimal = Decimal("800.00")
    rating: float = 4.9
    experience_years: int = 15
    locations: List["DoctorLocationCreate"] = Field(default_factory=list)


class DoctorLocationCreate(CamelModel):
    facility_name: str
    branch_area: Optional[str] = None
    chamber_room: str
    address: Optional[str] = None
    contact_phone: Optional[str] = None


class DoctorLocationUpdate(CamelModel):
    facility_name: Optional[str] = None
    branch_area: Optional[str] = None
    chamber_room: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: Optional[bool] = None


class DoctorLocationRead(DoctorLocationCreate):
    id: uuid.UUID
    is_active: bool = True


class DoctorUpdate(CamelModel):
    name: Optional[str] = None
    specialization: Optional[str] = None
    degrees: Optional[str] = None
    bmdc_number: Optional[str] = None
    designation: Optional[str] = None
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    consultation_fee: Optional[Decimal] = None
    followup_fee: Optional[Decimal] = None
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
