"""PostgresSink - write games and plays straight to the Lunara database."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import asyncpg
import structlog

logger = structlog.get_logger(__name__)

TOPIC_SCOREBOARD = "raw.scoreboard"
TOPIC_PLAYS = "raw.plays"

# Above this many buffered events, something downstream is stuck (Postgres down,
# collectors outrunning flush). We never drop - just shout loudly.
PENDING_BACKLOG_THRESHOLD = 20000

# One flush writes at most this many snapshots (the first, plus what collectors
# produced while it was writing) before leaving the rest to the next flush.
MAX_DRAIN_ROUNDS = 5

# Transient: the connection/pool/server itself is unusable right now, or Postgres
# is asking us to back off and retry (admin shutdown, starting up, too many
# connections, serialization/deadlock conflict, statement/command timeout).
# Keep the buffer and retry on the next flush - no play is lost.
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

# One row per ESPN play id. ESPN renumbers plays mid-game and corrects them, so a play seen
# again with different fields updates its row; an unchanged one writes nothing.
UPSERT_PLAY_SQL = """
INSERT INTO plays (game_id, espn_play_id, sequence_number, quarter, clock, event_type,
                   description, team, player_name, home_score, away_score,
                   espn_order, scoring_play, score_value)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
ON CONFLICT (game_id, espn_play_id) DO UPDATE SET
    sequence_number = EXCLUDED.sequence_number, quarter = EXCLUDED.quarter,
    clock = EXCLUDED.clock, event_type = EXCLUDED.event_type,
    description = EXCLUDED.description, team = EXCLUDED.team,
    player_name = EXCLUDED.player_name, home_score = EXCLUDED.home_score,
    away_score = EXCLUDED.away_score, espn_order = EXCLUDED.espn_order,
    scoring_play = EXCLUDED.scoring_play, score_value = EXCLUDED.score_value
WHERE (plays.sequence_number, plays.quarter, plays.clock, plays.event_type, plays.description,
       plays.team, plays.player_name, plays.home_score, plays.away_score, plays.espn_order,
       plays.scoring_play, plays.score_value)
   IS DISTINCT FROM
      (EXCLUDED.sequence_number, EXCLUDED.quarter, EXCLUDED.clock, EXCLUDED.event_type,
       EXCLUDED.description, EXCLUDED.team, EXCLUDED.player_name, EXCLUDED.home_score,
       EXCLUDED.away_score, EXCLUDED.espn_order, EXCLUDED.scoring_play, EXCLUDED.score_value)
""".strip()


# Reconciling a finished game with ESPN's final play list (see PostgresSink.reconcile).
# $1 = game id; $2..$6 = ESPN's plays as parallel arrays (id, sequence, quarter, clock, text).
_ESPN_PLAYS_CTE = """
WITH espn AS (
    SELECT * FROM unnest($2::text[], $3::int[], $4::int[], $5::text[], $6::text[])
        AS e(espn_play_id, sequence_number, quarter, clock, description)
)"""

# Rows written before plays carried ESPN's id: adopt each one ESPN still has, matched on its
# number and text first, then on quarter, clock and text (a renumbered play). Each ESPN play
# adopts at most one row and each row at most one play; the rest are duplicates or stale.
ADOPT_BY_SEQUENCE_SQL = (
    _ESPN_PLAYS_CTE
    + """,
pairs AS (
    SELECT DISTINCT ON (e.espn_play_id) p.id AS row_id, e.espn_play_id
    FROM plays p
    JOIN espn e ON p.sequence_number = e.sequence_number
               AND p.description IS NOT DISTINCT FROM e.description
    WHERE p.game_id = $1 AND p.espn_play_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM plays q WHERE q.game_id = $1 AND q.espn_play_id = e.espn_play_id)
    ORDER BY e.espn_play_id, p.id
)
UPDATE plays p SET espn_play_id = pairs.espn_play_id
FROM (SELECT DISTINCT ON (row_id) row_id, espn_play_id FROM pairs ORDER BY row_id, espn_play_id) pairs
WHERE p.id = pairs.row_id
"""
)

ADOPT_BY_CLOCK_SQL = (
    _ESPN_PLAYS_CTE
    + """,
pairs AS (
    SELECT DISTINCT ON (e.espn_play_id) p.id AS row_id, e.espn_play_id
    FROM plays p
    JOIN espn e ON p.quarter = e.quarter
               AND p.clock IS NOT DISTINCT FROM e.clock
               AND p.description IS NOT DISTINCT FROM e.description
    WHERE p.game_id = $1 AND p.espn_play_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM plays q WHERE q.game_id = $1 AND q.espn_play_id = e.espn_play_id)
    ORDER BY e.espn_play_id, p.id
)
UPDATE plays p SET espn_play_id = pairs.espn_play_id
FROM (SELECT DISTINCT ON (row_id) row_id, espn_play_id FROM pairs ORDER BY row_id, espn_play_id) pairs
WHERE p.id = pairs.row_id
"""
)

# Rows ESPN no longer has (or never matched), unless a reaction or comment points at them.
DELETE_STALE_SQL = """
DELETE FROM plays p
WHERE p.game_id = $1
  AND (p.espn_play_id IS NULL OR NOT (p.espn_play_id = ANY($2::text[])))
  AND NOT EXISTS (SELECT 1 FROM reactions r WHERE r.play_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.play_id = p.id)
"""

COUNT_STALE_SQL = """
SELECT count(*) FROM plays p
WHERE p.game_id = $1 AND (p.espn_play_id IS NULL OR NOT (p.espn_play_id = ANY($2::text[])))
"""


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
        v["play_id"],
        v["sequence_number"],
        v["quarter"],
        v.get("clock"),
        v.get("event_type"),
        v.get("description"),
        v.get("team"),
        v.get("player_name"),
        v.get("home_score"),
        v.get("away_score"),
        v.get("espn_order"),
        v.get("scoring_play"),
        v.get("score_value"),
    )


def _rowcount(status: str) -> int:
    """Rows affected, from an asyncpg command status such as ``UPDATE 3`` or ``DELETE 0``."""
    return int(status.rsplit(" ", 1)[-1])


class PostgresSink:
    """Buffers events; flush() writes games then plays in one transaction.

    The sink is shared across concurrently-running collectors (scoreboard +
    every play-by-play poller), each of which may call ``produce()`` and
    ``flush()`` at any time. To keep that safe:

    - ``flush()`` *detaches* the current buffers into a local snapshot before
      awaiting anything, replacing them with fresh empty ones. Anything
      ``produce()``d while the write is in flight lands in the new buffers,
      never in the snapshot being written - so a successful flush never
      clobbers events it didn't write.
    - The whole detach-write-(requeue) sequence runs under an ``asyncio.Lock``,
      so at most one flush is ever talking to Postgres at a time. This keeps
      writes - and therefore game-state upserts - committed in the order they
      were requested, not in whatever order their connections happen to finish.
      A ``flush()`` that finds the lock held returns immediately: the flush in
      flight drains what was produced meanwhile (up to ``MAX_DRAIN_ROUNDS``
      snapshots). ``close()`` waits for the lock instead.
    - If the write fails transiently, the snapshot is requeued: newer game
      state (produced during the failed attempt) wins over the stale
      snapshot, and snapshot plays are put back ahead of anything newer so
      commit order is preserved on the next attempt. No event is ever lost to
      a transient failure, no matter how flushes overlap.

    A per-row integrity failure (unknown team/game FK, out-of-range value) is
    not transient - it's bad data - so it falls back to row-by-row and only
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
        self._backlog_logged = False

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
        pending = self.pending
        if pending > PENDING_BACKLOG_THRESHOLD:
            if not self._backlog_logged:
                self._backlog_logged = True
                logger.error("sink.pending_backlog", pending=pending)
        else:
            self._backlog_logged = False

    async def flush(self) -> None:
        """Write everything buffered - or return at once if a flush is in flight.

        The flush already holding the lock drains whatever was produced while it
        was writing, so a collector never queues behind another collector's write
        (a per-game poll timeout would otherwise cancel it there).
        """
        if self._lock.locked():
            return
        await self._drain()

    async def _drain(self) -> None:
        """Under the lock: write snapshots until the buffer is empty (bounded)."""
        async with self._lock:
            for _ in range(MAX_DRAIN_ROUNDS):
                if not self.pending:
                    return
                if self._pool is None:
                    raise RuntimeError("PostgresSink not connected")
                if not await self._write_snapshot():
                    return  # transient failure: buffer kept for the next flush

    async def _write_snapshot(self) -> bool:
        """Detach the buffers and write them; False if deferred by a transient error."""
        # Detach: anything produce()'d while we're awaiting the write below
        # lands in a fresh buffer, never in the snapshot we're about to send.
        games, self._games = self._games, {}
        plays, self._plays = self._plays, []
        game_rows, play_rows = list(games.values()), list(plays)
        try:
            async with self._pool.acquire(timeout=5) as conn, conn.transaction():
                await self._write(conn, UPSERT_GAME_SQL, game_rows)
                await self._write(conn, UPSERT_PLAY_SQL, play_rows)
        except _TRANSIENT_ERRORS as exc:
            self._requeue(games, plays)
            logger.warning(
                "sink.flush_deferred",
                error=str(exc),
                error_class=type(exc).__name__,  # str() is empty for e.g. TimeoutError
                games=len(games),
                plays=len(plays),
            )
            return False
        except Exception as exc:
            self._requeue(games, plays)
            logger.error(
                "sink.flush_failed",
                error=type(exc).__name__,
                games=len(games),
                plays=len(plays),
            )
            raise
        except BaseException as exc:
            # CancelledError (task cancellation at shutdown, asyncio.wait_for
            # timeout) is a BaseException, not an Exception - it must still
            # requeue the snapshot instead of silently dropping it.
            self._requeue(games, plays)
            logger.warning(
                "sink.flush_cancelled",
                error_class=type(exc).__name__,
                games=len(games),
                plays=len(plays),
            )
            raise
        return True

    async def reconcile(self, game_id: str, plays: list[dict]) -> dict[str, int]:
        """Make a finished game's stored plays match ESPN's final play list.

        In one transaction: adopt rows written before plays carried ESPN's id, upsert
        every ESPN play, then delete rows ESPN no longer has. A row a reaction or comment
        points at is never deleted; it is counted as ``kept_referenced``. Buffered events
        are flushed first. An empty list changes nothing.
        """
        if not plays:
            return {"adopted": 0, "written": 0, "deleted": 0, "kept_referenced": 0}
        await self._drain()
        rows = [_play_row(v) for v in plays]
        ids = [r[1] for r in rows]
        arrays = (ids, [r[2] for r in rows], [r[3] for r in rows], [r[4] for r in rows],
                  [r[6] for r in rows])  # fmt: skip
        async with self._lock:
            if self._pool is None:
                raise RuntimeError("PostgresSink not connected")
            async with self._pool.acquire(timeout=10) as conn, conn.transaction():
                adopted = _rowcount(await conn.execute(ADOPT_BY_SEQUENCE_SQL, game_id, *arrays))
                adopted += _rowcount(await conn.execute(ADOPT_BY_CLOCK_SQL, game_id, *arrays))
                await conn.executemany(UPSERT_PLAY_SQL, rows)
                deleted = _rowcount(await conn.execute(DELETE_STALE_SQL, game_id, ids))
                kept = await conn.fetchval(COUNT_STALE_SQL, game_id, ids)
        result = {"adopted": adopted, "written": len(rows), "deleted": deleted,
                  "kept_referenced": int(kept or 0)}  # fmt: skip
        logger.info("sink.reconciled", game_id=game_id, **result)
        return result

    def _requeue(self, games: dict[str, tuple], plays: list[tuple]) -> None:
        """Put a failed snapshot back, merged with anything produced meanwhile."""
        for key, row in games.items():
            self._games.setdefault(key, row)  # newer state (produced mid-flush) wins
        self._plays[:0] = plays  # snapshot first - preserves commit order

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
            await self._drain()  # waits for an in-flight flush, then writes the rest
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
