import uuid
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.doctors.models import Doctor, DoctorLocation
from app.users.models import User
from app.doctors.schemas import (
    DoctorCreate, DoctorRead, DoctorListResponse, PageMeta, DoctorUpdate,
    DoctorLocationRead, DoctorLocationCreate, DoctorLocationUpdate
)
from app.core.exceptions import NotFoundException, ConflictException

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
        query = select(Doctor).join(User, Doctor.user_id == User.id)

        if specialization:
            query = query.where(func.lower(Doctor.specialization) == specialization.lower())
        
        if search:
            pattern = f"%{search.lower()}%"
            query = query.where(
                or_(
                    func.lower(User.name).like(pattern),
                    func.lower(Doctor.specialization).like(pattern),
                    func.lower(Doctor.facility_name).like(pattern),
                )
            )

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_res = await self.db.execute(count_query)
        total_count = total_res.scalar_one()

        # Paginate
        offset = (page - 1) * page_size
        paginated_query = query.offset(offset).limit(page_size)
        results = await self.db.execute(paginated_query)
        doctors = results.scalars().all()

        items = []
        for d in doctors:
            items.append(
                DoctorRead(
                    id=d.id,
                    user_id=d.user_id,
                    name=d.user.name if d.user else "Doctor",
                    specialization=d.specialization,
                    degrees=d.degrees,
                    bmdc_number=d.bmdc_number,
                    designation=d.designation,
                    facility=d.facility_name,
                    chamber=d.chamber_room,
                    profile_photo_url=d.profile_photo_url,
                    bio=d.bio,
                    consultation_fee=float(d.consultation_fee),
                    rating=d.rating,
                    experience_years=d.experience_years,
                    locations=[DoctorLocationRead.model_validate(location) for location in d.locations],
                )
            )

        return DoctorListResponse(
            items=items,
            meta=PageMeta(page=page, page_size=page_size, total_count=total_count)
        )

    async def create(self, data: DoctorCreate) -> DoctorRead:
        # Verify user exists
        user_res = await self.db.execute(select(User).where(User.id == data.user_id))
        user = user_res.scalar_one_or_none()
        if not user:
            raise NotFoundException("User ID not found")
        
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
            {
                "facility_name": data.facility_name,
                "chamber_room": data.chamber_room,
            }
        ]
        for location_data in locations:
            self.db.add(DoctorLocation(doctor=doctor, **location_data.model_dump() if hasattr(location_data, "model_dump") else location_data))
        await self.db.commit()
        await self.db.refresh(doctor)
        return self.to_read(doctor, user.name)

    async def update(self, doctor_id: uuid.UUID, data: DoctorUpdate) -> DoctorRead:
        doctor = await self.get_by_id(doctor_id)
        if not doctor:
            raise NotFoundException("Doctor profile not found")

        updates = data.model_dump(exclude_unset=True, exclude={"name", "locations"})
        for field, value in updates.items():
            setattr(doctor, field, value)
        if data.name is not None and doctor.user:
            doctor.user.name = data.name
        if data.locations is not None:
            doctor.locations.clear()
            for location_data in data.locations:
                doctor.locations.append(DoctorLocation(**location_data.model_dump()))
        await self.db.commit()
        await self.db.refresh(doctor)
        return self.to_read(doctor)

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
            setattr(location, field, value)

        await self.db.commit()
        await self.db.refresh(location)
        return location

    async def delete_location(self, doctor_id: uuid.UUID, location_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            select(DoctorLocation).where(
                DoctorLocation.id == location_id,
                DoctorLocation.doctor_id == doctor_id,
            )
        )
        location = result.scalar_one_or_none()
        if not location:
            raise NotFoundException("Chamber location not found")

        # Ensure doctor always has at least 1 chamber or allow deletion
        await self.db.delete(location)
        await self.db.commit()
        return True
