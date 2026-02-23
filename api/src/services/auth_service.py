"""Authentication service — registration, login, JWT tokens."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
import jwt
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings
from ..db.models import User

logger = structlog.get_logger(__name__)

_settings: Settings | None = None


def _get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


async def register(
    session: AsyncSession,
    username: str,
    email: str,
    password: str,
) -> User:
    """Create a new user with hashed password."""
    password_hash = _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()
    user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        display_name=username,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    logger.info("auth.registered", username=username)
    return user


async def authenticate(
    session: AsyncSession,
    email: str,
    password: str,
) -> User | None:
    """Verify email + password, return user or None."""
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None or user.password_hash is None:
        return None

    if not _bcrypt.checkpw(password.encode(), user.password_hash.encode()):
        return None

    logger.info("auth.login", username=user.username)
    return user


def create_access_token(user_id: str, tier: str = "free") -> str:
    """Create a JWT with user_id and membership tier."""
    settings = _get_settings()
    payload = {
        "sub": str(user_id),
        "tier": tier,
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.jwt_expiry_days),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT. Returns payload or None."""
    settings = _get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
