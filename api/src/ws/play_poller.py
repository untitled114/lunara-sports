"""Background poller that watches PostgreSQL for new plays and broadcasts via WebSocket.

Runs as an asyncio background task during the API lifespan. For each game
with active WebSocket subscribers, it polls PG for plays with sequence_number
above the last-seen watermark and broadcasts them. Ingestion writes plays
straight to Postgres, so this poll is the sole play-broadcast path.
"""

from __future__ import annotations

import asyncio
import time

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..db.models import Play
from ..db.session import get_session_factory
from ..metrics import espn_polls_total
from .live_feed import manager

logger = structlog.get_logger(__name__)

# Track the highest sequence number we've broadcast per game
_watermarks: dict[str, int] = {}

POLL_INTERVAL = 0.25  # seconds — the only path from a new DB play to WebSocket clients
ERROR_LOG_WINDOW = 60.0  # seconds — at most one ws.poller_error per window (PG down)


def forget_watermark(game_id: str) -> None:
    """Drop a game's watermark once its room empties, so a later first joiner starts
    from that joiner's history instead of replaying everything since it was set."""
    _watermarks.pop(game_id, None)


manager.on_room_emptied(forget_watermark)


def _play_to_dict(play: Play) -> dict:
    return {
        "id": play.id,
        "game_id": play.game_id,
        "sequence_number": play.sequence_number,
        "quarter": play.quarter,
        "clock": play.clock,
        "event_type": play.event_type,
        "description": play.description,
        "team": play.team,
        "player_name": play.player_name,
        "home_score": play.home_score,
        "away_score": play.away_score,
        "created_at": play.created_at.isoformat() if play.created_at else None,
    }


async def poll_once(session_factory: async_sessionmaker[AsyncSession] | None) -> None:
    """Run one poll cycle: broadcast new plays for games that have WebSocket subscribers."""
    espn_polls_total.labels(collector="play_poller").inc()
    active_games = manager.active_games()
    if not active_games:
        return

    if session_factory is None:
        return

    async with session_factory() as session:
        for game_id in active_games:
            watermark = _watermarks.get(game_id, 0)

            stmt = (
                select(Play)
                .where(Play.game_id == game_id, Play.sequence_number > watermark)
                .order_by(Play.sequence_number)
                .limit(50)
            )
            result = await session.execute(stmt)
            new_plays = result.scalars().all()

            if not new_plays:
                continue

            for play in new_plays:
                msg = {"type": "play", "data": _play_to_dict(play)}
                await manager.broadcast(game_id, msg)

            max_seq = max(p.sequence_number for p in new_plays)
            _watermarks[game_id] = max_seq

            logger.debug(
                "ws.polled_plays",
                game_id=game_id,
                new_plays=len(new_plays),
                watermark=max_seq,
            )


async def _poll_once() -> None:
    """One cycle against the app's session factory (resolved each cycle; set in lifespan)."""
    await poll_once(get_session_factory())


async def run_play_poller() -> None:
    """Run the play poller loop indefinitely."""
    logger.info("ws.poller_started", interval=POLL_INTERVAL)
    last_logged: float | None = None
    suppressed = 0
    while True:
        try:
            await _poll_once()
        except Exception as e:
            # 4 cycles/s against a down Postgres would flood the journal.
            now = time.monotonic()
            if last_logged is None or now - last_logged >= ERROR_LOG_WINDOW:
                logger.warning("ws.poller_error", error=str(e), suppressed=suppressed)
                last_logged, suppressed = now, 0
            else:
                suppressed += 1
        await asyncio.sleep(POLL_INTERVAL)


async def get_recent_plays(game_id: str, limit: int = 50) -> list[dict]:
    """Fetch recent plays from PG for initial WebSocket payload."""
    factory = get_session_factory()
    if factory is None:
        return []

    async with factory() as session:
        stmt = (
            select(Play)
            .where(Play.game_id == game_id)
            .order_by(Play.sequence_number.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        plays = list(reversed(result.scalars().all()))

        # A game's FIRST joiner starts the watermark at its history, so the poller
        # doesn't re-broadcast it. A later joiner must not move it: plays committed
        # since the poller's last cycle would never reach the clients already here.
        if plays:
            _watermarks.setdefault(game_id, max(p.sequence_number for p in plays))

        return [_play_to_dict(p) for p in plays]
