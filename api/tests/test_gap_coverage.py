"""Characterization tests closing miscellaneous coverage gaps found by the
2026-09-24 re-measurement (Task 7): db/redis, routers/auth, routers/comments,
routers/games, services/auth_service — plus module-level cross-cutting cases
that don't fit naturally into one existing per-service test file.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

# ── db/redis.py: close_redis() when never initialized ──────────────────


@pytest.mark.asyncio
async def test_close_redis_when_never_initialized_is_noop():
    """close_redis() with _pool already None does nothing (line 27->exit)."""
    import src.db.redis as redis_mod
    from src.db.redis import close_redis

    old = redis_mod._pool
    redis_mod._pool = None
    try:
        await close_redis()  # must not raise
        assert redis_mod._pool is None
    finally:
        redis_mod._pool = old


# ── services/auth_service.py: _get_settings() lazily constructs Settings ──


def test_auth_service_get_settings_constructs_once_and_caches(monkeypatch):
    """_get_settings() builds a real Settings() the first time _settings is
    None (line 24), then returns the cached instance on subsequent calls."""
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


# ── routers/auth.py: register() raising something OTHER than a duplicate ──


class TestRegisterGenericError:
    async def test_non_duplicate_exception_propagates(self, client):
        """register() raising an error unrelated to a unique/duplicate
        constraint is NOT converted to a 409 — it re-raises (line 55)."""
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


# ── routers/comments.py: POST /games/{game_id}/comments ────────────────


class TestPostComment:
    async def test_creates_comment_and_returns_201(self, client):
        resp = await client.post(
            "/games/401810001/comments",
            json={"body": "What a game!"},
            headers={"X-User-Id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"},
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
            headers={"X-User-Id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"},
        )
        assert resp.status_code == 201
        assert resp.json()["play_id"] == 1

    async def test_missing_game_is_not_rejected_today(self, client):
        """Characterization: post_comment does not check game existence at
        all — SQLite FK enforcement is also off in this test DB — so a
        comment against a non-existent game_id is still created (201), not
        the 404 one might expect. This is a discrepancy from the original
        task brief's expected case, not a fix; see the Task 7 report."""
        resp = await client.post(
            "/games/NO_SUCH_GAME/comments",
            json={"body": "orphaned comment"},
            headers={"X-User-Id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"},
        )
        assert resp.status_code == 201
        assert resp.json()["game_id"] == "NO_SUCH_GAME"


# ── routers/games.py: GET /games/{game_id} not found ────────────────────


class TestGameDetailNotFound:
    async def test_unknown_game_returns_404(self, client):
        resp = await client.get("/games/NO_SUCH_GAME")
        assert resp.status_code == 404
        assert "NO_SUCH_GAME" in resp.json()["detail"]
