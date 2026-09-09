import uuid
from datetime import date
from typing import Annotated, Optional, List
from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.appointments.schemas import (
    AppointmentBookRequest, AppointmentRead, AppointmentRescheduleRequest,
    AppointmentCancelRequest, AppointmentStatusUpdateRequest,
    DoctorQueueResponse, QueuePauseRequest, QueuePauseResponse,
    QueueResumeResponse
)
from app.appointments.service import AppointmentService
from app.users.models import User
from app.users.dependencies import get_current_user, require_doctor, get_optional_current_user

router = APIRouter(prefix="/appointments", tags=["Appointments Lifecycle & Chamber Queue"])

@router.post("/book", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
async def book_appointment(
    payload: AppointmentBookRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db)
):
    service = AppointmentService(db)
    return await service.book(current_user.id, payload, idempotency_key=idempotency_key)

@router.put("/{id}/reschedule", response_model=AppointmentRead, status_code=status.HTTP_200_OK)
async def reschedule_appointment(
    id: uuid.UUID,
    payload: AppointmentRescheduleRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db)
):
    service = AppointmentService(db)
    return await service.reschedule(id, current_user.id, payload)

@router.put("/{id}/cancel", status_code=status.HTTP_200_OK)
async def cancel_appointment(
    id: uuid.UUID,
    payload: AppointmentCancelRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    service = AppointmentService(db)
    return await service.cancel(id, payload.reason or "Patient cancellation")

@router.put("/{id}/status", status_code=status.HTTP_200_OK)
async def update_appointment_status(
    id: uuid.UUID,
    payload: AppointmentStatusUpdateRequest,
    current_user: Annotated[User, Depends(require_doctor)],
    db: AsyncSession = Depends(get_db)
):
    service = AppointmentService(db)
    return await service.update_status(id, payload.status)

@router.get("/doctor/{doctorId}", response_model=DoctorQueueResponse, status_code=status.HTTP_200_OK)
async def get_doctor_chamber_queue(
    doctorId: uuid.UUID,
    date_param: date = Query(..., alias="date", description="Target date YYYY-MM-DD"),
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    service = AppointmentService(db)
    role = current_user.role if current_user else "guest"
    return await service.get_doctor_queue(doctorId, date_param, role)

@router.get("/patient/me", response_model=List[AppointmentRead], status_code=status.HTTP_200_OK)
async def get_my_appointments(
    filter_type: str = Query("upcoming", alias="filter", pattern="^(upcoming|past)$"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    service = AppointmentService(db)
    return await service.get_patient_appointments(current_user.id, filter_type)

@router.put("/doctor/{doctorId}/queue-pause", response_model=QueuePauseResponse, status_code=status.HTTP_200_OK)
async def pause_doctor_queue(
    doctorId: uuid.UUID,
    payload: QueuePauseRequest,
    current_user: Annotated[User, Depends(require_doctor)],
    db: AsyncSession = Depends(get_db)
):
    service = AppointmentService(db)
    return await service.pause_queue(doctorId, payload)

@router.put("/doctor/{doctorId}/queue-resume", response_model=QueueResumeResponse, status_code=status.HTTP_200_OK)
async def resume_doctor_queue(
    doctorId: uuid.UUID,
    current_user: Annotated[User, Depends(require_doctor)],
    db: AsyncSession = Depends(get_db)
):
    service = AppointmentService(db)
    return await service.resume_queue(doctorId)
