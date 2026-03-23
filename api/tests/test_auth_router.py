"""Tests for auth router — register, login, profile."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch


class TestRegister:
    async def test_register_success(self, client):
        mock_user = MagicMock()
        mock_user.id = uuid.uuid4()
        mock_user.username = "newuser"
        mock_user.membership_tier = "free"

        with (
            patch("src.routers.auth.register", new_callable=AsyncMock, return_value=mock_user),
            patch("src.routers.auth.create_access_token", return_value="jwt-token-123"),
        ):
            resp = await client.post(
                "/auth/register",
                json={
                    "username": "newuser",
                    "email": "new@example.com",
                    "password": "password123",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["token"] == "jwt-token-123"
            assert data["username"] == "newuser"

    async def test_register_duplicate(self, client):
        with patch(
            "src.routers.auth.register",
            new_callable=AsyncMock,
            side_effect=Exception("unique constraint"),
        ):
            resp = await client.post(
                "/auth/register",
                json={
                    "username": "existinguser",
                    "email": "existing@example.com",
                    "password": "password123",
                },
            )
            assert resp.status_code == 409

    async def test_register_duplicate_key(self, client):
        with patch(
            "src.routers.auth.register",
            new_callable=AsyncMock,
            side_effect=Exception("duplicate key value"),
        ):
            resp = await client.post(
                "/auth/register",
                json={
                    "username": "user",
                    "email": "user@example.com",
                    "password": "password123",
                },
            )
            assert resp.status_code == 409


class TestLogin:
    async def test_login_success(self, client):
        mock_user = MagicMock()
        mock_user.id = uuid.uuid4()
        mock_user.username = "testuser"
        mock_user.membership_tier = "premium"

        with (
            patch("src.routers.auth.authenticate", new_callable=AsyncMock, return_value=mock_user),
            patch("src.routers.auth.create_access_token", return_value="jwt-token-456"),
        ):
            resp = await client.post(
                "/auth/login",
                json={
                    "email": "test@example.com",
                    "password": "password123",
                },
            )
            assert resp.status_code == 200
            assert resp.json()["token"] == "jwt-token-456"

    async def test_login_invalid(self, client):
        with patch("src.routers.auth.authenticate", new_callable=AsyncMock, return_value=None):
            resp = await client.post(
                "/auth/login",
                json={
                    "email": "bad@example.com",
                    "password": "wrongpass",
                },
            )
            assert resp.status_code == 401


class TestProfile:
    async def test_get_profile(self, client):
        mock_user = MagicMock()
        mock_user.id = uuid.uuid4()
        mock_user.username = "testuser"
        mock_user.email = "test@example.com"
        mock_user.display_name = "Test User"
        mock_user.membership_tier = "free"
        mock_user.prediction_score = 100

        with patch("src.routers.auth.get_current_user", return_value=mock_user):
            # Need to provide a valid JWT or override the dependency
            from src.main import app
            from src.services.auth_deps import get_current_user

            app.dependency_overrides[get_current_user] = lambda: mock_user
            try:
                resp = await client.get("/auth/me")
                assert resp.status_code == 200
                assert resp.json()["username"] == "testuser"
            finally:
                app.dependency_overrides.pop(get_current_user, None)
