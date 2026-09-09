import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, Text, ForeignKey, Float, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.users.models import User

class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    specialization: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    degrees: Mapped[str] = mapped_column(String(255), nullable=False, default="MBBS")
    bmdc_number: Mapped[str] = mapped_column(String(50), nullable=False, default="BMDC-PENDING")
    designation: Mapped[str | None] = mapped_column(String(150), nullable=True)
    facility_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Popular Diagnostic Centre")
    chamber_room: Mapped[str] = mapped_column(String(255), nullable=False, default="Room #402, Level 4")
    profile_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    consultation_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("1200.00"))
    followup_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("800.00"))
    rating: Mapped[float] = mapped_column(Float, nullable=False, default=4.9)
    experience_years: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user: Mapped[User] = relationship("User", lazy="joined")
    locations: Mapped[list["DoctorLocation"]] = relationship("DoctorLocation", back_populates="doctor", cascade="all, delete-orphan", lazy="selectin")


class DoctorLocation(Base):
    __tablename__ = "doctor_locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    facility_name: Mapped[str] = mapped_column(String(255), nullable=False)
    branch_area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    chamber_room: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    doctor: Mapped[Doctor] = relationship("Doctor", back_populates="locations")
