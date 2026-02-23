"""Read-only async connections to Sport-suite PostgreSQL databases."""

from __future__ import annotations

import asyncpg
import structlog

from ..config import Settings

logger = structlog.get_logger(__name__)

_players_pool: asyncpg.Pool | None = None  # port 5536
_games_pool: asyncpg.Pool | None = None  # port 5537
_teams_pool: asyncpg.Pool | None = None  # port 5538


async def init_sport_suite(settings: Settings) -> None:
    """Create connection pools to Sport-suite databases (best-effort)."""
    global _players_pool, _games_pool, _teams_pool

    user = settings.sport_suite_db_user
    password = settings.sport_suite_db_password
    host = settings.sport_suite_db_host

    if not user or not password:
        logger.warning("sport_suite.skipped", reason="no credentials configured")
        return

    try:
        _players_pool = await asyncpg.create_pool(
            host=host,
            port=5536,
            user=user,
            password=password,
            database="nba_players",
            min_size=1,
            max_size=3,
        )
        logger.info("sport_suite.players_connected", port=5536)
    except Exception as e:
        logger.warning("sport_suite.players_failed", error=str(e))

    try:
        _games_pool = await asyncpg.create_pool(
            host=host,
            port=5537,
            user=user,
            password=password,
            database="nba_games",
            min_size=1,
            max_size=3,
        )
        logger.info("sport_suite.games_connected", port=5537)
    except Exception as e:
        logger.warning("sport_suite.games_failed", error=str(e))

    try:
        _teams_pool = await asyncpg.create_pool(
            host=host,
            port=5538,
            user=user,
            password=password,
            database="nba_team",
            min_size=1,
            max_size=3,
        )
        logger.info("sport_suite.teams_connected", port=5538)
    except Exception as e:
        logger.warning("sport_suite.teams_failed", error=str(e))


async def close_sport_suite() -> None:
    """Close all Sport-suite connection pools."""
    global _players_pool, _games_pool, _teams_pool
    for name, pool in [("players", _players_pool), ("games", _games_pool), ("teams", _teams_pool)]:
        if pool:
            await pool.close()
            logger.info("sport_suite.closed", db=name)
    _players_pool = _games_pool = _teams_pool = None


def get_players_pool() -> asyncpg.Pool | None:
    return _players_pool


def get_games_pool() -> asyncpg.Pool | None:
    return _games_pool


def get_teams_pool() -> asyncpg.Pool | None:
    return _teams_pool
