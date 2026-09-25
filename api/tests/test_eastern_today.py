"""Every API "today" is the America/New_York date, including during EDT (UTC-4).

The frozen instant is 2026-10-04 04:30 UTC = Sun Oct 4 00:30 EDT. A hard-coded
UTC-5 offset gives Sat Oct 3 23:30 — the wrong day.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

import pytest
from starlette.testclient import TestClient

from src import eastern
from src.db.models import Game, Team
from src.main import app
from src.routers import picks
from src.services import game_service, pick_tracker_poller, scoreboard_poller

from .test_main import _app_test_mocks

ET = ZoneInfo("America/New_York")
INSTANT = datetime(2026, 10, 4, 4, 30, tzinfo=timezone.utc)
ET_TODAY = date(2026, 10, 4)


class _Frozen(datetime):
    @classmethod
    def now(cls, tz=None):
        return INSTANT.astimezone(tz) if tz is not None else INSTANT.replace(tzinfo=None)


@pytest.fixture
def frozen(monkeypatch):
    for module in (eastern, picks, game_service, pick_tracker_poller, scoreboard_poller):
        monkeypatch.setattr(module, "datetime", _Frozen, raising=False)


def test_shared_helper_is_new_york(frozen):
    assert eastern.ET == ET
    assert eastern.eastern_today() == ET_TODAY


def test_picks_today_is_the_eastern_date(frozen):
    assert picks._eastern_today() == ET_TODAY


def test_pick_tracker_today_is_the_eastern_date(frozen):
    assert pick_tracker_poller._eastern_today() == ET_TODAY


async def test_scoreboard_poller_asks_espn_for_the_eastern_date(frozen):
    with patch.object(
        scoreboard_poller.espn_client, "get_scoreboard", AsyncMock(return_value=None)
    ) as get_scoreboard:
        await scoreboard_poller._poll_scoreboard()
    get_scoreboard.assert_awaited_once_with("20261004")


async def test_game_service_defaults_to_the_eastern_date(frozen, session):
    cached = AsyncMock(return_value=[])
    with patch("src.services.game_service.get_cached_game_list", cached):
        await game_service.get_games(session)
    cached.assert_awaited_once_with("2026-10-04")


async def test_game_service_treats_the_eastern_date_as_today(frozen, session):
    """'today' (fresh ESPN first) is the ET date, not the server's local date."""
    order: list[str] = []
    espn = AsyncMock(side_effect=lambda d: order.append(f"espn:{d}"))
    query = AsyncMock(side_effect=lambda s, d: order.append(f"pg:{d}") or [])
    with (
        patch("src.services.game_service.get_cached_game_list", AsyncMock(return_value=None)),
        patch.object(game_service.espn_client, "get_scoreboard", espn),
        patch("src.services.game_service._query_pg", query),
    ):
        await game_service.get_games(session, ET_TODAY)
    # today: fresh ESPN first, PG only as the fallback (the reverse for other days)
    assert order == ["espn:20261004", "pg:2026-10-04"]


async def test_game_day_window_follows_edt(session):
    """A game at 00:30 EDT on Oct 4 belongs to Oct 4, not Oct 3."""
    session.add_all([Team(abbrev="BOS", name="Boston Celtics"), Team(abbrev="NY", name="Knicks")])
    await session.flush()
    session.add(
        Game(
            id="edt-late",
            home_team="BOS",
            away_team="NY",
            status="scheduled",
            start_time=datetime(2026, 10, 4, 0, 30, tzinfo=ET).astimezone(timezone.utc),
        )
    )
    await session.commit()
    assert [g["id"] for g in await game_service._query_pg(session, ET_TODAY)] == ["edt-late"]
    assert await game_service._query_pg(session, date(2026, 10, 3)) == []


def test_scoreboard_ws_sends_the_eastern_dates_cache(frozen):
    cached = AsyncMock(return_value=[{"id": "g1"}])
    with (
        _app_test_mocks(extra_patches={"src.main.get_cached_game_list": cached}),
        TestClient(app) as tc,
        tc.websocket_connect("/ws/scoreboard") as ws,
    ):
        assert json.loads(ws.receive_text())["data"] == [{"id": "g1"}]
    cached.assert_awaited_once_with("2026-10-04")
