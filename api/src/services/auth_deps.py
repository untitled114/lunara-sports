"""FastAPI dependencies for authentication and authorization."""

from __future__ import annotations

import uuid

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import User
from ..db.session import get_session
from .auth_service import decode_token

_bearer = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    session: AsyncSession = Depends(get_session),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    x_user_id: str | None = Header(default=None),
) -> User | None:
    """Resolve the current user from JWT Bearer token or X-User-Id header.

    Returns None if no auth is provided (anonymous access).
    """
    # Try JWT first
    if credentials and credentials.credentials:
        payload = decode_token(credentials.credentials)
        if payload and "sub" in payload:
            try:
                user_id = uuid.UUID(payload["sub"])
            except ValueError:
                return None
            user = await session.get(User, user_id)
            return user

    # Fallback to X-User-Id header (backwards compat)
    if x_user_id:
        try:
            user_id = uuid.UUID(x_user_id)
        except ValueError:
            return None
        return await session.get(User, user_id)

    return None


async def get_current_user(
    user: User | None = Depends(get_current_user_optional),
) -> User:
    """Require authentication — returns 401 if no valid user."""
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def require_premium(
    user: User = Depends(get_current_user),
) -> User:
    """Require premium membership — returns 403 if free tier."""
    if user.membership_tier != "premium":
        raise HTTPException(status_code=403, detail="Premium membership required")
    return user
