import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, TSTZRANGE
from app.core.database import Base
from app.users.models import User
from app.doctors.models import Doctor, DoctorLocation

class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False)
    location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("doctor_locations.id", ondelete="SET NULL"), nullable=True)
    token_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    visit_type: Mapped[str] = mapped_column(String(50), nullable=False, default="new_consultation")
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="confirmed")
    payment_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pay_at_chamber")
    cancellation_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    doctor_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    reschedule_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    patient: Mapped[User] = relationship("User", foreign_keys=[patient_id], lazy="joined")
    doctor: Mapped[Doctor] = relationship("Doctor", foreign_keys=[doctor_id], lazy="joined")
    location: Mapped[DoctorLocation | None] = relationship("DoctorLocation", foreign_keys=[location_id], lazy="joined")

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')", name="chk_appointment_status"),
        CheckConstraint("payment_status IN ('pay_at_chamber', 'paid', 'waived')", name="chk_payment_status"),
        Index("idx_appointments_doctor_date", "doctor_id", "start_time"),
    )
