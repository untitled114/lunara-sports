"""Tests for game_service — game queries, ESPN parsing, caching."""

from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from src.db.models import Game, Team
from src.services.game_service import (
    _query_pg,
    get_game,
    get_games,
)


@pytest.fixture
async def game_session(session):
    """Session with teams and games for game_service tests."""
    session.add_all(
        [
            Team(abbrev="BOS", name="Boston Celtics"),
            Team(abbrev="LAL", name="Los Angeles Lakers"),
        ]
    )
    await session.flush()

    # 7:30pm ET on Feb 17 = Feb 18 00:30 timezone.utc
    session.add_all(
        [
            Game(
                id="g1",
                home_team="BOS",
                away_team="LAL",
                status="final",
                home_score=110,
                away_score=105,
                quarter=4,
                clock="0:00",
                start_time=datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc),
                venue="TD Garden",
            ),
            Game(
                id="g2",
                home_team="LAL",
                away_team="BOS",
                status="live",
                home_score=55,
                away_score=48,
                quarter=3,
                clock="5:00",
                start_time=datetime(2026, 2, 20, 3, 0, tzinfo=timezone.utc),
                venue="Crypto.com Arena",
            ),
        ]
    )
    await session.commit()
    return session


@pytest.mark.asyncio
class TestGetGames:
    async def test_returns_games_for_date(self, game_session):
        with (
            patch(
                "src.services.game_service.get_cached_game_list",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_list", new_callable=AsyncMock),
            patch("src.services.game_service.espn_client") as mock_espn,
        ):
            mock_espn.get_scoreboard = AsyncMock(return_value=None)
            games = await get_games(game_session, date(2026, 2, 17))
            assert len(games) == 1
            assert games[0]["id"] == "g1"

    async def test_returns_cached(self, game_session):
        cached = [{"id": "cached_game", "status": "live"}]
        with patch(
            "src.services.game_service.get_cached_game_list",
            new_callable=AsyncMock,
            return_value=cached,
        ):
            games = await get_games(game_session, date(2026, 2, 17))
            assert games == cached

    async def test_empty_date(self, game_session):
        with (
            patch(
                "src.services.game_service.get_cached_game_list",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_list", new_callable=AsyncMock),
            patch("src.services.game_service.espn_client") as mock_espn,
        ):
            mock_espn.get_scoreboard = AsyncMock(return_value=None)
            games = await get_games(game_session, date(2020, 1, 1))
            assert games == []


@pytest.mark.asyncio
class TestGetGame:
    async def test_returns_game(self, game_session):
        with (
            patch(
                "src.services.game_service.get_cached_game_state",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_state", new_callable=AsyncMock),
        ):
            game = await get_game(game_session, "g2")
            assert game is not None
            assert game["id"] == "g2"
            assert game["status"] == "live"

    async def test_returns_none_for_missing(self, game_session):
        with patch(
            "src.services.game_service.get_cached_game_state",
            new_callable=AsyncMock,
            return_value=None,
        ):
            game = await get_game(game_session, "nonexistent")
            assert game is None

    async def test_returns_cached_state(self, game_session):
        cached = {"id": "g1", "status": "final", "home_score": 999}
        with patch(
            "src.services.game_service.get_cached_game_state",
            new_callable=AsyncMock,
            return_value=cached,
        ):
            game = await get_game(game_session, "g1")
            assert game["home_score"] == 999

    async def test_caches_live_game(self, game_session):
        mock_cache = AsyncMock()
        with (
            patch(
                "src.services.game_service.get_cached_game_state",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_state", mock_cache),
        ):
            game = await get_game(game_session, "g2")
            assert game["status"] == "live"
            mock_cache.assert_called_once()


@pytest.mark.asyncio
class TestQueryPg:
    async def test_finds_game_in_window(self, game_session):
        # Feb 17 ET window: Feb 17 05:00 timezone.utc to Feb 18 04:59 timezone.utc
        # Game g1 start: Feb 18 00:30 timezone.utc — should be in window
        rows = await _query_pg(game_session, date(2026, 2, 17))
        assert len(rows) == 1
        assert rows[0]["id"] == "g1"

    async def test_no_games_outside_window(self, game_session):
        rows = await _query_pg(game_session, date(2020, 1, 1))
        assert rows == []

    async def test_different_date(self, game_session):
        # Game g2: Feb 20 03:00 timezone.utc = Feb 19 10pm ET → Feb 19 ET
        rows = await _query_pg(game_session, date(2026, 2, 19))
        assert len(rows) == 1
        assert rows[0]["id"] == "g2"
