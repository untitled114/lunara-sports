"""ESPN API client with Redis caching for NBA data."""

from __future__ import annotations

import json

import httpx
import structlog

from ..db.redis import get_redis

logger = structlog.get_logger(__name__)

BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"

# Cache TTLs (seconds)
STANDINGS_TTL = 1800  # 30 min
ROSTER_TTL = 86400  # 24 hr
LEADERS_TTL = 3600  # 1 hr
SUMMARY_TTL = 300  # 5 min
SCOREBOARD_TTL = 8  # 8s — sub-poller interval for fast live updates

_client: httpx.AsyncClient | None = None


def init_espn_client() -> None:
    global _client
    _client = httpx.AsyncClient(timeout=15.0, follow_redirects=True)
    logger.info("espn_client.initialized")


async def close_espn_client() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None
        logger.info("espn_client.closed")


def _get_client() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("ESPN client not initialized — call init_espn_client() in lifespan")
    return _client


async def _cached_get(
    cache_key: str, url: str, ttl: int, params: dict | None = None
) -> dict | list | None:
    """Fetch from Redis cache or ESPN API with automatic caching."""
    r = get_redis()
    raw = await r.get(cache_key)
    if raw:
        logger.debug("espn.cache_hit", key=cache_key)
        return json.loads(raw)

    client = _get_client()
    try:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        await r.set(cache_key, json.dumps(data), ex=ttl)
        logger.info("espn.fetched", url=url, status=resp.status_code)
        return data
    except httpx.HTTPError as e:
        logger.error("espn.fetch_error", url=url, error=str(e))
        return None


async def get_standings() -> dict | None:
    """Fetch NBA standings from ESPN.

    Note: The standings endpoint uses /apis/v2/ (not /apis/site/v2/).
    """
    return await _cached_get(
        "espn:standings",
        "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings",
        STANDINGS_TTL,
    )


async def get_team_roster(espn_id: int) -> dict | None:
    """Fetch team roster from ESPN by team ID."""
    return await _cached_get(
        f"espn:roster:{espn_id}",
        f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{espn_id}",
        ROSTER_TTL,
        params={"enable": "roster"},
    )


async def get_stat_leaders(limit: int = 10) -> dict | None:
    """Fetch league stat leaders from ESPN core API (seasonal per-game)."""
    return await _cached_get(
        f"espn:leaders:v2:{limit}",
        "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2025/types/2/leaders",
        LEADERS_TTL,
        params={"limit": str(limit)},
    )


async def get_game_summary(event_id: str) -> dict | None:
    """Fetch game summary (box score) from ESPN."""
    return await _cached_get(
        f"espn:summary:{event_id}",
        f"{BASE_URL}/summary",
        SUMMARY_TTL,
        params={"event": event_id},
    )


ATHLETE_STATS_TTL = 3600  # 1 hr
ATHLETE_INFO_TTL = 86400  # 24 hr

COMMON_V3 = "https://site.api.espn.com/apis/common/v3/sports/basketball/nba"


async def get_athlete_stats(espn_id: str) -> dict | None:
    """Fetch career season-by-season stats for an athlete."""
    return await _cached_get(
        f"espn:athlete:stats:{espn_id}",
        f"{COMMON_V3}/athletes/{espn_id}/stats",
        ATHLETE_STATS_TTL,
    )


async def get_athlete_gamelog(espn_id: str) -> dict | None:
    """Fetch per-game log for an athlete (current season)."""
    return await _cached_get(
        f"espn:athlete:gamelog:{espn_id}",
        f"{COMMON_V3}/athletes/{espn_id}/gamelog",
        ATHLETE_STATS_TTL,
    )


async def get_athlete_info(espn_id: str) -> dict | None:
    """Fetch athlete bio/info from ESPN common v3 API."""
    return await _cached_get(
        f"espn:athlete:info:{espn_id}",
        f"{COMMON_V3}/athletes/{espn_id}",
        ATHLETE_INFO_TTL,
    )


SUMMARY_LIVE_TTL = 30  # 30s for live stat tracking


async def get_game_summary_live(event_id: str) -> dict | None:
    """Fetch game summary with shorter TTL for live stat freshness."""
    return await _cached_get(
        f"espn:summary:live:{event_id}",
        f"{BASE_URL}/summary",
        SUMMARY_LIVE_TTL,
        params={"event": event_id},
    )


async def get_scoreboard(date_str: str | None = None) -> dict | None:
    """Fetch scoreboard for a given date (YYYYMMDD format)."""
    params = {}
    if date_str:
        params["dates"] = date_str
    cache_key = f"espn:scoreboard:{date_str or 'today'}"
    return await _cached_get(
        cache_key,
        f"{BASE_URL}/scoreboard",
        SCOREBOARD_TTL,
        params=params or None,
    )
