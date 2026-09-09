import uuid
from datetime import date
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.availability.schemas import (
    DoctorDayAvailabilityResponse, RecurringShiftsUpdateRequest,
    ExceptionCreateRequest, ExceptionRead, BulkGenerateRequest, BulkGenerateResponse,
    ChamberShiftRead, ChamberShiftCreate, DoctorMultiDayScheduleResponse
)
from app.availability.service import AvailabilityService
from app.users.models import User
from app.users.dependencies import get_current_user
from app.availability.dependencies import require_doctor_or_admin

router = APIRouter(prefix="/availability", tags=["Availability & Shifts"])

def _parse_location_uuid(location_id: Optional[str]) -> Optional[uuid.UUID]:
    if not location_id or location_id == "default":
        return None
    try:
        return uuid.UUID(str(location_id))
    except (ValueError, TypeError):
        return None

@router.get("/{doctorId}/schedule", response_model=DoctorMultiDayScheduleResponse, status_code=status.HTTP_200_OK)
async def get_doctor_multi_day_schedule(
    doctorId: uuid.UUID,
    days: int = Query(14, ge=1, le=30, description="Number of upcoming days to load"),
    from_date: Optional[date] = Query(None, alias="fromDate", description="Starting calendar date YYYY-MM-DD (defaults to today)"),
    location_id: Optional[str] = Query(None, alias="locationId", description="Filter slots by chamber location"),
    db: AsyncSession = Depends(get_db)
):
    valid_loc_id = _parse_location_uuid(location_id)
    service = AvailabilityService(db)
    return await service.get_multi_day_schedule(doctorId, from_date, days, valid_loc_id)

@router.get("/{doctorId}", response_model=DoctorDayAvailabilityResponse, status_code=status.HTTP_200_OK)
async def get_doctor_availability(
    doctorId: uuid.UUID,
    date_param: date = Query(..., alias="date", description="Target calendar date YYYY-MM-DD"),
    location_id: Optional[str] = Query(None, alias="locationId", description="Filter slots by chamber location"),
    db: AsyncSession = Depends(get_db)
):
    valid_loc_id = _parse_location_uuid(location_id)
    service = AvailabilityService(db)
    return await service.get_slots_for_date(doctorId, date_param, valid_loc_id)

@router.get("/{doctorId}/shifts", response_model=list[ChamberShiftRead], status_code=status.HTTP_200_OK)
async def get_doctor_shifts(
    doctorId: uuid.UUID,
    location_id: Optional[str] = Query(None, alias="locationId", description="Filter shifts by chamber location"),
    db: AsyncSession = Depends(get_db)
):
    valid_loc_id = _parse_location_uuid(location_id)
    service = AvailabilityService(db)
    return await service.list_shifts(doctorId, valid_loc_id)

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
