from typing import Annotated
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.cache import shared_store
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import TooManyRequestsException, UnauthorizedException
from app.users.schemas import (
    UserRegister, UserLogin, AuthResponse, TokenData,
    RefreshTokenRequest, TokenRefreshResponse,
    ForgotPasswordRequest, ResetPasswordRequest, MessageResponse,
    UserRead, UserUpdate
)
from app.users.service import UserService
from app.users.models import User
from app.users.dependencies import get_current_user

auth_router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])
users_router = APIRouter(prefix="/users", tags=["User Profiles"])

@auth_router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    user, access_token, refresh_token = await service.register(payload)
    return AuthResponse(
        user=UserRead.model_validate(user),
        tokens=TokenData(access_token=access_token, refresh_token=refresh_token)
    )

@auth_router.post("/login", response_model=AuthResponse, status_code=status.HTTP_200_OK)
async def login(payload: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    key = f"login_fail:{ip}"
    window = settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS
    if await shared_store.get_int(key) >= settings.LOGIN_RATE_LIMIT_MAX:
        raise TooManyRequestsException(f"Too many failed logins. Try again in {int(window / 60)} min.")
    try:
        user, access_token, refresh_token = await UserService(db).login(payload)
    except UnauthorizedException:
        # Only wrong credentials count towards the lockout (not DB/validation errors)
        await shared_store.incr(key, window)
        raise
    await shared_store.delete(key)
    return AuthResponse(
        user=UserRead.model_validate(user),
        tokens=TokenData(access_token=access_token, refresh_token=refresh_token)
    )

@auth_router.post("/refresh", response_model=TokenRefreshResponse, status_code=status.HTTP_200_OK)
async def refresh(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    new_access_token = await service.refresh_tokens(payload.refresh_token)
    return TokenRefreshResponse(access_token=new_access_token)

@auth_router.post("/forgot-password", response_model=MessageResponse, status_code=status.HTTP_200_OK)
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    await UserService(db).request_password_reset(payload.email)
    return MessageResponse(message="Password reset link sent if account exists.")

@auth_router.post("/reset-password", response_model=MessageResponse, status_code=status.HTTP_200_OK)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    await UserService(db).reset_password(payload.token, payload.new_password)
    return MessageResponse(message="Password reset successfully.")

@users_router.get("/me", response_model=UserRead, status_code=status.HTTP_200_OK)
async def get_my_profile(current_user: Annotated[User, Depends(get_current_user)]):
    return UserRead.model_validate(current_user)

@users_router.put("/me", response_model=UserRead, status_code=status.HTTP_200_OK)
async def update_my_profile(
    payload: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    service = UserService(db)
    updated = await service.update_profile(current_user.id, payload)
    return UserRead.model_validate(updated)
