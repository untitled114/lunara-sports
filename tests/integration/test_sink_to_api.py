"""End to end on a real Postgres: the ingestion sink writes games and plays; the
API play poller (the sole play-broadcast path) sends them over the WebSocket manager.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, time
from zoneinfo import ZoneInfo

import pytest
import pytest_asyncio
from api_src.ws import play_poller
from api_src.ws.live_feed import manager
from ingestion_src.sinks.postgres import TOPIC_PLAYS, TOPIC_SCOREBOARD, PostgresSink

from tests.integration.conftest import DSN, requires_db

pytestmark = [requires_db, pytest.mark.asyncio]

ET = ZoneInfo("America/New_York")
# Tip-off tonight, 7:30 PM Eastern — "today" is the America/New_York date.
TIPOFF = datetime.combine(datetime.now(ET).date(), time(19, 30), tzinfo=ET).isoformat()


def _game(game_id: str, home: str = "BOS", away: str = "NY") -> dict:
    return {
        "game_id": game_id,
        "home_team": home,
        "away_team": away,
        "status": "live",
        "home_score": 2,
        "away_score": 0,
        "quarter": 1,
        "clock": "11:40",
        "start_time": TIPOFF,
        "venue": "TD Garden",
    }


def _play(game_id: str, seq: int, event_type: str = "Jump Shot") -> dict:
    return {
        "game_id": game_id,
        "sequence_number": seq,
        "quarter": 1,
        "clock": "11:40",
        "event_type": event_type,
        "description": "Tatum makes 2-foot jumper",
        "team": "BOS",
        "player_name": "Jayson Tatum",
        "home_score": 2,
        "away_score": 0,
    }


@pytest.fixture
def ws(monkeypatch):
    """Subscribe to the given games and capture every broadcast the poller sends."""
    sent: list[tuple[str, dict]] = []
    subscribed: list[str] = []

    async def capture(game_id, message):
        sent.append((game_id, message))

    monkeypatch.setattr(play_poller, "_watermarks", {})
    monkeypatch.setattr(manager, "active_games", lambda: list(subscribed))
    monkeypatch.setattr(manager, "broadcast", capture)
    return subscribed, sent


@pytest_asyncio.fixture
async def sink(db):
    s = PostgresSink(DSN)
    await s.connect()
    yield s
    await s.close()


async def test_play_flows_to_websocket(db, sink, session_factory, ws):
    subscribed, sent = ws
    long_type = "x" * 45  # Review Focus #1: ESPN types longer than VARCHAR(30)
    sink.produce(TOPIC_SCOREBOARD, "401", _game("401"))
    sink.produce(TOPIC_PLAYS, "401", _play("401", 1, event_type=long_type))
    await sink.flush()

    assert await db.fetchval("SELECT count(*) FROM plays WHERE game_id='401'") == 1
    assert await db.fetchval("SELECT home_team FROM games WHERE id='401'") == "BOS"

    subscribed.append("401")
    await play_poller.poll_once(session_factory)
    assert len(sent) == 1
    game_id, msg = sent[0]
    assert game_id == "401"
    assert msg["type"] == "play"
    assert msg["data"]["sequence_number"] == 1
    assert msg["data"]["event_type"] == long_type
    assert msg["data"]["created_at"] is not None

    # the watermark holds: a second cycle with nothing new sends nothing
    await play_poller.poll_once(session_factory)
    assert len(sent) == 1


async def test_unknown_team_skips_only_that_game_and_its_play(
    db, sink, session_factory, ws
):
    """Review Focus #2: an All-Star style game (team not in `teams`) is dropped with
    its play; the good game and play in the same flush still land and broadcast."""
    subscribed, sent = ws
    sink.produce(TOPIC_SCOREBOARD, "401", _game("401"))
    sink.produce(TOPIC_SCOREBOARD, "402", _game("402", home="ASW", away="NY"))
    sink.produce(TOPIC_PLAYS, "402", _play("402", 1))
    sink.produce(TOPIC_PLAYS, "401", _play("401", 1))
    await sink.flush()

    assert sink.pending == 0  # a row-level failure is not requeued
    assert [r["id"] for r in await db.fetch("SELECT id FROM games ORDER BY id")] == [
        "401"
    ]
    rows = await db.fetch("SELECT game_id, sequence_number FROM plays")
    assert [(r["game_id"], r["sequence_number"]) for r in rows] == [("401", 1)]

    subscribed.extend(["401", "402"])
    await play_poller.poll_once(session_factory)
    assert [(gid, m["data"]["sequence_number"]) for gid, m in sent] == [("401", 1)]


async def test_replayed_play_is_one_row_and_one_broadcast(
    db, sink, session_factory, ws
):
    """Review Focus #5: an ingestion restart resends every play; duplicates are ignored
    in the table and never re-broadcast."""
    subscribed, sent = ws
    subscribed.append("401")
    sink.produce(TOPIC_SCOREBOARD, "401", _game("401"))
    sink.produce(TOPIC_PLAYS, "401", _play("401", 1))
    await sink.flush()
    await play_poller.poll_once(session_factory)

    # restart: collector comes back at sequence -1 and resends the same play
    sink.produce(TOPIC_SCOREBOARD, "401", _game("401"))
    sink.produce(TOPIC_PLAYS, "401", _play("401", 1))
    await sink.flush()
    await play_poller.poll_once(session_factory)

    assert await db.fetchval("SELECT count(*) FROM plays WHERE game_id='401'") == 1
    assert len(sent) == 1
    assert sent[0][1]["data"]["sequence_number"] == 1


async def test_concurrent_flushes_on_shared_sink_lose_and_duplicate_nothing(
    db, sink, session_factory, ws
):
    """Two collectors share one sink (pool of 4) and flush concurrently with
    overlapping play ranges: every play lands exactly once and broadcasts once."""
    subscribed, sent = ws
    assert sink._pool.get_max_size() == 4

    async def collector(seqs: range) -> None:
        sink.produce(TOPIC_SCOREBOARD, "401", _game("401"))
        for seq in seqs:
            sink.produce(TOPIC_PLAYS, "401", _play("401", seq))
        await sink.flush()

    await asyncio.wait_for(
        asyncio.gather(collector(range(1, 61)), collector(range(40, 101))), timeout=30
    )

    assert sink.pending == 0
    seqs = [
        r["sequence_number"]
        for r in await db.fetch(
            "SELECT sequence_number FROM plays WHERE game_id='401' ORDER BY sequence_number"
        )
    ]
    assert seqs == list(range(1, 101))

    subscribed.append("401")
    for _ in range(3):  # the poller sends at most 50 plays per game per cycle
        await play_poller.poll_once(session_factory)
    broadcast_seqs = [m["data"]["sequence_number"] for _, m in sent]
    assert broadcast_seqs == list(range(1, 101))
