import uuid
from datetime import date
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.availability.schemas import (
    DoctorDayAvailabilityResponse, RecurringShiftsUpdateRequest,
    ExceptionCreateRequest, ExceptionRead, BulkGenerateRequest, BulkGenerateResponse,
    ChamberShiftRead, ChamberShiftCreate
)
from app.availability.service import AvailabilityService
from app.users.models import User
from app.users.dependencies import get_current_user
from app.availability.dependencies import require_doctor_or_admin

router = APIRouter(prefix="/availability", tags=["Availability & Shifts"])

@router.get("/{doctorId}", response_model=DoctorDayAvailabilityResponse, status_code=status.HTTP_200_OK)
async def get_doctor_availability(
    doctorId: uuid.UUID,
    date_param: date = Query(..., alias="date", description="Target calendar date YYYY-MM-DD"),
    location_id: Optional[uuid.UUID] = Query(None, alias="locationId", description="Filter slots by chamber location"),
    db: AsyncSession = Depends(get_db)
):
    service = AvailabilityService(db)
    return await service.get_slots_for_date(doctorId, date_param, location_id)

@router.get("/{doctorId}/shifts", response_model=list[ChamberShiftRead], status_code=status.HTTP_200_OK)
async def get_doctor_shifts(
    doctorId: uuid.UUID,
    location_id: Optional[uuid.UUID] = Query(None, alias="locationId", description="Filter shifts by chamber location"),
    db: AsyncSession = Depends(get_db)
):
    service = AvailabilityService(db)
    return await service.list_shifts(doctorId, location_id)

@router.post("/{doctorId}/shifts", response_model=list[ChamberShiftRead], status_code=status.HTTP_201_CREATED)
async def add_doctor_chamber_shifts(
    doctorId: uuid.UUID,
    payload: ChamberShiftCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    await require_doctor_or_admin(doctorId, current_user, db)
    service = AvailabilityService(db)
    return await service.add_chamber_shifts(doctorId, payload)

@router.delete("/{doctorId}/shifts/{shiftId}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor_chamber_shift(
    doctorId: uuid.UUID,
    shiftId: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    await require_doctor_or_admin(doctorId, current_user, db)
    service = AvailabilityService(db)
    await service.delete_shift(doctorId, shiftId)
    return None

@router.put("/{doctorId}/recurring", status_code=status.HTTP_200_OK)
async def update_recurring_shifts(
    doctorId: uuid.UUID,
    payload: RecurringShiftsUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    await require_doctor_or_admin(doctorId, current_user, db)
    service = AvailabilityService(db)
    await service.set_recurring_shifts(doctorId, payload.shifts)
    return {"message": "Weekly recurring shifts updated successfully."}

@router.post("/{doctorId}/exceptions", response_model=ExceptionRead, status_code=status.HTTP_201_CREATED)
async def add_availability_exception(
    doctorId: uuid.UUID,
    payload: ExceptionCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    await require_doctor_or_admin(doctorId, current_user, db)
    service = AvailabilityService(db)
    return await service.add_exception(doctorId, payload)

@router.post("/{doctorId}/bulk-generate", response_model=BulkGenerateResponse, status_code=status.HTTP_201_CREATED)
async def bulk_generate_slots(
    doctorId: uuid.UUID,
    payload: BulkGenerateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    await require_doctor_or_admin(doctorId, current_user, db)
    service = AvailabilityService(db)
    return await service.bulk_generate_slots(doctorId, payload)
