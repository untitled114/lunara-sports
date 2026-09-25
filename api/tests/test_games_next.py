"""GET /games/next — next date with games, PG first then ESPN's calendar."""

import json
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services import espn_client, game_service

CAL = json.loads((Path(__file__).parent / "fixtures/espn_scoreboard_default.json").read_text())


@pytest.mark.asyncio
async def test_calendar_parses_to_et_dates():
    with patch.object(espn_client, "_cached_get", AsyncMock(return_value=CAL)) as cached:
        days = await espn_client.get_scoreboard_calendar()
    assert days[0] == date(2026, 10, 3) and days == sorted(set(days))
    # Own cache key + long TTL — must NOT reuse get_scoreboard's 8s live-score cache,
    # or the calendar fallback would re-hit ESPN on essentially every /games/next call.
    cached.assert_awaited_once_with(
        "espn:scoreboard:calendar",
        f"{espn_client.BASE_URL}/scoreboard",
        espn_client.CALENDAR_TTL,
    )
    assert espn_client.CALENDAR_TTL == 21600


@pytest.mark.asyncio
async def test_next_from_local_games_table(seeded_session):
    # seeded_session's game 401810001 starts 2026-02-18 00:30 UTC == 2026-02-17 19:30 ET,
    # so the ET calendar date is 2026-02-17 — assert the exact date, not just "found something".
    with patch.object(espn_client, "get_scoreboard_calendar", AsyncMock(return_value=[])):
        d = await game_service.next_game_date(seeded_session, date(2000, 1, 1))
    assert d == date(2026, 2, 17)


@pytest.mark.asyncio
async def test_next_from_local_games_table_already_tz_aware():
    """Postgres (our real DB) preserves the UTC offset on read, unlike SQLite — the
    tzinfo-is-None guard must be a no-op (not a re-conversion) when it's already set."""
    mock_result = MagicMock()
    mock_result.scalar.return_value = datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc)
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with patch.object(espn_client, "get_scoreboard_calendar", AsyncMock(return_value=[])):
        d = await game_service.next_game_date(mock_session, date(2000, 1, 1))
    assert d == date(2026, 2, 17)


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
