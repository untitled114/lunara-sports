"""PostgresSink — write games and plays straight to the Lunara database."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import asyncpg
import structlog

logger = structlog.get_logger(__name__)

TOPIC_SCOREBOARD = "raw.scoreboard"
TOPIC_PLAYS = "raw.plays"

# Above this many buffered events, something downstream is stuck (Postgres down,
# collectors outrunning flush). We never drop — just shout loudly.
PENDING_BACKLOG_THRESHOLD = 20000

# Transient: the connection/pool/server itself is unusable right now, or Postgres
# is asking us to back off and retry (admin shutdown, starting up, too many
# connections, serialization/deadlock conflict, statement/command timeout).
# Keep the buffer and retry on the next flush — no play is lost.
_TRANSIENT_ERRORS = (
    asyncpg.PostgresConnectionError,
    asyncpg.InterfaceError,
    asyncpg.OperatorInterventionError,  # CannotConnectNowError, AdminShutdownError, QueryCanceledError
    asyncpg.InsufficientResourcesError,  # e.g. TooManyConnectionsError
    asyncpg.TransactionRollbackError,  # e.g. SerializationError, DeadlockDetectedError
    asyncpg.QueryCanceledError,  # also an OperatorInterventionError; listed for clarity
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

    The sink is shared across concurrently-running collectors (scoreboard +
    every play-by-play poller), each of which may call ``produce()`` and
    ``flush()`` at any time. To keep that safe:

    - ``flush()`` *detaches* the current buffers into a local snapshot before
      awaiting anything, replacing them with fresh empty ones. Anything
      ``produce()``d while the write is in flight lands in the new buffers,
      never in the snapshot being written — so a successful flush never
      clobbers events it didn't write.
    - The whole detach-write-(requeue) sequence runs under an ``asyncio.Lock``,
      so at most one flush is ever talking to Postgres at a time. This keeps
      writes — and therefore game-state upserts — committed in the order they
      were requested, not in whatever order their connections happen to finish.
    - If the write fails transiently, the snapshot is requeued: newer game
      state (produced during the failed attempt) wins over the stale
      snapshot, and snapshot plays are put back ahead of anything newer so
      commit order is preserved on the next attempt. No event is ever lost to
      a transient failure, no matter how flushes overlap.

    A per-row integrity failure (unknown team/game FK, out-of-range value) is
    not transient — it's bad data — so it falls back to row-by-row and only
    the offending row is permanently dropped (and logged once per key, not
    once per flush attempt).
    """

    def __init__(self, dsn: str, pool: asyncpg.Pool | None = None) -> None:
        self._dsn = dsn
        self._pool = pool
        self._games: dict[str, tuple] = {}
        self._plays: list[tuple] = []
        self._lock = asyncio.Lock()
        self._logged_skips: set[tuple[str, str]] = set()

    async def connect(self) -> None:
        self._pool = await asyncpg.create_pool(
            self._dsn, min_size=1, max_size=4, command_timeout=10
        )

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
        if self.pending > PENDING_BACKLOG_THRESHOLD:
            logger.error("sink.pending_backlog", pending=self.pending)

    async def flush(self) -> None:
        if not self.pending:
            return
        if self._pool is None:
            raise RuntimeError("PostgresSink not connected")
        async with self._lock:
            # Detach: anything produce()'d while we're awaiting the write below
            # lands in a fresh buffer, never in the snapshot we're about to send.
            games, self._games = self._games, {}
            plays, self._plays = self._plays, []
            game_rows, play_rows = list(games.values()), list(plays)
            try:
                async with self._pool.acquire(timeout=5) as conn, conn.transaction():
                    await self._write(conn, UPSERT_GAME_SQL, game_rows)
                    await self._write(conn, INSERT_PLAY_SQL, play_rows)
            except _TRANSIENT_ERRORS as exc:
                self._requeue(games, plays)
                logger.warning(
                    "sink.flush_deferred", error=str(exc), games=len(games), plays=len(plays)
                )
                return
            except Exception as exc:
                self._requeue(games, plays)
                logger.error(
                    "sink.flush_failed",
                    error=type(exc).__name__,
                    games=len(games),
                    plays=len(plays),
                )
                raise

    def _requeue(self, games: dict[str, tuple], plays: list[tuple]) -> None:
        """Put a failed snapshot back, merged with anything produced meanwhile."""
        for key, row in games.items():
            self._games.setdefault(key, row)  # newer state (produced mid-flush) wins
        self._plays[:0] = plays  # snapshot first — preserves commit order

    async def _write(self, conn, sql: str, rows: list[tuple]) -> None:
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
                    skip_key = (sql, row[0])
                    if skip_key not in self._logged_skips:
                        self._logged_skips.add(skip_key)
                        logger.warning("sink.row_skipped", key=row[0], error=type(exc).__name__)

    async def close(self) -> None:
        try:
            await self.flush()
        except Exception as exc:
            logger.error(
                "sink.close_unflushed",
                error=type(exc).__name__,
                games=len(self._games),
                plays=len(self._plays),
            )
            raise
        finally:
            if self._pool is not None:
                await self._pool.close()
