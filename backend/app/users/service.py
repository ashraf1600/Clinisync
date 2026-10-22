import re
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.users.models import User
from app.users.schemas import UserRegister, UserLogin, UserUpdate
from app.core.security import (
    get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token,
    create_password_reset_token, password_fingerprint,
)
from app.core.email import send_email
from app.core.config import settings
from app.core.exceptions import ConflictException, UnauthorizedException, NotFoundException, BadRequestException, ForbiddenException

def _check_password_strength(password: str) -> None:
    if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password) or not re.search(r"[0-9]", password):
        raise BadRequestException("Password needs upper, lower and a number (8+ chars)")


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def register(self, data: UserRegister) -> tuple[User, str, str]:
        _check_password_strength(data.password)

        existing = await self.get_by_email(data.email)
        if existing:
            raise ConflictException(f"User with email '{data.email}' already exists")

        allowed_roles = {"patient", "doctor", "admin"}
        role = data.role.lower() if data.role and data.role.lower() in allowed_roles else "patient"
        if role == "admin":
            # Admin creation is gated by invite code; without one it is only open in local development
            if settings.ADMIN_INVITE_CODE:
                if (data.admin_invite_code or "").strip() != settings.ADMIN_INVITE_CODE:
                    raise UnauthorizedException("Invalid admin invite code")
            elif not settings.is_development:
                raise ForbiddenException("Admin self-registration is disabled")

        user = User(
            name=data.name,
            email=data.email.lower(),
            password_hash=get_password_hash(data.password),
            role=role,
            phone=data.phone,
            timezone=data.timezone,
        )
        self.db.add(user)
        await self.db.flush()

        if role == "doctor":
            from app.doctors.models import Doctor
            from decimal import Decimal
            bmdc = data.bmdc_number or f"BMDC-A{str(uuid.uuid4().int)[:5]}"
            spec = data.specialization or "General Medicine"
            doctor = Doctor(
                user_id=user.id,
                specialization=spec,
                degrees="MBBS",
                bmdc_number=bmdc,
                designation="Consultant Specialist",
                facility_name="Popular Diagnostic Centre",
                chamber_room="Room #305, Level 3",
                consultation_fee=Decimal("1000.00"),
                followup_fee=Decimal("600.00"),
                experience_years=10,
            )
            self.db.add(doctor)

        await self.db.commit()
        await self.db.refresh(user)

        access_token = create_access_token(user.id, user.role)
        refresh_token = create_refresh_token(user.id, user.role, user.password_hash)
        return user, access_token, refresh_token

    async def login(self, data: UserLogin) -> tuple[User, str, str]:
        user = await self.get_by_email(data.email)
        if not user or not verify_password(data.password, user.password_hash):
            raise UnauthorizedException("Invalid email or password")
        if not user.is_active:
            raise UnauthorizedException("User account is deactivated")

        access_token = create_access_token(user.id, user.role)
        refresh_token = create_refresh_token(user.id, user.role, user.password_hash)
        return user, access_token, refresh_token

    async def refresh_tokens(self, refresh_token: str) -> str:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise UnauthorizedException("Invalid token type")
        try:
            user_id = uuid.UUID(str(payload.get("sub")))
        except (ValueError, TypeError):
            raise UnauthorizedException("Invalid token subject")
        user = await self.get_by_id(user_id)
        if not user or not user.is_active:
            raise UnauthorizedException("User inactive or not found")
        # Sessions issued before a password change are revoked
        if payload.get("pwd") and payload["pwd"] != password_fingerprint(user.password_hash):
            raise UnauthorizedException("Session expired after a password change. Please log in again.")
        return create_access_token(user.id, user.role)

    async def update_profile(self, user_id: uuid.UUID, data: UserUpdate) -> User:
        user = await self.get_by_id(user_id)
        if not user:
            raise NotFoundException("User not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            # name/timezone are NOT NULL; ignore explicit nulls instead of failing on commit
            if value is None and field in ("name", "timezone"):
                continue
            setattr(user, field, value.strip() if isinstance(value, str) and field == "name" else value)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def request_password_reset(self, email: str) -> None:
        """Email a reset link. Silent for unknown accounts so emails cannot be enumerated."""
        from app.appointments.service import WALKIN_EMAIL_DOMAIN
        user = await self.get_by_email(email)
        if not user or not user.is_active or user.email.endswith(WALKIN_EMAIL_DOMAIN):
            return
        token = create_password_reset_token(user.id, user.password_hash)
        link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
        await send_email(
            user.email,
            "Reset your CliniSync password",
            f"Hello {user.name},\n\n"
            f"Use this link to set a new password (valid for {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes):\n{link}\n\n"
            "If you did not request this, you can ignore this email.",
        )

    async def reset_password(self, token: str, new_password: str) -> None:
        invalid = BadRequestException("This reset link is invalid or has expired", code="INVALID_RESET_TOKEN")
        try:
            payload = decode_token(token)
            user_id = uuid.UUID(str(payload.get("sub")))
        except (UnauthorizedException, ValueError, TypeError):
            raise invalid
        if payload.get("type") != "password_reset":
            raise invalid
        user = await self.get_by_id(user_id)
        # The fingerprint makes the link single-use: any password change invalidates it
        if not user or not user.is_active or payload.get("pwd") != password_fingerprint(user.password_hash):
            raise invalid
        _check_password_strength(new_password)
        user.password_hash = get_password_hash(new_password)
        await self.db.commit()
