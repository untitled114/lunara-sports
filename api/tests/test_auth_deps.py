"""Tests for auth_deps — FastAPI authentication dependencies."""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from src.db.models import User
from src.services.auth_deps import (
    get_current_user,
    get_current_user_optional,
    require_premium,
)


@pytest.fixture
async def auth_session(session):
    """Session with a user for auth tests."""
    uid = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    user = User(id=uid, username="testuser", display_name="Test", membership_tier="free")
    session.add(user)
    await session.commit()
    return session


@pytest.fixture
async def premium_session(session):
    """Session with a premium user for auth tests."""
    uid = uuid.UUID("bbbbbbbb-cccc-dddd-eeee-ffffffffffff")
    user = User(id=uid, username="premiumuser", display_name="Premium", membership_tier="premium")
    session.add(user)
    await session.commit()
    return session


@pytest.mark.asyncio
class TestGetCurrentUserOptional:
    async def test_jwt_token(self, auth_session):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="test-token")
        payload = {"sub": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "tier": "free"}
        with patch("src.services.auth_deps.decode_token", return_value=payload):
            user = await get_current_user_optional(
                session=auth_session, credentials=creds, x_user_id=None
            )
            assert user is not None
            assert user.username == "testuser"

    async def test_invalid_jwt(self, auth_session):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad")
        with patch("src.services.auth_deps.decode_token", return_value=None):
            user = await get_current_user_optional(
                session=auth_session, credentials=creds, x_user_id=None
            )
            assert user is None

    async def test_jwt_invalid_uuid(self, auth_session):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="token")
        payload = {"sub": "not-a-uuid", "tier": "free"}
        with patch("src.services.auth_deps.decode_token", return_value=payload):
            user = await get_current_user_optional(
                session=auth_session, credentials=creds, x_user_id=None
            )
            assert user is None

    async def test_x_user_id_fallback(self, auth_session):
        uid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        user = await get_current_user_optional(
            session=auth_session, credentials=None, x_user_id=uid
        )
        assert user is not None
        assert user.username == "testuser"

    async def test_x_user_id_invalid_uuid(self, auth_session):
        user = await get_current_user_optional(
            session=auth_session, credentials=None, x_user_id="not-a-uuid"
        )
        assert user is None

    async def test_no_auth(self, auth_session):
        user = await get_current_user_optional(
            session=auth_session, credentials=None, x_user_id=None
        )
        assert user is None

    async def test_jwt_no_sub_claim(self, auth_session):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="token")
        with patch("src.services.auth_deps.decode_token", return_value={"tier": "free"}):
            user = await get_current_user_optional(
                session=auth_session, credentials=creds, x_user_id=None
            )
            assert user is None


@pytest.mark.asyncio
class TestGetCurrentUser:
    async def test_returns_user(self):
        user = User(username="test")
        result = await get_current_user(user=user)
        assert result.username == "test"

    async def test_raises_401_when_none(self):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(user=None)
        assert exc_info.value.status_code == 401


@pytest.mark.asyncio
class TestRequirePremium:
    async def test_returns_premium_user(self):
        user = User(username="premium", membership_tier="premium")
        result = await require_premium(user=user)
        assert result.membership_tier == "premium"

    async def test_raises_403_for_free(self):
        user = User(username="free", membership_tier="free")
        with pytest.raises(HTTPException) as exc_info:
            await require_premium(user=user)
        assert exc_info.value.status_code == 403
