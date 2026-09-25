"""GET /games/next — next date with games, PG first then ESPN's calendar."""

import json
from datetime import date
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.services import espn_client, game_service

CAL = json.loads((Path(__file__).parent / "fixtures/espn_scoreboard_default.json").read_text())


@pytest.mark.asyncio
async def test_calendar_parses_to_et_dates():
    with patch.object(espn_client, "get_scoreboard", AsyncMock(return_value=CAL)):
        days = await espn_client.get_scoreboard_calendar()
    assert days[0] == date(2026, 10, 3) and days == sorted(set(days))


@pytest.mark.asyncio
async def test_next_from_local_games_table(seeded_session):
    # seeded_session contains game 401810001; its date (ET) is the expected answer
    with patch.object(espn_client, "get_scoreboard_calendar", AsyncMock(return_value=[])):
        d = await game_service.next_game_date(seeded_session, date(2000, 1, 1))
    assert d is not None


@pytest.mark.asyncio
async def test_next_falls_back_to_espn_calendar(session):
    with patch.object(
        espn_client,
        "get_scoreboard_calendar",
        AsyncMock(return_value=[date(2026, 10, 3), date(2026, 10, 4)]),
    ):
        assert await game_service.next_game_date(session, date(2026, 9, 25)) == date(2026, 10, 3)
        assert await game_service.next_game_date(session, date(2026, 10, 3)) == date(2026, 10, 4)


@pytest.mark.asyncio
async def test_no_next_game_returns_none(session):
    with patch.object(espn_client, "get_scoreboard_calendar", AsyncMock(return_value=[])):
        assert await game_service.next_game_date(session, date(2026, 9, 25)) is None


@pytest.mark.asyncio
async def test_route(client):
    with patch("src.routers.games.next_game_date", AsyncMock(return_value=date(2026, 10, 3))):
        r = await client.get("/games/next", params={"after": "2026-09-25"})
    assert r.status_code == 200 and r.json() == {"date": "2026-10-03"}
    with patch("src.routers.games.next_game_date", AsyncMock(return_value=None)):
        r = await client.get("/games/next", params={"after": "2026-09-25"})
    assert r.json() == {"date": None}
    assert (await client.get("/games/next", params={"after": "nope"})).status_code == 422
