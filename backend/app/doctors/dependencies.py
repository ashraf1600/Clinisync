import uuid
from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.exceptions import NotFoundException
from app.doctors.models import Doctor
from app.doctors.service import DoctorService

async def get_doctor_or_404(
    doctor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
) -> Doctor:
    service = DoctorService(db)
    doctor = await service.get_by_id(doctor_id)
    if not doctor:
        raise NotFoundException(f"Doctor with ID '{doctor_id}' not found")
    return doctor
