import uuid
from datetime import date
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.admin.models import AuditLog
from app.appointments.models import Appointment
from app.doctors.models import Doctor
from app.users.models import User
from app.admin.schemas import AdminAnalyticsResponse, AuditLogItem, AuditLogListResponse

class AdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_analytics(self) -> AdminAnalyticsResponse:
        # Total bookings
        tot_b = await self.db.execute(select(func.count()).select_from(Appointment))
        total_bookings = tot_b.scalar_one()

        # Completed
        comp = await self.db.execute(select(func.count()).where(Appointment.status == "completed"))
        completed_count = comp.scalar_one()

        # No show
        ns = await self.db.execute(select(func.count()).where(Appointment.status == "no_show"))
        no_show_count = ns.scalar_one()

        # Cancelled
        canc = await self.db.execute(select(func.count()).where(Appointment.status == "cancelled"))
        cancelled_count = canc.scalar_one()

        # Active doctors
        docs = await self.db.execute(select(func.count()).select_from(Doctor))
        active_doctors = docs.scalar_one()

        # Registered patients
        pts = await self.db.execute(select(func.count()).where(User.role == "patient"))
        registered_patients = pts.scalar_one()

        no_show_rate = 0.0
        if total_bookings > 0:
            no_show_rate = round((no_show_count / total_bookings) * 100, 2)

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
