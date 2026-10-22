import uuid
from datetime import date, datetime
from pydantic import EmailStr, Field, field_validator
from app.core.base_schema import CamelModel
from app.core.config import settings


def _validate_timezone(v: str | None) -> str | None:
    if v is None:
        return v
    from zoneinfo import available_timezones
    known = available_timezones()
    # Without a tz database (no tzdata installed) we cannot validate, so accept as-is
    if known and v not in known:
        raise ValueError(f"Unknown timezone '{v}'")
    return v


class UserRegister(CamelModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="patient")
    phone: str | None = Field(default=None, max_length=20)
    timezone: str = "Asia/Dhaka"
    specialization: str | None = Field(default=None, max_length=100)
    bmdc_number: str | None = Field(default=None, max_length=50)
    admin_invite_code: str | None = Field(default=None, alias="adminInviteCode")

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v

    @field_validator("timezone")
    @classmethod
    def check_timezone(cls, v: str) -> str:
        return _validate_timezone(v)

class UserLogin(CamelModel):
    email: EmailStr
    password: str

class UserRead(CamelModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    role: str
    phone: str | None = None
    birth_date: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    address: str | None = None
    timezone: str
    created_at: datetime

class UserUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    timezone: str | None = None
    birth_date: date | None = None
    gender: str | None = Field(default=None, max_length=30)
    blood_group: str | None = Field(default=None, max_length=5)
    address: str | None = Field(default=None, max_length=500)

    @field_validator("timezone")
    @classmethod
    def check_timezone(cls, v: str | None) -> str | None:
        return _validate_timezone(v)

    @field_validator("birth_date")
    @classmethod
    def check_birth_date(cls, v: date | None) -> date | None:
        if v is not None and v > date.today():
            raise ValueError("Birth date cannot be in the future")
        return v

class TokenData(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int = Field(default_factory=lambda: settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

class AuthResponse(CamelModel):
    user: UserRead
    tokens: TokenData

class RefreshTokenRequest(CamelModel):
    refresh_token: str

class TokenRefreshResponse(CamelModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = Field(default_factory=lambda: settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

class ForgotPasswordRequest(CamelModel):
    email: EmailStr

class ResetPasswordRequest(CamelModel):
    token: str
    new_password: str = Field(..., min_length=8)

class MessageResponse(CamelModel):
    message: str
