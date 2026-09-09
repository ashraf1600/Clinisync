import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, and_
from app.notifications.models import UserDevice, Notification
from app.notifications.schemas import (
    DeviceRegisterRequest, DeviceRead, NotificationItem,
    NotificationListResponse, NotificationReadResponse, MarkAllReadResponse
)
from app.core.exceptions import NotFoundException

class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_device(self, user_id: uuid.UUID, data: DeviceRegisterRequest) -> DeviceRead:
        query = select(UserDevice).where(
            and_(UserDevice.user_id == user_id, UserDevice.fcm_token == data.fcm_token)
        )
        res = await self.db.execute(query)
        device = res.scalar_one_or_none()

        if device:
            device.is_active = True
            device.device_model = data.device_model
            device.device_type = data.device_type
        else:
            device = UserDevice(
                user_id=user_id,
                fcm_token=data.fcm_token,
                device_type=data.device_type,
                device_model=data.device_model,
                is_active=True
            )
            self.db.add(device)

        await self.db.commit()
        await self.db.refresh(device)
        return DeviceRead(
            device_id=device.id,
            fcm_token=device.fcm_token,
            device_type=device.device_type,
            is_active=device.is_active,
            updated_at=device.updated_at
        )

    async def get_notifications(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        unread_only: bool = False
    ) -> NotificationListResponse:
        base_query = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            base_query = base_query.where(Notification.is_read == False)

        # Count total
        count_res = await self.db.execute(select(func.count()).select_from(base_query.subquery()))
        total = count_res.scalar_one()

        # Count unread
        unread_res = await self.db.execute(
            select(func.count()).where(and_(Notification.user_id == user_id, Notification.is_read == False))
        )
        unread_count = unread_res.scalar_one()

        # Fetch items
        offset = (page - 1) * page_size
        items_query = base_query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size)
        items_res = await self.db.execute(items_query)
        notifications = items_res.scalars().all()

        return NotificationListResponse(
            items=[
                NotificationItem(
                    id=n.id,
                    title=n.title,
                    body=n.body,
                    notification_type=n.notification_type,
                    appointment_id=n.appointment_id,
                    is_read=n.is_read,
                    metadata=n.metadata_ if n.metadata_ else {},
                    created_at=n.created_at
                )
                for n in notifications
            ],
            unread_count=unread_count,
            total=total,
            page=page,
            page_size=page_size
        )

    async def mark_read(self, user_id: uuid.UUID, notification_id: uuid.UUID) -> NotificationReadResponse:
        query = select(Notification).where(
            and_(Notification.id == notification_id, Notification.user_id == user_id)
        )
        res = await self.db.execute(query)
        notif = res.scalar_one_or_none()
        if not notif:
            raise NotFoundException("Notification not found")

        now = datetime.now(timezone.utc)
        notif.is_read = True
        notif.read_at = now
        await self.db.commit()
        return NotificationReadResponse(id=notif.id, is_read=True, read_at=now)

    async def mark_all_read(self, user_id: uuid.UUID) -> MarkAllReadResponse:
        now = datetime.now(timezone.utc)
        stmt = (
            update(Notification)
            .where(and_(Notification.user_id == user_id, Notification.is_read == False))
            .values(is_read=True, read_at=now)
        )
        res = await self.db.execute(stmt)
        await self.db.commit()
        return MarkAllReadResponse(success=True, marked_count=res.rowcount)
