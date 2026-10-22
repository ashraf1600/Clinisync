import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from jose import jwt, JWTError
import bcrypt
from app.core.config import settings
from app.core.exceptions import UnauthorizedException

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        plain_bytes = plain_password[:72].encode("utf-8")
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(plain_bytes, hash_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    plain_bytes = password[:72].encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_bytes, salt).decode("utf-8")

def create_access_token(subject: str | Any, role: str, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role,
        "type": "access"
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def password_fingerprint(password_hash: str) -> str:
    """Short digest of the stored hash; changes whenever the password changes."""
    return hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:16]

def create_refresh_token(subject: str | Any, role: str, password_hash: Optional[str] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role,
        "type": "refresh"
    }
    if password_hash:
        # Lets a password change revoke existing sessions
        to_encode["pwd"] = password_fingerprint(password_hash)
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_password_reset_token(subject: str | Any, password_hash: str) -> str:
    """Single-use reset token: invalid as soon as the password (hash) changes."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "password_reset",
        "pwd": password_fingerprint(password_hash),
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise UnauthorizedException("Invalid or expired credentials")
