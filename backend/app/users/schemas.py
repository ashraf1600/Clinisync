import uuid
from datetime import date, datetime
from pydantic import EmailStr, Field
from app.core.base_schema import CamelModel

class UserRegister(CamelModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: str = Field(default="patient")
    phone: str | None = None
    timezone: str = "Asia/Dhaka"
    specialization: str | None = None
    bmdc_number: str | None = None

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
    name: str | None = None
    phone: str | None = None
    timezone: str | None = None
    birth_date: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    address: str | None = None

class TokenData(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int = 900

class AuthResponse(CamelModel):
    user: UserRead
    tokens: TokenData

class RefreshTokenRequest(CamelModel):
    refresh_token: str

class TokenRefreshResponse(CamelModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 900

class ForgotPasswordRequest(CamelModel):
    email: EmailStr

class ResetPasswordRequest(CamelModel):
    token: str
    new_password: str = Field(..., min_length=8)

class MessageResponse(CamelModel):
    message: str
