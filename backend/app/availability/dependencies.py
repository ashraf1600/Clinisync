import uuid
from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.users.models import User
from app.users.dependencies import get_current_user
from app.core.exceptions import ForbiddenException

async def require_doctor_or_admin(
    doctor_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession | None = None
) -> User:
    if current_user.role == "admin":
        return current_user
    if current_user.role == "doctor":
        if db is not None:
            from app.doctors.models import Doctor
            result = await db.execute(
                select(Doctor).where(Doctor.id == doctor_id, Doctor.user_id == current_user.id)
            )
            doctor = result.scalar_one_or_none()
            if not doctor:
                raise ForbiddenException("You can only manage your own doctor profile and chambers")
        return current_user
    raise ForbiddenException("Only treating doctor or administrator can modify availability")
