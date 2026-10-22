import uuid
from datetime import date
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.admin.models import AuditLog
from app.appointments.models import Appointment
from app.doctors.models import Doctor
from app.users.models import User
from app.appointments.service import WALKIN_EMAIL_DOMAIN
from app.admin.schemas import AdminAnalyticsResponse, AuditLogItem, AuditLogListResponse

class AdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_analytics(self) -> AdminAnalyticsResponse:
        # One grouped scan instead of a query per status
        status_res = await self.db.execute(
            select(Appointment.status, func.count()).group_by(Appointment.status)
        )
        by_status = {row[0]: row[1] for row in status_res.all()}
        total_bookings = sum(by_status.values())
        completed_count = by_status.get("completed", 0)
        no_show_count = by_status.get("no_show", 0)
        cancelled_count = by_status.get("cancelled", 0)

        # Doctors whose login is still active
        docs = await self.db.execute(
            select(func.count()).select_from(Doctor).join(User, Doctor.user_id == User.id).where(User.is_active.is_(True))
        )
        active_doctors = docs.scalar_one()

        # Real patient accounts (walk-in guest records are not registrations)
        pts = await self.db.execute(
            select(func.count()).select_from(User).where(
                User.role == "patient",
                User.is_active.is_(True),
                User.email.not_like(f"%{WALKIN_EMAIL_DOMAIN}"),
            )
        )
        registered_patients = pts.scalar_one()

        # No-show rate is measured against visits that actually came due
        # (completed + no-show); cancelled and upcoming bookings would dilute it.
        attended_or_missed = completed_count + no_show_count
        no_show_rate = 0.0
        if attended_or_missed > 0:
            no_show_rate = round((no_show_count / attended_or_missed) * 100, 2)

        return AdminAnalyticsResponse(
            total_bookings=total_bookings,
            completed_count=completed_count,
            no_show_count=no_show_count,
            cancelled_count=cancelled_count,
            no_show_rate_percentage=no_show_rate,
            active_doctors=active_doctors,
            registered_patients=registered_patients
        )

    async def get_audit_logs(self, page: int = 1, page_size: int = 20, action: Optional[str] = None) -> AuditLogListResponse:
        query = select(AuditLog)
        if action:
            query = query.where(AuditLog.action == action)
        
        count_res = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total_count = count_res.scalar_one()

        offset = (page - 1) * page_size
        items_query = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(page_size)
        items_res = await self.db.execute(items_query)
        logs = items_res.scalars().all()

        return AuditLogListResponse(
            items=[
                AuditLogItem(
                    id=l.id,
                    actor_id=l.actor_id,
                    action=l.action,
                    target_type=l.target_type,
                    target_id=l.target_id,
                    metadata=l.metadata_ if l.metadata_ else {},
                    ip_address=l.ip_address,
                    timestamp=l.timestamp
                )
                for l in logs
            ],
            page=page,
            page_size=page_size,
            total_count=total_count
        )
