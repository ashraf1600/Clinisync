import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, delete
from app.doctors.models import Doctor, DoctorLocation
from app.users.models import User
from app.doctors.schemas import (
    DoctorCreate, DoctorRead, DoctorListResponse, PageMeta, DoctorUpdate,
    DoctorLocationRead, DoctorLocationCreate, DoctorLocationUpdate
)
from app.core.config import settings
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException

# Content type -> (file extension, magic-byte check)
_PHOTO_TYPES = {
    "image/jpeg": (".jpg", lambda b: b[:3] == b"\xff\xd8\xff"),
    "image/png": (".png", lambda b: b[:8] == b"\x89PNG\r\n\x1a\n"),
    "image/webp": (".webp", lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP"),
}
PROFILE_PHOTO_DIR = Path(__file__).resolve().parents[2] / "uploads" / "profile_photos"

# Columns that are NOT NULL on the doctors table; an explicit null in an update is ignored
_NON_NULLABLE_FIELDS = {"specialization", "degrees", "bmdc_number", "experience_years", "consultation_fee", "followup_fee"}


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class DoctorService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, doctor_id: uuid.UUID) -> Doctor | None:
        result = await self.db.execute(select(Doctor).where(Doctor.id == doctor_id))
        return result.scalar_one_or_none()

    async def get_by_user_id(self, user_id: uuid.UUID) -> Doctor | None:
        result = await self.db.execute(select(Doctor).where(Doctor.user_id == user_id))
        return result.scalar_one_or_none()

    def to_read(self, doctor: Doctor, name: str | None = None) -> DoctorRead:
        return DoctorRead(
            id=doctor.id,
            user_id=doctor.user_id,
            name=name or (doctor.user.name if doctor.user else "Doctor"),
            specialization=doctor.specialization,
            degrees=doctor.degrees,
            bmdc_number=doctor.bmdc_number,
            designation=doctor.designation,
            facility=doctor.facility_name,
            chamber=doctor.chamber_room,
            profile_photo_url=doctor.profile_photo_url,
            bio=doctor.bio,
            consultation_fee=float(doctor.consultation_fee),
            rating=doctor.rating,
            experience_years=doctor.experience_years,
            locations=[DoctorLocationRead.model_validate(location) for location in doctor.locations],
        )

    async def list_doctors(
        self,
        specialization: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> DoctorListResponse:
        # Deactivated doctor accounts must not be listed (or booked) publicly
        query = select(Doctor).join(User, Doctor.user_id == User.id).where(User.is_active.is_(True))

        if specialization:
            query = query.where(func.lower(Doctor.specialization) == specialization.strip().lower())

        if search and search.strip():
            pattern = f"%{_escape_like(search.strip().lower())}%"
            query = query.where(
                or_(
                    func.lower(User.name).like(pattern, escape="\\"),
                    func.lower(Doctor.specialization).like(pattern, escape="\\"),
                    func.lower(Doctor.facility_name).like(pattern, escape="\\"),
                )
            )

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_res = await self.db.execute(count_query)
        total_count = total_res.scalar_one()

        # Paginate with a deterministic order so pages never overlap or skip rows
        offset = (page - 1) * page_size
        paginated_query = query.order_by(Doctor.created_at.asc(), Doctor.id.asc()).offset(offset).limit(page_size)
        results = await self.db.execute(paginated_query)
        doctors = results.unique().scalars().all()

        return DoctorListResponse(
            items=[self.to_read(d) for d in doctors],
            meta=PageMeta(page=page, page_size=page_size, total_count=total_count)
        )

    async def create(self, data: DoctorCreate) -> DoctorRead:
        # Verify user exists
        user_res = await self.db.execute(select(User).where(User.id == data.user_id))
        user = user_res.scalar_one_or_none()
        if not user:
            raise NotFoundException("User ID not found")
        if user.role == "admin":
            # Silently converting an admin would strip their admin privileges
            raise BadRequestException("Admin accounts cannot be onboarded as doctors")

        # Check if already doctor
        existing = await self.db.execute(select(Doctor).where(Doctor.user_id == data.user_id))
        if existing.scalar_one_or_none():
            raise ConflictException("A doctor profile already exists for this user")

        # Update user role to doctor if not already
        user.role = "doctor"

        doctor = Doctor(
            user_id=data.user_id,
            specialization=data.specialization,
            degrees=data.degrees,
            bmdc_number=data.bmdc_number,
            designation=data.designation,
            facility_name=data.facility_name,
            chamber_room=data.chamber_room,
            profile_photo_url=data.profile_photo_url,
            bio=data.bio,
            consultation_fee=data.consultation_fee,
            followup_fee=data.followup_fee,
            rating=data.rating,
            experience_years=data.experience_years,
        )
        self.db.add(doctor)
        locations = data.locations or [
            DoctorLocationCreate(facility_name=data.facility_name, chamber_room=data.chamber_room)
        ]
        for location_data in locations:
            self.db.add(DoctorLocation(doctor=doctor, **location_data.model_dump()))
        await self.db.commit()
        await self.db.refresh(doctor)
        return self.to_read(doctor, user.name)

    async def update(self, doctor_id: uuid.UUID, data: DoctorUpdate) -> DoctorRead:
        doctor = await self.get_by_id(doctor_id)
        if not doctor:
            raise NotFoundException("Doctor profile not found")

        updates = data.model_dump(exclude_unset=True, exclude={"name", "locations"})
        for field, value in updates.items():
            if value is None and field in _NON_NULLABLE_FIELDS:
                continue
            setattr(doctor, field, value)
        if data.name is not None and doctor.user:
            doctor.user.name = data.name.strip()
        if data.locations is not None:
            self._sync_locations(doctor, data.locations)
        await self.db.commit()
        await self.db.refresh(doctor)
        return self.to_read(doctor)

    def _sync_locations(self, doctor: Doctor, incoming: List[DoctorLocationCreate]) -> None:
        """Reconcile chambers without deleting rows.

        Deleting a chamber would null out `location_id` on its shifts (turning them
        into all-chamber shifts) and on past appointments. Instead, chambers that
        match by facility+room are updated in place, new ones are added, and the
        rest are deactivated.
        """
        def key(facility: str, room: str) -> tuple[str, str]:
            return facility.strip().lower(), room.strip().lower()

        existing = {key(loc.facility_name, loc.chamber_room): loc for loc in doctor.locations}
        seen: set[tuple[str, str]] = set()
        for item in incoming:
            k = key(item.facility_name, item.chamber_room)
            seen.add(k)
            loc = existing.get(k)
            if loc:
                for field, value in item.model_dump().items():
                    setattr(loc, field, value)
                loc.is_active = True
            else:
                doctor.locations.append(DoctorLocation(**item.model_dump()))
        for k, loc in existing.items():
            if k not in seen:
                loc.is_active = False

    async def save_profile_photo(self, doctor: Doctor, content: bytes, content_type: str | None) -> Doctor:
        spec = _PHOTO_TYPES.get(content_type or "")
        if not spec:
            raise BadRequestException("Only JPEG, PNG, and WebP images are supported")
        if not content:
            raise BadRequestException("Uploaded photo is empty")
        if len(content) > settings.MAX_PHOTO_UPLOAD_BYTES:
            raise BadRequestException(f"Photo must be at most {settings.MAX_PHOTO_UPLOAD_BYTES // (1024 * 1024)} MB")
        extension, looks_valid = spec
        if not looks_valid(content):
            # The declared content type is client-controlled; check the actual bytes
            raise BadRequestException("Uploaded file is not a valid image")

        PROFILE_PHOTO_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{doctor.id}-{uuid.uuid4().hex}{extension}"
        (PROFILE_PHOTO_DIR / filename).write_bytes(content)

        old_url = doctor.profile_photo_url
        doctor.profile_photo_url = f"/uploads/profile_photos/{filename}"
        await self.db.commit()
        await self.db.refresh(doctor)

        # Remove the replaced file so uploads do not accumulate forever
        if old_url and old_url.startswith("/uploads/profile_photos/"):
            old_path = PROFILE_PHOTO_DIR / Path(old_url).name
            try:
                old_path.unlink(missing_ok=True)
            except OSError:
                pass
        return doctor

    async def list_locations(self, doctor_id: uuid.UUID) -> List[DoctorLocation]:
        result = await self.db.execute(
            select(DoctorLocation).where(DoctorLocation.doctor_id == doctor_id)
        )
        return list(result.scalars().all())

    async def create_location(self, doctor_id: uuid.UUID, data: DoctorLocationCreate) -> DoctorLocation:
        doctor = await self.get_by_id(doctor_id)
        if not doctor:
            raise NotFoundException("Doctor profile not found")
        location = DoctorLocation(doctor_id=doctor_id, **data.model_dump())
        self.db.add(location)
        await self.db.commit()
        await self.db.refresh(location)
        return location

    async def update_location(
        self, doctor_id: uuid.UUID, location_id: uuid.UUID, data: DoctorLocationUpdate
    ) -> DoctorLocation:
        result = await self.db.execute(
            select(DoctorLocation).where(
                DoctorLocation.id == location_id,
                DoctorLocation.doctor_id == doctor_id,
            )
        )
        location = result.scalar_one_or_none()
        if not location:
            raise NotFoundException("Chamber location not found")

        updates = data.model_dump(exclude_unset=True)
        for field, value in updates.items():
            if value is None and field in ("facility_name", "chamber_room", "is_active"):
                continue
            setattr(location, field, value)

        await self.db.commit()
        await self.db.refresh(location)
        return location

    async def delete_location(self, doctor_id: uuid.UUID, location_id: uuid.UUID) -> bool:
        from app.appointments.models import Appointment
        from app.availability.models import Availability

        result = await self.db.execute(
            select(DoctorLocation).where(
                DoctorLocation.id == location_id,
                DoctorLocation.doctor_id == doctor_id,
            )
        )
        location = result.scalar_one_or_none()
        if not location:
            raise NotFoundException("Chamber location not found")

        # Patients holding upcoming bookings at this chamber would lose their venue
        upcoming = await self.db.scalar(
            select(func.count()).select_from(Appointment).where(
                Appointment.location_id == location_id,
                Appointment.status.in_(["pending", "confirmed"]),
                Appointment.start_time >= datetime.now(timezone.utc),
            )
        )
        if upcoming:
            raise ConflictException(
                f"This chamber has {upcoming} upcoming appointment(s). Deactivate it or move those bookings first."
            )

        # Its shifts must go too; FK SET NULL would otherwise turn them into all-chamber shifts
        await self.db.execute(delete(Availability).where(Availability.location_id == location_id))
        await self.db.delete(location)
        await self.db.commit()
        return True
