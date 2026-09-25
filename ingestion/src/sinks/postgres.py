"""PostgresSink — write games and plays straight to the Lunara database."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import asyncpg
import structlog

logger = structlog.get_logger(__name__)

TOPIC_SCOREBOARD = "raw.scoreboard"
TOPIC_PLAYS = "raw.plays"

# Transient: the connection/pool itself is unusable right now. Keep the buffer
# and retry on the next flush — no play is lost.
_TRANSIENT_ERRORS = (
    asyncpg.PostgresConnectionError,
    asyncpg.InterfaceError,
    OSError,
    asyncio.TimeoutError,
)

# Row-level: the batch itself is fine, but one row is bad data (FK violation,
# value out of range, etc). Fall back to row-by-row and skip only that row.
_ROW_ERRORS = (asyncpg.IntegrityConstraintViolationError, asyncpg.DataError)

UPSERT_GAME_SQL = """
INSERT INTO games (id, home_team, away_team, status, home_score, away_score,
                   quarter, clock, start_time, venue)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status, home_score = EXCLUDED.home_score,
    away_score = EXCLUDED.away_score, quarter = EXCLUDED.quarter,
    clock = EXCLUDED.clock, venue = EXCLUDED.venue, updated_at = now()
""".strip()

INSERT_PLAY_SQL = """
INSERT INTO plays (game_id, sequence_number, quarter, clock, event_type, description,
                   team, player_name, home_score, away_score)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (game_id, sequence_number) DO NOTHING
""".strip()


def _start_time(raw) -> datetime:
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            pass
    elif isinstance(raw, int | float):
        return datetime.fromtimestamp(raw / 1000, tz=timezone.utc)
    return datetime.now(timezone.utc)


def _game_row(v: dict) -> tuple:
    return (
        v["game_id"],
        v["home_team"],
        v["away_team"],
        v["status"],
        v.get("home_score", 0),
        v.get("away_score", 0),
        v.get("quarter"),
        v.get("clock"),
        _start_time(v.get("start_time")),
        v.get("venue"),
    )


def _play_row(v: dict) -> tuple:
    return (
        v["game_id"],
        v["sequence_number"],
        v["quarter"],
        v.get("clock"),
        v.get("event_type"),
        v.get("description"),
        v.get("team"),
        v.get("player_name"),
        v.get("home_score"),
        v.get("away_score"),
    )


class PostgresSink:
    """Buffers events; flush() writes games then plays in one transaction.

    Transient DB errors (connection/interface/timeout) keep the buffer for the
    next flush (no lost plays). A per-row integrity failure (unknown team/game
    FK, out-of-range value) falls back to row-by-row so only the offending row
    is skipped.
    """

    def __init__(self, dsn: str, pool: asyncpg.Pool | None = None) -> None:
        self._dsn = dsn
        self._pool = pool
        self._games: dict[str, tuple] = {}
        self._plays: list[tuple] = []

    async def connect(self) -> None:
        self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=4)

    @property
    def pending(self) -> int:
        return len(self._games) + len(self._plays)

    def produce(self, topic: str, key: str, value: dict) -> None:
        if topic == TOPIC_SCOREBOARD:
            self._games[value["game_id"]] = _game_row(value)  # latest state wins
        elif topic == TOPIC_PLAYS:
            self._plays.append(_play_row(value))
        else:
            raise ValueError(f"unknown topic: {topic}")

    async def flush(self) -> None:
        if not self.pending:
            return
        if self._pool is None:
            raise RuntimeError("PostgresSink not connected")
        games, plays = list(self._games.values()), list(self._plays)
        try:
            async with self._pool.acquire() as conn, conn.transaction():
                await self._write(conn, UPSERT_GAME_SQL, games)
                await self._write(conn, INSERT_PLAY_SQL, plays)
        except _TRANSIENT_ERRORS as exc:
            logger.warning("sink.flush_deferred", error=str(exc), pending=self.pending)
            return
        self._games.clear()
        self._plays.clear()

    @staticmethod
    async def _write(conn, sql: str, rows: list[tuple]) -> None:
        if not rows:
            return
        try:
            async with conn.transaction():
                await conn.executemany(sql, rows)
        except _ROW_ERRORS:
            for row in rows:
                try:
                    async with conn.transaction():
                        await conn.execute(sql, *row)
                except _ROW_ERRORS as exc:
                    logger.warning("sink.row_skipped", key=row[0], error=type(exc).__name__)

    async def close(self) -> None:
        await self.flush()
        if self._pool is not None:
            await self._pool.close()
