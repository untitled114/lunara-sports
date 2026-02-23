"""Redis client for live game state caching."""

from __future__ import annotations

import json

import redis.asyncio as redis
import structlog

from ..config import Settings

logger = structlog.get_logger(__name__)

_pool: redis.Redis | None = None


async def init_redis(settings: Settings) -> None:
    """Create the global Redis connection pool."""
    global _pool
    _pool = redis.from_url(settings.redis_url, decode_responses=True)
    logger.info("redis.connected", url=settings.redis_url)


async def close_redis() -> None:
    """Close the Redis connection pool."""
    global _pool
    if _pool:
        await _pool.aclose()
        _pool = None
        logger.info("redis.closed")


def get_redis() -> redis.Redis:
    """FastAPI dependency that returns the Redis client."""
    if _pool is None:
        raise RuntimeError("Redis not initialized — call init_redis() in lifespan")
    return _pool


# ── Cache helpers ────────────────────────────────────────────────────────

GAME_STATE_TTL = 15  # seconds — refreshed every poll cycle (10s)
GAME_LIST_TTL = 12  # seconds — scoreboard poller refreshes every 10s


async def cache_game_state(game_id: str, state: dict) -> None:
    """Write live game state to Redis."""
    r = get_redis()
    await r.set(f"game:{game_id}", json.dumps(state, default=str), ex=GAME_STATE_TTL)


async def get_cached_game_state(game_id: str) -> dict | None:
    """Read cached game state from Redis. Returns None on miss."""
    r = get_redis()
    raw = await r.get(f"game:{game_id}")
    if raw:
        return json.loads(raw)
    return None


async def cache_game_list(date_str: str, games: list[dict]) -> None:
    """Cache a day's game list in Redis."""
    r = get_redis()
    await r.set(f"games:{date_str}", json.dumps(games, default=str), ex=GAME_LIST_TTL)


async def get_cached_game_list(date_str: str) -> list[dict] | None:
    """Read cached game list. Returns None on miss."""
    r = get_redis()
    raw = await r.get(f"games:{date_str}")
    if raw:
        return json.loads(raw)
    return None


async def redis_ping() -> bool:
    """Health check — returns True if Redis is reachable."""
    try:
        r = get_redis()
        return await r.ping()
    except Exception:
        return False
