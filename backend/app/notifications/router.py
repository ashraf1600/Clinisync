import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.notifications.schemas import (
    DeviceRegisterRequest, DeviceRead, NotificationListResponse,
    NotificationReadResponse, MarkAllReadResponse
)
from app.notifications.service import NotificationService
from app.users.models import User
from app.users.dependencies import get_current_user

devices_router = APIRouter(prefix="/devices", tags=["Notifications & Device Registry"])
notifications_router = APIRouter(prefix="/notifications", tags=["Notifications & Device Registry"])

@devices_router.post("/fcm-token", response_model=DeviceRead, status_code=status.HTTP_200_OK)
async def register_device_token(
    payload: DeviceRegisterRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    service = NotificationService(db)
    return await service.register_device(current_user.id, payload)

@notifications_router.get("", response_model=NotificationListResponse, status_code=status.HTTP_200_OK)
async def get_user_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    unread_only: bool = Query(False, alias="unreadOnly"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    service = NotificationService(db)
    return await service.get_notifications(current_user.id, page, page_size, unread_only)

@notifications_router.patch("/{id}/read", response_model=NotificationReadResponse, status_code=status.HTTP_200_OK)
async def mark_single_notification_read(
    id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    service = NotificationService(db)
    return await service.mark_read(current_user.id, id)

@notifications_router.post("/mark-all-read", response_model=MarkAllReadResponse, status_code=status.HTTP_200_OK)
async def mark_all_notifications_as_read(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    service = NotificationService(db)
    return await service.mark_all_read(current_user.id)
