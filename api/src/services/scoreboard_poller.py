"""Background scoreboard poller — keeps game scores and statuses current.

Polls ESPN scoreboard every 30 seconds for today's games, upserts into
PostgreSQL, and refreshes the Redis cache so the API always serves live data.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

import structlog
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..db.models import Game
from ..db.redis import cache_game_list, cache_game_state
from ..db.session import get_session_factory
from ..ws.live_feed import manager
from . import espn_client
from .team_mapping import from_espn_abbrev

logger = structlog.get_logger(__name__)

POLL_INTERVAL = 10  # seconds


def _parse_event(event: dict) -> dict | None:
    """Parse a single ESPN event into a game dict for upsert."""
    try:
        game_id = event["id"]
        comp = event.get("competitions", [{}])[0]
        competitors = comp.get("competitors", [])
        if len(competitors) != 2:
            return None

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
            return None

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
        start_time = (
            datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            if start_str
            else datetime.now(timezone.utc)
        )

        # Venue
        venue = comp.get("venue", {}).get("fullName", "")

        # Quarter/clock for live games
        quarter = None
        clock = None
        if status in ("live", "halftime"):
            status_detail = event.get("status", {})
            quarter = status_detail.get("period", None)
            clock = status_detail.get("displayClock", None)

        return {
            "id": game_id,
            "home_team": home_team,
            "away_team": away_team,
            "home_score": home_score,
            "away_score": away_score,
            "status": status,
            "quarter": quarter,
            "clock": clock,
            "start_time": start_time,
            "venue": venue,
        }
    except Exception as e:
        logger.warning("scoreboard_poller.parse_error", event_id=event.get("id"), error=str(e))
        return None


def _eastern_today() -> date:
    """Return today's date in US Eastern time (timezone.utc-5)."""
    utc_now = datetime.now(timezone.utc)
    et_now = utc_now - timedelta(hours=5)
    return et_now.date()


async def _poll_scoreboard() -> None:
    """Fetch today's scoreboard from ESPN, upsert games, refresh caches."""
    today = _eastern_today()
    date_param = today.strftime("%Y%m%d")

    # Bypass ESPN cache for fresh data — use short TTL
    data = await espn_client.get_scoreboard(date_param)
    if not data:
        return

    events = data.get("events", [])
    if not events:
        return

    factory = get_session_factory()
    if factory is None:
        return

    rows = []
    async with factory() as session:
        for event in events:
            parsed = _parse_event(event)
            if not parsed:
                continue

            # Upsert into PG
            stmt = (
                pg_insert(Game)
                .values(
                    id=parsed["id"],
                    home_team=parsed["home_team"],
                    away_team=parsed["away_team"],
                    status=parsed["status"],
                    home_score=parsed["home_score"],
                    away_score=parsed["away_score"],
                    quarter=parsed["quarter"],
                    clock=parsed["clock"],
                    start_time=parsed["start_time"],
                    venue=parsed["venue"],
                )
                .on_conflict_do_update(
                    index_elements=[Game.id],
                    set_={
                        "status": parsed["status"],
                        "home_score": parsed["home_score"],
                        "away_score": parsed["away_score"],
                        "quarter": parsed["quarter"],
                        "clock": parsed["clock"],
                        "venue": parsed["venue"],
                    },
                )
            )
            await session.execute(stmt)

            row = {
                **parsed,
                "start_time": parsed["start_time"].isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            rows.append(row)

            # Cache individual live game states in Redis + broadcast via WebSocket
            if parsed["status"] in ("live", "halftime"):
                await cache_game_state(parsed["id"], row)
                await manager.broadcast(
                    parsed["id"],
                    {
                        "type": "game_update",
                        "data": row,
                    },
                )

        await session.commit()

    # Refresh the game list cache for today
    if rows:
        await cache_game_list(today.isoformat(), rows)
        live_count = sum(1 for r in rows if r.get("status") in ("live", "halftime"))
        logger.info(
            "scoreboard_poller.updated",
            date=today.isoformat(),
            games=len(rows),
            live=live_count,
        )


async def run_scoreboard_poller() -> None:
    """Run the scoreboard poller loop indefinitely."""
    logger.info("scoreboard_poller.started", interval=POLL_INTERVAL)
    # Initial fetch on startup
    try:
        await _poll_scoreboard()
    except Exception:
        logger.exception("scoreboard_poller.initial_error")

    while True:
        await asyncio.sleep(POLL_INTERVAL)
        try:
            await _poll_scoreboard()
        except Exception:
            logger.exception("scoreboard_poller.error")
