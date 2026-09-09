import uuid
from datetime import datetime, date, time, timezone
from sqlalchemy import String, Integer, Boolean, Time, Date, DateTime, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class Availability(Base):
    __tablename__ = "availability"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("doctor_locations.id", ondelete="SET NULL"), nullable=True, index=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 = Sunday, 6 = Saturday
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    buffer_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="chk_day_of_week"),
        CheckConstraint("slot_duration_minutes > 0", name="chk_slot_duration"),
        CheckConstraint("buffer_minutes >= 0", name="chk_buffer_minutes"),
        CheckConstraint("start_time < end_time", name="chk_shift_time_order"),
    )

class AvailabilityException(Base):
    __tablename__ = "availability_exceptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    exception_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("doctor_id", "exception_date", name="uq_doctor_exception_date"),
    )
