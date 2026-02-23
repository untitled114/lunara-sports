"""Tests for auth_service and auth_deps."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest

from src.services.auth_service import (
    authenticate,
    create_access_token,
    decode_token,
    register,
)


# Use a consistent mock for settings
@pytest.fixture(autouse=True)
def mock_settings():
    mock = MagicMock()
    mock.jwt_secret = "test-secret-key-12345"
    mock.jwt_algorithm = "HS256"
    mock.jwt_expiry_days = 7
    with patch("src.services.auth_service._settings", mock):
        yield mock


class TestCreateAccessToken:
    def test_creates_valid_token(self):
        token = create_access_token("user-123", "free")
        assert isinstance(token, str)
        assert len(token) > 0

    def test_token_contains_claims(self):
        uid = str(uuid.uuid4())
        token = create_access_token(uid, "premium")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == uid
        assert payload["tier"] == "premium"

    def test_default_tier_is_free(self):
        token = create_access_token("user-1")
        payload = decode_token(token)
        assert payload["tier"] == "free"


class TestDecodeToken:
    def test_valid_token(self):
        token = create_access_token("test-user")
        result = decode_token(token)
        assert result is not None
        assert result["sub"] == "test-user"

    def test_invalid_token(self):
        result = decode_token("invalid.jwt.token")
        assert result is None

    def test_empty_token(self):
        result = decode_token("")
        assert result is None

    def test_wrong_secret(self):
        token = create_access_token("test-user")
        with patch("src.services.auth_service._settings") as mock:
            mock.jwt_secret = "wrong-secret"
            mock.jwt_algorithm = "HS256"
            result = decode_token(token)
            assert result is None


@pytest.mark.asyncio
class TestRegister:
    async def test_register_creates_user(self, session):
        user = await register(session, "newuser", "new@test.com", "password123")
        assert user.username == "newuser"
        assert user.email == "new@test.com"
        assert user.password_hash is not None
        assert user.password_hash != "password123"  # should be hashed

    async def test_register_hashes_password(self, session):
        user = await register(session, "hashtest", "hash@test.com", "mypassword")
        assert user.password_hash.startswith("$2")  # bcrypt prefix


@pytest.mark.asyncio
class TestAuthenticate:
    async def test_valid_credentials(self, session):
        await register(session, "authuser", "auth@test.com", "secret123")
        user = await authenticate(session, "auth@test.com", "secret123")
        assert user is not None
        assert user.username == "authuser"

    async def test_wrong_password(self, session):
        await register(session, "authuser2", "auth2@test.com", "correct")
        user = await authenticate(session, "auth2@test.com", "wrong")
        assert user is None

    async def test_nonexistent_email(self, session):
        user = await authenticate(session, "nobody@test.com", "password")
        assert user is None

    async def test_user_without_password_hash(self, session):
        from src.db.models import User

        user = User(username="nohash", email="nohash@test.com")
        session.add(user)
        await session.commit()
        result = await authenticate(session, "nohash@test.com", "anything")
        assert result is None
