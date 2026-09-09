import uuid
from typing import Annotated
from fastapi import Depends, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.users.models import User
from app.users.service import UserService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

async def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)] = None,
    db: AsyncSession = Depends(get_db)
) -> User:
    if not token:
        raise UnauthorizedException("Authentication bearer token required")
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise UnauthorizedException("Invalid access token")
    user_id = uuid.UUID(payload.get("sub"))
    service = UserService(db)
    user = await service.get_by_id(user_id)
    if not user or not user.is_active:
        raise UnauthorizedException("User account not found or disabled")
    return user

async def get_optional_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)] = None,
    db: AsyncSession = Depends(get_db)
) -> User | None:
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user_id = uuid.UUID(payload.get("sub"))
        service = UserService(db)
        user = await service.get_by_id(user_id)
        if not user or not user.is_active:
            return None
        return user
    except Exception:
        return None

def require_role(*roles: str):
    async def role_checker(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in roles:
            raise ForbiddenException(f"Role '{current_user.role}' lacks permission for this action")
        return current_user
    return role_checker

require_admin = require_role("admin")
require_doctor = require_role("doctor", "admin")
require_patient = require_role("patient", "admin")
