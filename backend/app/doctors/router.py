import uuid
from typing import Optional, Annotated
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.doctors.schemas import (
    DoctorListResponse, DoctorRead, DoctorCreate, DoctorUpdate,
    DoctorLocationRead, DoctorLocationCreate, DoctorLocationUpdate
)
from app.doctors.service import DoctorService
from app.users.models import User
from app.users.dependencies import get_current_user, require_admin, require_doctor

router = APIRouter(prefix="/doctors", tags=["Doctors Directory"])

@router.get("", response_model=DoctorListResponse, status_code=status.HTTP_200_OK)
async def get_doctors(
    specialization: Optional[str] = Query(None, description="Filter by clinical specialty"),
    search: Optional[str] = Query(None, description="Search doctor name or clinic"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize", description="Results per page"),
    db: AsyncSession = Depends(get_db)
):
    service = DoctorService(db)
    return await service.list_doctors(
        specialization=specialization,
        search=search,
        page=page,
        page_size=page_size
    )

@router.post("", response_model=DoctorRead, status_code=status.HTTP_201_CREATED)
async def onboard_doctor(
    payload: DoctorCreate,
    current_admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db)
):
    service = DoctorService(db)
    return await service.create(payload)


@router.get("/me", response_model=DoctorRead, status_code=status.HTTP_200_OK)
async def get_my_doctor_profile(
    current_user: Annotated[User, Depends(require_doctor)],
    db: AsyncSession = Depends(get_db),
):
    service = DoctorService(db)
    doctor = await service.get_by_user_id(current_user.id)
    if not doctor:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("Doctor profile not found")
    return service.to_read(doctor, current_user.name)


@router.put("/me", response_model=DoctorRead, status_code=status.HTTP_200_OK)
async def update_my_doctor_profile(
    payload: DoctorUpdate,
    current_user: Annotated[User, Depends(require_doctor)],
    db: AsyncSession = Depends(get_db),
):
    service = DoctorService(db)
    doctor = await service.get_by_user_id(current_user.id)
    if not doctor:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("Doctor profile not found")
    return await service.update(doctor.id, payload)


@router.put("/{doctor_id}", response_model=DoctorRead, status_code=status.HTTP_200_OK)
async def update_doctor_profile(
    doctor_id: uuid.UUID,
    payload: DoctorUpdate,
    current_admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    return await DoctorService(db).update(doctor_id, payload)


@router.post("/me/photo", response_model=DoctorRead, status_code=status.HTTP_200_OK)
async def upload_my_profile_photo(
    current_user: Annotated[User, Depends(require_doctor)],
    photo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if photo.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        from app.core.exceptions import BadRequestException
        raise BadRequestException("Only JPEG, PNG, and WebP images are supported")
    doctor_service = DoctorService(db)
    doctor = await doctor_service.get_by_user_id(current_user.id)
    if not doctor:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("Doctor profile not found")
    upload_dir = Path(__file__).resolve().parents[2] / "uploads" / "profile_photos"
    upload_dir.mkdir(parents=True, exist_ok=True)
    extension = Path(photo.filename or "photo.jpg").suffix.lower() or ".jpg"
    filename = f"{doctor.id}-{uuid4().hex}{extension}"
    (upload_dir / filename).write_bytes(await photo.read())
    doctor.profile_photo_url = f"/uploads/profile_photos/{filename}"
    await db.commit()
    await db.refresh(doctor)
    return doctor_service.to_read(doctor, current_user.name)


from app.availability.dependencies import require_doctor_or_admin


@router.get("/{doctor_id}/locations", response_model=list[DoctorLocationRead], status_code=status.HTTP_200_OK)
async def get_doctor_locations(
    doctor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    doctor_service = DoctorService(db)
    locations = await doctor_service.list_locations(doctor_id)
    return [DoctorLocationRead.model_validate(loc) for loc in locations]


@router.post("/{doctor_id}/locations", response_model=DoctorLocationRead, status_code=status.HTTP_201_CREATED)
async def create_doctor_location(
    doctor_id: uuid.UUID,
    payload: DoctorLocationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await require_doctor_or_admin(doctor_id, current_user, db)
    doctor_service = DoctorService(db)
    created = await doctor_service.create_location(doctor_id, payload)
    return DoctorLocationRead.model_validate(created)


@router.put("/{doctor_id}/locations/{location_id}", response_model=DoctorLocationRead, status_code=status.HTTP_200_OK)
async def update_doctor_location(
    doctor_id: uuid.UUID,
    location_id: uuid.UUID,
    payload: DoctorLocationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await require_doctor_or_admin(doctor_id, current_user, db)
    doctor_service = DoctorService(db)
    updated = await doctor_service.update_location(doctor_id, location_id, payload)
    return DoctorLocationRead.model_validate(updated)


@router.delete("/{doctor_id}/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor_location(
    doctor_id: uuid.UUID,
    location_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await require_doctor_or_admin(doctor_id, current_user, db)
    doctor_service = DoctorService(db)
    await doctor_service.delete_location(doctor_id, location_id)
    return None

