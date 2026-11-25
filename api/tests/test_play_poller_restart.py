"""After a restart the play poller must not replay a game's stored plays to the clients reconnecting.

Real case, 2026-11-10 11:30:39 EST: the API restarted for a release, clients reconnected to
/ws/401909953 (CLE @ CHA, final the night before), and all 451 stored plays went out again as live
"play" messages. A socket joins the game room before its history query sets the watermark, so a
poll cycle in between saw the game with no watermark, started at 0 and walked the whole game, 50
plays a cycle; the history's setdefault could not pull the watermark back.

Fixtures: tests/fixtures/lunara_plays_401909953.json (every stored play for the game, 451
plays, sequence 4 to 667, from the production database, captured 2026-11-10 12:20 EST) and
tests/fixtures/lunara_rows_401909953.json (the game and its two teams, captured 11:20 EST). The
plays file is psql's json_agg output, unedited.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.db.models import Game, Play, Team
from src.ws import play_poller
from src.ws.play_poller import get_recent_plays, poll_once

FIXTURES = Path(__file__).parent / "fixtures"
GAME_ID = "401909953"


def _load(name):
    return json.loads((FIXTURES / name).read_text())


def _row(model, raw: dict):
    """A model instance from a captured row: only the model's columns, in their Python types."""
    kwargs = {}
    for col in model.__table__.columns:
        if col.name not in raw:
            continue
        value = raw[col.name]
        if value is not None and col.type.python_type is datetime:
            # Postgres drops trailing zeros (.08859); %f takes 1 to 6 digits.
            fmt = "%Y-%m-%dT%H:%M:%S.%f%z" if "." in value else "%Y-%m-%dT%H:%M:%S%z"
            value = datetime.strptime(value, fmt)
        elif value is not None and col.type.python_type is date:
            value = date.fromisoformat(value)
        kwargs[col.key] = value
    return model(**kwargs)


PLAYS = _load("lunara_plays_401909953.json")


async def _store(session_factory, plays):
    async with session_factory() as session:
        session.add_all([_row(Play, p) for p in plays])
        await session.commit()


@pytest.fixture
async def captured_game(session_factory):
    rows = _load("lunara_rows_401909953.json")
    async with session_factory() as session:
        session.add_all([_row(Team, t) for t in rows["teams"]])
        session.add_all([_row(Game, g) for g in rows["games"]])
        await session.commit()
    play_poller._watermarks.pop(GAME_ID, None)
    with patch("src.ws.play_poller.get_session_factory", return_value=session_factory):
        yield session_factory
    play_poller._watermarks.pop(GAME_ID, None)


@pytest.fixture
def room():
    """The game's room has a socket in it; broadcasts are recorded."""
    with patch("src.ws.play_poller.manager") as mock_manager:
        mock_manager.active_games.return_value = [GAME_ID]
        mock_manager.broadcast = AsyncMock()
        yield mock_manager


def _broadcast_seqs(mock_manager):
    return [c.args[1]["data"]["sequence_number"] for c in mock_manager.broadcast.await_args_list]


async def test_reconnect_after_restart_replays_nothing(captured_game, room):
    await _store(captured_game, PLAYS)

    # The socket is in the room; its history query has not set the watermark yet.
    for _ in range(10):  # 451 plays at 50 a cycle took 10 cycles to replay
        await poll_once(captured_game)
    assert _broadcast_seqs(room) == []

    history = await get_recent_plays(GAME_ID, limit=500)
    assert len(history) == 451
    await poll_once(captured_game)
    assert _broadcast_seqs(room) == []
    assert play_poller._watermarks[GAME_ID] == max(
        p["id"] for p in _load("lunara_plays_401909953.json")
    )


async def test_plays_after_the_history_go_out_once_in_order(captured_game, room):
    await _store(captured_game, PLAYS[:400])
    history = await get_recent_plays(GAME_ID, limit=500)
    assert history[-1]["sequence_number"] == PLAYS[399]["sequence_number"]

    await _store(captured_game, PLAYS[400:])  # the rest of the game arrives live
    for _ in range(3):
        await poll_once(captured_game)
    assert _broadcast_seqs(room) == [p["sequence_number"] for p in PLAYS[400:]]


async def test_a_game_joined_before_its_first_play_still_streams(captured_game, room):
    assert await get_recent_plays(GAME_ID, limit=500) == []

    await _store(captured_game, PLAYS[:30])  # tip-off: the first plays arrive
    await poll_once(captured_game)
    assert _broadcast_seqs(room) == [p["sequence_number"] for p in PLAYS[:30]]
