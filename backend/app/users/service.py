import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.users.models import User
from app.users.schemas import UserRegister, UserLogin, UserUpdate
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.exceptions import ConflictException, UnauthorizedException, NotFoundException

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
        existing = await self.get_by_email(data.email)
        if existing:
            raise ConflictException(f"User with email '{data.email}' already exists")
        
        allowed_roles = {"patient", "doctor", "admin"}
        role = data.role.lower() if data.role and data.role.lower() in allowed_roles else "patient"

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
        refresh_token = create_refresh_token(user.id, user.role)
        return user, access_token, refresh_token

    async def login(self, data: UserLogin) -> tuple[User, str, str]:
        user = await self.get_by_email(data.email)
        if not user or not verify_password(data.password, user.password_hash):
            raise UnauthorizedException("Invalid email or password")
        if not user.is_active:
            raise UnauthorizedException("User account is deactivated")

        access_token = create_access_token(user.id, user.role)
        refresh_token = create_refresh_token(user.id, user.role)
        return user, access_token, refresh_token

    async def refresh_tokens(self, refresh_token: str) -> str:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise UnauthorizedException("Invalid token type")
        user_id = uuid.UUID(payload["sub"])
        user = await self.get_by_id(user_id)
        if not user or not user.is_active:
            raise UnauthorizedException("User inactive or not found")
        return create_access_token(user.id, user.role)

    async def update_profile(self, user_id: uuid.UUID, data: UserUpdate) -> User:
        user = await self.get_by_id(user_id)
        if not user:
            raise NotFoundException("User not found")
        if data.name is not None:
            user.name = data.name
        if data.phone is not None:
            user.phone = data.phone
        if data.timezone is not None:
            user.timezone = data.timezone
        if data.birth_date is not None:
            user.birth_date = data.birth_date
        if data.gender is not None:
            user.gender = data.gender
        if data.blood_group is not None:
            user.blood_group = data.blood_group
        if data.address is not None:
            user.address = data.address
        await self.db.commit()
        await self.db.refresh(user)
        return user
