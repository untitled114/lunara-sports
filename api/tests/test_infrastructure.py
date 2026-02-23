"""Tests for infrastructure — db session, redis, sport_suite, config, schemas."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.config import Settings
from src.db.redis import (
    GAME_LIST_TTL,
    GAME_STATE_TTL,
    cache_game_list,
    cache_game_state,
    close_redis,
    get_cached_game_list,
    get_cached_game_state,
    get_redis,
    init_redis,
    redis_ping,
)
from src.db.session import close_db, db_ping, get_session, get_session_factory
from src.db.sport_suite import (
    close_sport_suite,
    get_games_pool,
    get_players_pool,
    get_teams_pool,
    init_sport_suite,
)

# ── Config ────────────────────────────────────────────────────────────


class TestSettings:
    def test_default_settings(self):
        with patch.dict(
            "os.environ",
            {
                "DATABASE_URL": "postgresql+asyncpg://test:test@localhost:5432/test",
            },
            clear=False,
        ):
            s = Settings()
            assert "postgresql" in s.database_url
            assert s.jwt_algorithm == "HS256"
            assert s.jwt_expiry_days == 7


# ── Redis ─────────────────────────────────────────────────────────────


class TestRedis:
    def test_get_redis_raises_when_not_initialized(self):
        import src.db.redis as redis_mod

        old = redis_mod._pool
        redis_mod._pool = None
        try:
            with pytest.raises(RuntimeError, match="not initialized"):
                get_redis()
        finally:
            redis_mod._pool = old

    @pytest.mark.asyncio
    async def test_init_and_close(self):
        settings = MagicMock()
        settings.redis_url = "redis://localhost:6379/0"
        with patch("src.db.redis.redis") as mock_redis:
            mock_client = AsyncMock()
            mock_redis.from_url = MagicMock(return_value=mock_client)
            await init_redis(settings)
            import src.db.redis as redis_mod

            assert redis_mod._pool is not None
            await close_redis()
            assert redis_mod._pool is None

    @pytest.mark.asyncio
    async def test_cache_game_state(self):
        mock_r = AsyncMock()
        with patch("src.db.redis._pool", mock_r):
            await cache_game_state("g1", {"status": "live"})
            mock_r.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_cached_game_state_hit(self):
        mock_r = AsyncMock()
        mock_r.get = AsyncMock(return_value='{"status": "live"}')
        with patch("src.db.redis._pool", mock_r):
            result = await get_cached_game_state("g1")
            assert result == {"status": "live"}

    @pytest.mark.asyncio
    async def test_get_cached_game_state_miss(self):
        mock_r = AsyncMock()
        mock_r.get = AsyncMock(return_value=None)
        with patch("src.db.redis._pool", mock_r):
            result = await get_cached_game_state("g1")
            assert result is None

    @pytest.mark.asyncio
    async def test_cache_game_list(self):
        mock_r = AsyncMock()
        with patch("src.db.redis._pool", mock_r):
            await cache_game_list("2026-02-20", [{"id": "g1"}])
            mock_r.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_cached_game_list_hit(self):
        mock_r = AsyncMock()
        mock_r.get = AsyncMock(return_value='[{"id": "g1"}]')
        with patch("src.db.redis._pool", mock_r):
            result = await get_cached_game_list("2026-02-20")
            assert result == [{"id": "g1"}]

    @pytest.mark.asyncio
    async def test_get_cached_game_list_miss(self):
        mock_r = AsyncMock()
        mock_r.get = AsyncMock(return_value=None)
        with patch("src.db.redis._pool", mock_r):
            result = await get_cached_game_list("2026-02-20")
            assert result is None

    @pytest.mark.asyncio
    async def test_redis_ping_success(self):
        mock_r = AsyncMock()
        mock_r.ping = AsyncMock(return_value=True)
        with patch("src.db.redis._pool", mock_r):
            assert await redis_ping() is True

    @pytest.mark.asyncio
    async def test_redis_ping_failure(self):
        mock_r = AsyncMock()
        mock_r.ping = AsyncMock(side_effect=Exception("connection refused"))
        with patch("src.db.redis._pool", mock_r):
            assert await redis_ping() is False

    def test_ttl_constants(self):
        assert GAME_STATE_TTL > 0
        assert GAME_LIST_TTL > 0


# ── DB Session ────────────────────────────────────────────────────────


class TestDbSession:
    def test_get_session_factory_none(self):
        import src.db.session as session_mod

        old = session_mod._session_factory
        session_mod._session_factory = None
        try:
            assert get_session_factory() is None
        finally:
            session_mod._session_factory = old

    @pytest.mark.asyncio
    async def test_get_session_raises_when_not_initialized(self):
        import src.db.session as session_mod

        old = session_mod._session_factory
        session_mod._session_factory = None
        try:
            with pytest.raises(RuntimeError, match="not initialized"):
                async for _ in get_session():
                    pass
        finally:
            session_mod._session_factory = old

    @pytest.mark.asyncio
    async def test_db_ping_false_when_no_engine(self):
        import src.db.session as session_mod

        old = session_mod._engine
        session_mod._engine = None
        try:
            assert await db_ping() is False
        finally:
            session_mod._engine = old

    @pytest.mark.asyncio
    async def test_close_db_when_no_engine(self):
        import src.db.session as session_mod

        old_engine = session_mod._engine
        old_factory = session_mod._session_factory
        session_mod._engine = None
        session_mod._session_factory = None
        try:
            await close_db()  # should not raise
        finally:
            session_mod._engine = old_engine
            session_mod._session_factory = old_factory


# ── Sport-Suite Pools ─────────────────────────────────────────────────


class TestSportSuite:
    def test_get_pools_none_by_default(self):
        import src.db.sport_suite as ss_mod

        old_p, old_g, old_t = ss_mod._players_pool, ss_mod._games_pool, ss_mod._teams_pool
        ss_mod._players_pool = None
        ss_mod._games_pool = None
        ss_mod._teams_pool = None
        try:
            assert get_players_pool() is None
            assert get_games_pool() is None
            assert get_teams_pool() is None
        finally:
            ss_mod._players_pool = old_p
            ss_mod._games_pool = old_g
            ss_mod._teams_pool = old_t

    @pytest.mark.asyncio
    async def test_init_skips_without_credentials(self):
        settings = MagicMock()
        settings.sport_suite_db_user = ""
        settings.sport_suite_db_password = ""
        settings.sport_suite_db_host = "localhost"
        await init_sport_suite(settings)
        assert get_players_pool() is None

    @pytest.mark.asyncio
    async def test_close_sport_suite(self):
        import src.db.sport_suite as ss_mod

        mock_pool = AsyncMock()
        ss_mod._players_pool = mock_pool
        ss_mod._games_pool = mock_pool
        ss_mod._teams_pool = mock_pool
        await close_sport_suite()
        assert ss_mod._players_pool is None
        assert ss_mod._games_pool is None
        assert ss_mod._teams_pool is None

    @pytest.mark.asyncio
    async def test_init_handles_connection_failure(self):
        settings = MagicMock()
        settings.sport_suite_db_user = "user"
        settings.sport_suite_db_password = "pass"
        settings.sport_suite_db_host = "localhost"
        with patch("src.db.sport_suite.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(side_effect=Exception("connection refused"))
            await init_sport_suite(settings)
            # Should not raise, just log warnings
            assert get_players_pool() is None
