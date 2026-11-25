"""Reconcile against a real Postgres, on a real game whose stored plays drifted.

CLE @ CHA, 2026-11-09 (401909953). ESPN renumbered plays during the game while ingestion still
keyed plays on the sequence number, so the stored rows (api/tests/fixtures/lunara_plays_*.json,
every row the production database held for the game) disagree with ESPN's final play list
(tests/fixtures/espn/espn_summary_401909953_core.json): plays under the wrong number, stale
rows, missing plays. After reconcile the table must hold exactly ESPN's list, and points
summed from the stored scores must equal ESPN's own box score for every player.

Needs TEST_DATABASE_URL (a local throwaway database, see tests/integration/conftest.py at the
repository root); skipped without it.
"""

from __future__ import annotations

import importlib.util
import json
import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio

from src.collectors.playbyplay import PlayByPlayCollector
from src.sinks.postgres import PostgresSink

ROOT = Path(__file__).resolve().parents[2]
DSN = os.environ.get("TEST_DATABASE_URL", "")
GAME_ID = "401909953"
pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set"),
]


def _db_guard():
    spec = importlib.util.spec_from_file_location(
        "lunara_db_guard", ROOT / "tests/integration/db_guard.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load(rel: str):
    return json.loads((ROOT / rel).read_text())


@pytest_asyncio.fixture
async def conn():
    _db_guard().assert_safe_test_dsn(DSN)
    c = await asyncpg.connect(DSN)
    try:
        await c.execute("DROP SCHEMA IF EXISTS analytics CASCADE")
        await c.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        for migration in sorted((ROOT / "storage/postgres/migrations").glob("*.sql")):
            await c.execute(migration.read_text())
        yield c
    finally:
        await c.close()


async def _seed_the_stored_night(conn) -> None:
    rows = _load("api/tests/fixtures/lunara_rows_401909953.json")
    for g in rows["games"]:
        await conn.execute(
            "INSERT INTO games (id, home_team, away_team, status, home_score, away_score,"
            " quarter, clock, start_time, venue) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            g["id"], g["home_team"], g["away_team"], g["status"], g["home_score"],
            g["away_score"], g["quarter"], g["clock"],
            datetime.fromisoformat(g["start_time"]), g["venue"],
        )  # fmt: skip
    plays = _load("api/tests/fixtures/lunara_plays_401909953.json")
    await conn.executemany(
        "INSERT INTO plays (id, game_id, sequence_number, quarter, clock, event_type,"
        " description, team, player_name, home_score, away_score)"
        " VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
            (p["id"], p["game_id"], p["sequence_number"], p["quarter"], p["clock"],
             p["event_type"], p["description"], p["team"], p["player_name"],
             p["home_score"], p["away_score"])
            for p in plays
        ],
    )  # fmt: skip


def _espn_plays() -> list[dict]:
    summary = _load("tests/fixtures/espn/espn_summary_401909953_core.json")
    collector = PlayByPlayCollector(None, None, GAME_ID, None)
    return collector.changed_plays(summary)


async def test_reconcile_makes_the_stored_game_match_espn(conn):
    await _seed_the_stored_night(conn)
    # One stale duplicate (a 5:19 turnover stored twice) carries a reaction: it must survive.
    stale_id = 110248
    await conn.execute("INSERT INTO users (id, username) VALUES ($1, 'fan')", _uuid())
    await conn.execute(
        "INSERT INTO reactions (user_id, play_id, emoji) VALUES ($1, $2, 'fire')", _uuid(), stale_id
    )
    before = await conn.fetchval("SELECT count(*) FROM plays WHERE game_id = $1", GAME_ID)
    espn = _espn_plays()

    sink = PostgresSink(DSN)
    await sink.connect()
    try:
        result = await sink.reconcile(GAME_ID, espn)
    finally:
        await sink.close()

    rows = await conn.fetch(
        "SELECT id, espn_play_id, sequence_number, description, home_score, away_score"
        " FROM plays WHERE game_id = $1",
        GAME_ID,
    )
    by_espn = {r["espn_play_id"]: r for r in rows if r["espn_play_id"]}
    assert before == 451 and len(espn) == 453
    assert set(by_espn) == {p["play_id"] for p in espn}
    for p in espn:
        r = by_espn[p["play_id"]]
        assert (r["sequence_number"], r["description"], r["home_score"], r["away_score"]) == (
            p["sequence_number"], p["description"], p["home_score"], p["away_score"],
        )  # fmt: skip
    # the only row outside ESPN's list is the referenced stale one
    assert [r["id"] for r in rows if r["espn_play_id"] not in by_espn or not r["espn_play_id"]] == [
        stale_id
    ]
    assert result["kept_referenced"] == 1
    assert result["written"] == 453 and result["adopted"] > 0 and result["deleted"] > 0
    # adopted rows keep their primary key: the tip-off row is the same row as before
    assert await conn.fetchval("SELECT espn_play_id IS NOT NULL FROM plays WHERE id = 108940")

    # in ESPN's order the running score never goes back, and the stored points per play
    # add up to ESPN's own box score for every player
    ordered = await _ordered(conn)
    scores = [(r["home_score"], r["away_score"]) for r in ordered]
    assert all(b[0] >= a[0] and b[1] >= a[1] for a, b in zip(scores, scores[1:], strict=False))
    assert scores[-1] == (124, 112)
    assert _points_by_player(ordered) == _box_score_points()


async def test_reconcile_twice_changes_nothing_the_second_time(conn):
    await _seed_the_stored_night(conn)
    espn = _espn_plays()
    sink = PostgresSink(DSN)
    await sink.connect()
    try:
        await sink.reconcile(GAME_ID, espn)
        second = await sink.reconcile(GAME_ID, espn)
    finally:
        await sink.close()
    assert second == {"adopted": 0, "written": 453, "deleted": 0, "kept_referenced": 0}


def _uuid():
    import uuid

    return uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")


async def _ordered(conn):
    return await conn.fetch(
        "SELECT team, player_name, home_score, away_score, scoring_play, score_value FROM plays"
        " WHERE game_id = $1 AND espn_play_id IS NOT NULL ORDER BY espn_order",
        GAME_ID,
    )


def _points_by_player(rows) -> dict[tuple[str, str], int]:
    points: dict[tuple[str, str], int] = defaultdict(int)
    for r in rows:
        if r["scoring_play"]:
            points[(r["team"], r["player_name"])] += r["score_value"]
    return dict(points)


def _box_score_points() -> dict[tuple[str, str], int]:
    summary = _load("tests/fixtures/espn/espn_summary_401909953_core.json")
    points = {}
    for team in summary["boxscore"]["players"]:
        abbrev = team["team"]["abbreviation"]
        stats = team["statistics"][0]
        i = stats["labels"].index("PTS")
        for athlete in stats["athletes"]:
            if athlete.get("stats") and int(athlete["stats"][i]):
                points[(abbrev, athlete["athlete"]["displayName"])] = int(athlete["stats"][i])
    return points
