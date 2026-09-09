import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, and_
from app.notifications.models import UserDevice, Notification
from app.appointments.models import Appointment
from app.notifications.schemas import (
    DeviceRegisterRequest, DeviceRead, NotificationItem,
    NotificationListResponse, NotificationReadResponse, MarkAllReadResponse,
    ReminderRunResponse
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

    async def _remind_window(
        self,
        window_start: datetime,
        window_end: datetime,
        ntype: str,
        title: str,
        when_word: str,
    ) -> tuple[int, int]:
        """Create reminders for appointments starting inside the window.

        Idempotent: skips appointments that already have this reminder type.
        Returns (checked, sent).
        """
        res = await self.db.execute(
            select(Appointment).where(
                and_(
                    Appointment.status.in_(["pending", "confirmed"]),
                    Appointment.start_time >= window_start,
                    Appointment.start_time < window_end,
                )
            )
        )
        appts = list(res.scalars().all())
        sent = 0
        for a in appts:
            dup = await self.db.execute(
                select(func.count()).where(
                    and_(
                        Notification.appointment_id == a.id,
                        Notification.notification_type == ntype,
                    )
                )
            )
            if dup.scalar_one() > 0:
                continue
            doc_name = a.doctor.user.name if (a.doctor and a.doctor.user) else "Doctor"
            when = a.start_time.strftime("%b %d, %I:%M %p")
            try:
                self.db.add(
                    Notification(
                        user_id=a.patient_id,
                        appointment_id=a.id,
                        title=title,
                        body=f"Reminder: Serial #{a.token_number} with {doc_name} {when_word} ({when}). Please arrive 15 min early.",
                        notification_type=ntype,
                        metadata_={"tokenNumber": a.token_number, "doctorName": doc_name},
                    )
                )
                await self.db.commit()
                sent += 1
            except Exception:
                await self.db.rollback()
        return len(appts), sent

    async def send_due_reminders(self) -> ReminderRunResponse:
        now = datetime.now(timezone.utc)
        checked_24h, sent_24h = await self._remind_window(
            now + timedelta(hours=23), now + timedelta(hours=25),
            "reminder_24h", "Appointment Tomorrow 🔔", "tomorrow",
        )
        checked_1h, sent_1h = await self._remind_window(
            now + timedelta(minutes=50), now + timedelta(minutes=70),
            "reminder_1h", "Appointment in 1 Hour ⏰", "in about an hour",
        )
        return ReminderRunResponse(
            checked_24h=checked_24h, sent_24h=sent_24h,
            checked_1h=checked_1h, sent_1h=sent_1h,
        )
