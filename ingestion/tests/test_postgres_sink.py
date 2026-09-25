"""PostgresSink — ingestion writes games/plays straight to Postgres (Task 8)."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import asyncpg
import pytest

from src.sinks.base import EventSink
from src.sinks.postgres import INSERT_PLAY_SQL, UPSERT_GAME_SQL, PostgresSink

pytestmark = pytest.mark.asyncio


class FakeConn:
    def __init__(
        self,
        fail_on: set[str] | None = None,
        fk_rows: set[str] | None = None,
        data_error_rows: set[str] | None = None,
        fail_exc: Exception | None = None,
    ):
        self.calls: list[tuple[str, list]] = []
        self.single: list[tuple[str, tuple]] = []
        self.fail_on = fail_on or set()
        self.fk_rows = fk_rows or set()
        self.data_error_rows = data_error_rows or set()
        self.fail_exc = (
            fail_exc if fail_exc is not None else asyncpg.PostgresConnectionError("db down")
        )
        self.tx_entries = 0

    async def executemany(self, sql, rows):
        if "games" in sql and "games" in self.fail_on:
            raise self.fail_exc
        if self.fk_rows and any(r[0] in self.fk_rows for r in rows):
            raise asyncpg.ForeignKeyViolationError("fk")
        if self.data_error_rows and any(r[0] in self.data_error_rows for r in rows):
            raise asyncpg.DataError("bad data")
        self.calls.append((sql, list(rows)))

    async def execute(self, sql, *args):
        if args and args[0] in self.fk_rows:
            raise asyncpg.ForeignKeyViolationError("fk")
        if args and args[0] in self.data_error_rows:
            raise asyncpg.DataError("bad data")
        self.single.append((sql, args))

    def transaction(self):
        conn = self

        class _Tx:
            async def __aenter__(self):
                conn.tx_entries += 1
                return conn

            async def __aexit__(self, *exc):
                return False

        return _Tx()


class FakePool:
    def __init__(self, conn: FakeConn):
        self.conn = conn
        self.closed = False

    def acquire(self):
        conn = self.conn

        class _Acq:
            async def __aenter__(self):
                return conn

            async def __aexit__(self, *exc):
                return False

        return _Acq()

    async def close(self):
        self.closed = True


GAME = {
    "game_id": "401",
    "home_team": "BOS",
    "away_team": "NYK",
    "home_team_name": "Boston Celtics",
    "away_team_name": "New York Knicks",
    "home_score": 10,
    "away_score": 8,
    "status": "live",
    "status_detail": "1st 5:00",
    "quarter": 1,
    "clock": "5:00",
    "start_time": "2026-10-20T23:30:00Z",
    "venue": "TD Garden",
    "polled_at": "2026-10-20T23:35:00Z",
}
PLAY = {
    "game_id": "401",
    "play_id": "p1",
    "sequence_number": 7,
    "quarter": 1,
    "clock": "5:00",
    "event_type": "jump_shot",
    "event_text": "Pullup Jump Shot",
    "description": "X makes jumper",
    "team": "BOS",
    "player_name": "X",
    "home_score": 10,
    "away_score": 8,
    "scoring_play": True,
    "score_value": 2,
    "wallclock": None,
    "polled_at": "2026-10-20T23:35:00Z",
}


async def test_flush_upserts_games_before_plays():
    conn = FakeConn()
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.plays", "401", PLAY)
    sink.produce("raw.scoreboard", "401", GAME)
    await sink.flush()
    assert [c[0] for c in conn.calls] == [UPSERT_GAME_SQL, INSERT_PLAY_SQL]
    game_row = conn.calls[0][1][0]
    assert game_row[0] == "401" and game_row[8] == datetime(
        2026, 10, 20, 23, 30, tzinfo=timezone.utc
    )
    play_row = conn.calls[1][1][0]
    assert play_row == ("401", 7, 1, "5:00", "jump_shot", "X makes jumper", "BOS", "X", 10, 8)
    assert sink.pending == 0


async def test_upsert_game_sql_updates_live_fields_and_timestamp():
    assert "ON CONFLICT (id) DO UPDATE" in UPSERT_GAME_SQL
    for col in ("status", "home_score", "away_score", "quarter", "clock", "venue", "updated_at"):
        assert col in UPSERT_GAME_SQL


async def test_insert_play_sql_ignores_duplicates():
    # Review Focus #5: restarts resend all plays; duplicates must be ignored
    assert "ON CONFLICT (game_id, sequence_number) DO NOTHING" in INSERT_PLAY_SQL


async def test_long_event_type_is_passed_through_untruncated():
    # Review Focus #1: 45-char event types must reach the DB (migration 012 widens the column)
    conn = FakeConn()
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.plays", "401", {**PLAY, "event_type": "x" * 45})
    await sink.flush()
    assert conn.calls[0][1][0][4] == "x" * 45


async def test_fk_violation_skips_only_the_bad_game():
    # Review Focus #2: unknown team abbrev fails one row, not the batch
    conn = FakeConn(fk_rows={"999"})
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.scoreboard", "401", GAME)
    sink.produce("raw.scoreboard", "999", {**GAME, "game_id": "999", "home_team": "ASW"})
    await sink.flush()
    written = [args[0] for _sql, args in conn.single]
    assert written == ["401"]
    assert sink.pending == 0


async def test_transient_db_error_keeps_buffer_for_next_flush():
    # Review Focus #3: nothing is lost on a transient failure
    conn = FakeConn(fail_on={"games"})
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.scoreboard", "401", GAME)
    sink.produce("raw.plays", "401", PLAY)
    await sink.flush()
    assert sink.pending == 2
    conn.fail_on.clear()
    await sink.flush()
    assert sink.pending == 0 and len(conn.calls) == 2


async def test_unknown_topic_rejected():
    sink = PostgresSink("postgresql://x", pool=FakePool(FakeConn()))
    with pytest.raises(ValueError, match="unknown topic"):
        sink.produce("user.reactions", "k", {})


async def test_flush_with_nothing_pending_does_not_touch_db():
    conn = FakeConn()
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    await sink.flush()
    assert conn.calls == [] and conn.single == []


async def test_start_time_epoch_millis_and_missing_are_handled():
    conn = FakeConn()
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.scoreboard", "401", {**GAME, "start_time": 1792539000000})
    await sink.flush()
    assert conn.calls[0][1][0][8] == datetime.fromtimestamp(1792539000, tz=timezone.utc)
    sink.produce("raw.scoreboard", "401", {**GAME, "start_time": None})
    await sink.flush()
    assert conn.calls[1][1][0][8].tzinfo is not None


async def test_connect_creates_pool_and_close_closes_it(monkeypatch):
    created = {}

    async def fake_create_pool(dsn, min_size, max_size):
        created["args"] = (dsn, min_size, max_size)
        return FakePool(FakeConn())

    monkeypatch.setattr(asyncpg, "create_pool", fake_create_pool)
    sink = PostgresSink("postgresql://u@h:5500/lunara")
    await sink.connect()
    assert created["args"] == ("postgresql://u@h:5500/lunara", 1, 4)
    await sink.close()
    assert sink._pool.closed


async def test_flush_before_connect_raises():
    sink = PostgresSink("postgresql://x")
    sink.produce("raw.plays", "401", PLAY)
    with pytest.raises(RuntimeError, match="not connected"):
        await sink.flush()


async def test_postgres_sink_satisfies_the_event_sink_protocol_shape():
    # EventSink (sinks/base.py) is the structural contract collectors code
    # against; PostgresSink must provide the same member shape.
    assert {"produce", "flush", "close"} <= set(dir(EventSink))
    sink = PostgresSink("postgresql://x", pool=FakePool(FakeConn()))
    assert all(hasattr(sink, m) for m in ("produce", "flush", "close"))


# --- Ruling-required behaviors (R2/R3): transient-error classes and the
# row-by-row fallback's per-row transaction semantics. ---------------------


async def test_interface_error_keeps_buffer_for_next_flush():
    # R2: InterfaceError (e.g. pool/connection torn down mid-flush) is transient
    conn = FakeConn(fail_on={"games"}, fail_exc=asyncpg.InterfaceError("connection is closed"))
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.scoreboard", "401", GAME)
    await sink.flush()
    assert sink.pending == 1
    conn.fail_on.clear()
    await sink.flush()
    assert sink.pending == 0 and len(conn.calls) == 1


async def test_timeout_error_keeps_buffer_for_next_flush():
    # R2: asyncio.TimeoutError (query/connection acquisition timeout) is transient
    conn = FakeConn(fail_on={"games"}, fail_exc=asyncio.TimeoutError())
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.scoreboard", "401", GAME)
    await sink.flush()
    assert sink.pending == 1
    conn.fail_on.clear()
    await sink.flush()
    assert sink.pending == 0 and len(conn.calls) == 1


async def test_data_error_skips_only_the_bad_row_siblings_still_written():
    # R3: DataError (e.g. value out of range) skips just that row; siblings land
    conn = FakeConn(data_error_rows={"999"})
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.scoreboard", "401", GAME)
    sink.produce("raw.scoreboard", "999", {**GAME, "game_id": "999"})
    await sink.flush()
    written = [args[0] for _sql, args in conn.single]
    assert written == ["401"]
    assert sink.pending == 0


async def test_start_time_unparseable_string_falls_back_to_now():
    conn = FakeConn()
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.scoreboard", "401", {**GAME, "start_time": "not-a-timestamp"})
    await sink.flush()
    assert conn.calls[0][1][0][8].tzinfo is not None


async def test_close_without_connect_is_a_noop():
    sink = PostgresSink("postgresql://x")
    await sink.close()  # nothing pending, no pool — must not raise


async def test_row_fallback_uses_a_transaction_per_row():
    # R1: the batch attempt and each per-row retry each get their own nested
    # transaction (savepoint) — 1 outer flush tx + 1 failed batch tx + 2 row txs
    conn = FakeConn(fk_rows={"999"})
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.scoreboard", "401", GAME)
    sink.produce("raw.scoreboard", "999", {**GAME, "game_id": "999", "home_team": "ASW"})
    await sink.flush()
    assert conn.tx_entries == 4
    written = [args[0] for _sql, args in conn.single]
    assert written == ["401"]
