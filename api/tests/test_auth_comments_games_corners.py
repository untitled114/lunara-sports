"""Behaviour of db/redis, routers/auth, routers/comments, routers/games and
services/auth_service not covered elsewhere, plus module-level cases that don't fit
one per-service test file.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from .auth_helpers import bearer

# db/redis.py: close_redis() when never initialized


@pytest.mark.asyncio
async def test_close_redis_when_never_initialized_is_noop(capsys):
    """close_redis() with _pool already None does nothing:
    the `if _pool:` guard skips aclose() and the "redis.closed" log line."""
    import src.db.redis as redis_mod
    from src.db.redis import close_redis

    old = redis_mod._pool
    redis_mod._pool = None
    try:
        await close_redis()
        assert "redis.closed" not in capsys.readouterr().out
    finally:
        redis_mod._pool = old


# services/auth_service.py: _get_settings() lazily constructs Settings


def test_auth_service_get_settings_constructs_once_and_caches(monkeypatch):
    """_get_settings() builds a real Settings() the first time _settings is
    None, then returns the cached instance on subsequent calls."""
    import src.services.auth_service as auth_service_mod

    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
    old = auth_service_mod._settings
    auth_service_mod._settings = None
    try:
        first = auth_service_mod._get_settings()
        from src.config import Settings

        assert isinstance(first, Settings)
        second = auth_service_mod._get_settings()
        assert first is second
    finally:
        auth_service_mod._settings = old


# routers/auth.py: register() raising something OTHER than a duplicate


class TestRegisterGenericError:
    async def test_non_duplicate_exception_propagates(self, client):
        """register() raising an error unrelated to a unique/duplicate
        constraint is NOT converted to a 409 - it re-raises."""
        with patch(
            "src.routers.auth.register",
            new_callable=AsyncMock,
            side_effect=RuntimeError("database connection lost"),
        ):
            with pytest.raises(RuntimeError, match="database connection lost"):
                await client.post(
                    "/auth/register",
                    json={
                        "username": "someuser",
                        "email": "some@example.com",
                        "password": "password123",
                    },
                )


# routers/comments.py: POST /games/{game_id}/comments


class TestPostComment:
    async def test_creates_comment_and_returns_201(self, client):
        resp = await client.post(
            "/games/401810001/comments",
            json={"body": "What a game!"},
            headers=bearer("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["body"] == "What a game!"
        assert data["game_id"] == "401810001"
        assert data["user_id"] == "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

    async def test_creates_comment_with_play_id(self, client):
        resp = await client.post(
            "/games/401810001/comments",
            json={"body": "Nice shot", "play_id": 1},
            headers=bearer("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        )
        assert resp.status_code == 201
        assert resp.json()["play_id"] == 1

    async def test_missing_game_returns_404(self, client):
        """A comment on a game that does not exist is a 404, not an orphaned row."""
        resp = await client.post(
            "/games/NO_SUCH_GAME/comments",
            json={"body": "orphaned comment"},
            headers=bearer("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        )
        assert resp.status_code == 404


# routers/games.py: GET /games/{game_id} not found


class TestGameDetailNotFound:
    async def test_unknown_game_returns_404(self, client):
        resp = await client.get("/games/NO_SUCH_GAME")
        assert resp.status_code == 404
        assert "NO_SUCH_GAME" in resp.json()["detail"]
