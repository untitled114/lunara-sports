"""Game service — fetch games from PostgreSQL with ESPN fallback for missing dates."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

# US Eastern offset (EST = UTC-5; simplification — ignoring DST for now)
_ET_OFFSET = timedelta(hours=5)

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..db.models import Game
from ..db.redis import (
    cache_game_list,
    cache_game_state,
    get_cached_game_list,
    get_cached_game_state,
)
from . import espn_client
from .team_mapping import from_espn_abbrev

logger = structlog.get_logger(__name__)


async def get_games(session: AsyncSession, game_date: date | None = None) -> list[dict]:
    """Return games for the given date (defaults to today).

    Checks Redis cache first; on miss, queries PostgreSQL.
    If PG returns nothing, fetches from ESPN scoreboard and upserts into PG.
    """
    # Default to Eastern date since NBA schedules are in ET
    target = game_date or (datetime.now(timezone.utc) - _ET_OFFSET).date()
    date_str = target.isoformat()

    # Check cache
    cached = await get_cached_game_list(date_str)
    if cached is not None:
        logger.debug("games.cache_hit", date=date_str, count=len(cached))
        return cached

    # For today's date, always fetch fresh from ESPN to capture live scores.
    # For other dates, query PG first.
    if target == date.today():
        rows = await _fetch_and_upsert_espn(session, target)
        if not rows:
            rows = await _query_pg(session, target)
    else:
        rows = await _query_pg(session, target)
        if not rows:
            rows = await _fetch_and_upsert_espn(session, target)

    # Populate cache
    if rows:
        await cache_game_list(date_str, rows)
    logger.info("games.fetched", date=date_str, count=len(rows))
    return rows


async def get_game(session: AsyncSession, game_id: str) -> dict | None:
    """Return a single game by ID.

    Checks Redis for live state first, falls back to PostgreSQL.
    """
    # Check Redis for live state
    cached = await get_cached_game_state(game_id)
    if cached is not None:
        logger.debug("game.cache_hit", game_id=game_id)
        return cached

    # Query PG
    stmt = (
        select(Game)
        .options(selectinload(Game.home_team_ref), selectinload(Game.away_team_ref))
        .where(Game.id == game_id)
    )
    result = await session.execute(stmt)
    game = result.scalar_one_or_none()

    if game is None:
        return None

    row = _game_to_dict(game)

    # Cache live games
    if game.status in ("live", "halftime"):
        await cache_game_state(game_id, row)

    return row


async def _query_pg(session: AsyncSession, target: date) -> list[dict]:
    """Query PostgreSQL for games on a given date (ET-aware window)."""
    # NBA games are scheduled in ET. A 7pm ET game on Feb 19 = midnight UTC Feb 20.
    # Shift the window by 5 hours (EST) so queries match the local game date.
    et_offset = timedelta(hours=5)
    day_start = datetime.combine(target, time.min, tzinfo=timezone.utc) + et_offset
    day_end = datetime.combine(target, time.max, tzinfo=timezone.utc) + et_offset

    stmt = (
        select(Game)
        .options(selectinload(Game.home_team_ref), selectinload(Game.away_team_ref))
        .where(Game.start_time >= day_start, Game.start_time <= day_end)
        .order_by(Game.start_time)
    )
    result = await session.execute(stmt)
    games = result.scalars().all()
    return [_game_to_dict(g) for g in games]


async def _fetch_and_upsert_espn(session: AsyncSession, target: date) -> list[dict]:
    """Fetch games from ESPN scoreboard for a date, upsert into PG, return dicts."""
    date_param = target.strftime("%Y%m%d")
    data = await espn_client.get_scoreboard(date_param)
    if not data:
        return []

    events = data.get("events", [])
    if not events:
        return []

    rows = []
    for event in events:
        try:
            game_id = event["id"]
            comp = event.get("competitions", [{}])[0]
            competitors = comp.get("competitors", [])
            if len(competitors) != 2:
                continue

            home_team = away_team = None
            home_score = away_score = 0
            for team in competitors:
                abbrev = from_espn_abbrev(team.get("team", {}).get("abbreviation", ""))
                ha = team.get("homeAway", "")
                score = int(team.get("score", 0) or 0)
                if ha == "home":
                    home_team = abbrev
                    home_score = score
                else:
                    away_team = abbrev
                    away_score = score

            if not home_team or not away_team:
                continue

            # Parse status
            status_data = event.get("status", {}).get("type", {})
            espn_state = status_data.get("state", "pre")
            if espn_state == "post":
                status = "final"
            elif espn_state == "in":
                desc = status_data.get("description", "").lower()
                status = "halftime" if "halftime" in desc else "live"
            else:
                status = "scheduled"

            # Parse start time
            start_str = comp.get("date", event.get("date", ""))
            start_time = datetime.fromisoformat(start_str.replace("Z", "+00:00")) if start_str else datetime.now(timezone.utc)

            # Venue
            venue = comp.get("venue", {}).get("fullName", "")

            # Quarter/clock for live games
            quarter = None
            clock = None
            if status in ("live", "halftime"):
                status_detail = event.get("status", {})
                quarter = status_detail.get("period", None)
                clock = status_detail.get("displayClock", None)

            # Upsert into PG
            stmt = pg_insert(Game).values(
                id=game_id,
                home_team=home_team,
                away_team=away_team,
                status=status,
                home_score=home_score,
                away_score=away_score,
                quarter=quarter,
                clock=clock,
                start_time=start_time,
                venue=venue,
            ).on_conflict_do_update(
                index_elements=[Game.id],
                set_={
                    "status": status,
                    "home_score": home_score,
                    "away_score": away_score,
                    "quarter": quarter,
                    "clock": clock,
                    "venue": venue,
                },
            )
            await session.execute(stmt)

            rows.append({
                "id": game_id,
                "home_team": home_team,
                "away_team": away_team,
                "home_score": home_score,
                "away_score": away_score,
                "status": status,
                "quarter": quarter,
                "clock": clock,
                "start_time": start_time.isoformat(),
                "venue": venue,
                "updated_at": None,
            })
        except Exception as e:
            logger.warning("games.espn_parse_error", event_id=event.get("id"), error=str(e))
            continue

    if rows:
        await session.commit()
        logger.info("games.espn_upserted", date=target.isoformat(), count=len(rows))

    return rows


def _game_to_dict(game: Game) -> dict:
    d = {
        "id": game.id,
        "home_team": game.home_team,
        "away_team": game.away_team,
        "home_score": game.home_score,
        "away_score": game.away_score,
        "status": game.status,
        "quarter": game.quarter,
        "clock": game.clock,
        "start_time": game.start_time.isoformat() if game.start_time else None,
        "venue": game.venue,
        "updated_at": game.updated_at.isoformat() if game.updated_at else None,
    }
    # Add full team names if relationships are loaded
    if hasattr(game, "home_team_ref") and game.home_team_ref:
        d["home_team_full"] = game.home_team_ref.name
    if hasattr(game, "away_team_ref") and game.away_team_ref:
        d["away_team_full"] = game.away_team_ref.name
    return d
