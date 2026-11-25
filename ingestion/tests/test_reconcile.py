"""Reconciling a finished game's stored plays with ESPN's final play list."""

from __future__ import annotations

from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest

from src import reconcile as rc
from src.sinks.postgres import (
    ADOPT_BY_CLOCK_SQL,
    ADOPT_BY_SEQUENCE_SQL,
    COUNT_STALE_SQL,
    DELETE_STALE_SQL,
    UPSERT_PLAY_SQL,
    PostgresSink,
    _rowcount,
)

pytestmark = pytest.mark.asyncio

PLAY = {
    "game_id": "401",
    "play_id": "p1",
    "sequence_number": 7,
    "quarter": 1,
    "clock": "5:00",
    "event_type": "jump_shot",
    "description": "X makes jumper",
    "team": "BOS",
    "player_name": "X",
    "home_score": 10,
    "away_score": 8,
}


class _Tx:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class ReconcileConn:
    """Records the reconcile transaction; answers each statement with a fixed status."""

    def __init__(self, statuses: dict[str, str], stale: int = 0):
        self.statuses = statuses
        self.stale = stale
        self.calls: list[tuple] = []
        self.transactions = 0

    def transaction(self):
        self.transactions += 1
        return _Tx()

    async def execute(self, sql, *args):
        self.calls.append(("execute", sql, args))
        return self.statuses[sql]

    async def executemany(self, sql, rows):
        self.calls.append(("executemany", sql, list(rows)))

    async def fetchval(self, sql, *args):
        self.calls.append(("fetchval", sql, args))
        return self.stale


class ReconcilePool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self, timeout=None):
        conn = self.conn

        class _Acq:
            async def __aenter__(self):
                return conn

            async def __aexit__(self, *exc):
                return False

        return _Acq()


def _statuses(by_seq=2, by_clock=1, deleted=3):
    return {
        ADOPT_BY_SEQUENCE_SQL: f"UPDATE {by_seq}",
        ADOPT_BY_CLOCK_SQL: f"UPDATE {by_clock}",
        DELETE_STALE_SQL: f"DELETE {deleted}",
    }


async def test_rowcount_reads_the_command_status():
    assert _rowcount("UPDATE 3") == 3
    assert _rowcount("DELETE 0") == 0


async def test_reconcile_runs_adopt_upsert_delete_in_one_transaction():
    conn = ReconcileConn(_statuses(), stale=1)
    sink = PostgresSink("postgresql://x", pool=ReconcilePool(conn))
    second = {**PLAY, "play_id": "p2", "sequence_number": 8, "description": "Y misses"}

    result = await sink.reconcile("401", [PLAY, second])

    assert result == {"adopted": 3, "written": 2, "deleted": 3, "kept_referenced": 1}
    assert conn.transactions == 1
    assert [c[1] for c in conn.calls] == [
        ADOPT_BY_SEQUENCE_SQL,
        ADOPT_BY_CLOCK_SQL,
        UPSERT_PLAY_SQL,
        DELETE_STALE_SQL,
        COUNT_STALE_SQL,
    ]
    # ESPN's plays go in as parallel arrays: id, sequence, quarter, clock, text
    assert conn.calls[0][2] == (
        "401",
        ["p1", "p2"],
        [7, 8],
        [1, 1],
        ["5:00", "5:00"],
        ["X makes jumper", "Y misses"],
    )
    assert [r[1] for r in conn.calls[2][2]] == ["p1", "p2"]
    assert conn.calls[3][2] == ("401", ["p1", "p2"])


async def test_reconcile_with_no_espn_plays_changes_nothing():
    conn = ReconcileConn(_statuses())
    sink = PostgresSink("postgresql://x", pool=ReconcilePool(conn))
    assert await sink.reconcile("401", []) == {
        "adopted": 0,
        "written": 0,
        "deleted": 0,
        "kept_referenced": 0,
    }
    assert conn.calls == []


async def test_reconcile_needs_a_connected_sink():
    sink = PostgresSink("postgresql://x")
    with pytest.raises(RuntimeError, match="not connected"):
        await sink.reconcile("401", [PLAY])


async def test_stale_rows_referenced_by_reactions_or_comments_are_never_deleted():
    assert "NOT EXISTS (SELECT 1 FROM reactions r WHERE r.play_id = p.id)" in DELETE_STALE_SQL
    assert "NOT EXISTS (SELECT 1 FROM comments c WHERE c.play_id = p.id)" in DELETE_STALE_SQL


# ---- src.reconcile -------------------------------------------------------------------


def _summary(completed: bool, plays: list[dict]) -> dict:
    return {
        "header": {"competitions": [{"status": {"type": {"completed": completed}}}]},
        "plays": plays,
    }


RAW = {"id": "p1", "sequenceNumber": "7", "type": {"text": "Jump Shot"}, "text": "X makes jumper"}


async def test_is_final_reads_espns_completed_flag():
    assert rc.is_final(_summary(True, []))
    assert not rc.is_final(_summary(False, []))
    assert not rc.is_final({})


async def test_reconcile_game_skips_a_game_espn_has_not_finished():
    sink = MagicMock()
    sink.reconcile = AsyncMock()
    with patch.object(
        rc.PlayByPlayCollector,
        "_fetch",
        new_callable=AsyncMock,
        return_value=_summary(False, [RAW]),
    ):
        assert await rc.reconcile_game(MagicMock(), sink, AsyncMock(), "401") is None
    sink.reconcile.assert_not_called()


async def test_reconcile_game_sends_every_espn_play_of_a_final_game():
    sink = MagicMock()
    sink.reconcile = AsyncMock(return_value={"deleted": 1})
    with patch.object(
        rc.PlayByPlayCollector, "_fetch", new_callable=AsyncMock, return_value=_summary(True, [RAW])
    ):
        assert await rc.reconcile_game(MagicMock(), sink, AsyncMock(), "401") == {"deleted": 1}
    game_id, plays = sink.reconcile.await_args.args
    assert game_id == "401"
    assert [(p["play_id"], p["sequence_number"]) for p in plays] == [("p1", 7)]


async def test_final_game_ids_starts_at_midnight_eastern():
    conn = MagicMock()
    conn.fetch = AsyncMock(return_value=[{"id": "a"}, {"id": "b"}])
    sink = MagicMock()
    sink._pool = ReconcilePool(conn)
    assert await rc.final_game_ids(sink, date(2026, 11, 9)) == ["a", "b"]
    sql, start = conn.fetch.await_args.args
    assert sql == rc.FINAL_GAMES_SQL
    assert start == datetime(2026, 11, 9, tzinfo=ZoneInfo("America/New_York"))


async def test_run_needs_a_game_or_a_date():
    with pytest.raises(SystemExit):
        await rc.run([])


async def _run_with(argv, reconcile_game, final_ids=None):
    sink = MagicMock()
    sink.close = AsyncMock()
    http = MagicMock()
    http.aclose = AsyncMock()
    with (
        patch("src.__main__.build_io", new_callable=AsyncMock, return_value=(sink, http)),
        patch.object(rc, "Settings", return_value=MagicMock()),
        patch.object(rc, "reconcile_game", reconcile_game),
        patch.object(rc, "final_game_ids", AsyncMock(return_value=final_ids or [])),
    ):
        done = await rc.run(argv)
    sink.close.assert_awaited_once()
    http.aclose.assert_awaited_once()
    return done


async def test_run_reconciles_each_named_game():
    rg = AsyncMock(side_effect=[{"deleted": 0}, None])
    done = await _run_with(["--game", "a", "--game", "b"], rg)
    assert done == [("a", {"deleted": 0}), ("b", None)]


async def test_run_since_a_date_reconciles_the_final_games_and_survives_one_failure(capsys):
    rg = AsyncMock(side_effect=[RuntimeError("espn down"), {"deleted": 2}])
    done = await _run_with(["--since", "2026-11-09"], rg, final_ids=["a", "b"])
    assert done == [("a", None), ("b", {"deleted": 2})]
    assert "reconcile.failed" in capsys.readouterr().out
