from typing import Optional, Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.admin.schemas import AdminAnalyticsResponse, AuditLogListResponse
from app.admin.service import AdminService
from app.users.models import User
from app.users.dependencies import require_admin

router = APIRouter(prefix="/admin", tags=["Admin & Audit Oversight"])

@router.get("/analytics", response_model=AdminAnalyticsResponse, status_code=status.HTTP_200_OK)
async def get_clinic_analytics(
    current_admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db)
):
    service = AdminService(db)
    return await service.get_analytics()

@router.get("/audit-log", response_model=AuditLogListResponse, status_code=status.HTTP_200_OK)
async def get_audit_logs(
    current_admin: Annotated[User, Depends(require_admin)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    action: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    service = AdminService(db)
    return await service.get_audit_logs(page=page, page_size=page_size, action=action)
