"""Tests for team_service — team listing, detail, roster, schedule, stats."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.db.models import Game, Team
from src.services.team_service import (
    get_team_detail,
    get_team_roster,
    get_team_schedule,
    get_team_stats,
    get_teams,
)


@pytest.fixture
async def team_session(session):
    """Session with teams and games for team service tests."""
    session.add_all(
        [
            Team(abbrev="BOS", name="Boston Celtics", conference="Eastern", division="Atlantic"),
            Team(abbrev="LAL", name="Los Angeles Lakers", conference="Western", division="Pacific"),
        ]
    )
    await session.flush()

    session.add_all(
        [
            Game(
                id="g1",
                home_team="BOS",
                away_team="LAL",
                status="final",
                home_score=110,
                away_score=105,
                start_time=datetime(2026, 2, 17, 0, 30, tzinfo=timezone.utc),
            ),
            Game(
                id="g2",
                home_team="LAL",
                away_team="BOS",
                status="scheduled",
                home_score=0,
                away_score=0,
                start_time=datetime(2026, 2, 20, 3, 0, tzinfo=timezone.utc),
            ),
        ]
    )
    await session.commit()
    return session


@pytest.mark.asyncio
class TestGetTeams:
    async def test_lists_teams(self, team_session):
        teams = await get_teams(team_session)
        assert len(teams) == 2
        names = {t["name"] for t in teams}
        assert "Boston Celtics" in names

    async def test_team_has_last_game(self, team_session):
        teams = await get_teams(team_session)
        bos = next(t for t in teams if t["abbrev"] == "BOS")
        assert "W" in bos.get("last_game", "") or bos.get("last_game", "") != ""


@pytest.mark.asyncio
class TestGetTeamDetail:
    async def test_returns_detail(self, team_session):
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=None)
            result = await get_team_detail("BOS", team_session)
            assert result is not None
            assert result.name == "Boston Celtics"
            assert result.abbrev == "BOS"
            assert result.conference == "Eastern"

    async def test_enriches_from_espn(self, team_session):
        espn_data = {
            "team": {
                "record": {"items": [{"summary": "40-10"}]},
                "location": "Boston",
                "franchise": {"venue": {"fullName": "TD Garden"}},
                "color": "008348",
                "logos": [{"href": "http://logo.png"}],
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=espn_data)
            result = await get_team_detail("BOS", team_session)
            assert result.record == "40-10"
            assert result.city == "Boston"
            assert result.venue == "TD Garden"

    async def test_returns_none_for_unknown(self, team_session):
        result = await get_team_detail("XXX", team_session)
        assert result is None


@pytest.mark.asyncio
class TestGetTeamRoster:
    async def test_returns_roster(self):
        data = {
            "team": {
                "athletes": [
                    {
                        "id": "1",
                        "displayName": "Jayson Tatum",
                        "jersey": "0",
                        "position": {"abbreviation": "SF"},
                        "displayHeight": "6' 8\"",
                        "displayWeight": "210 lbs",
                        "age": 27,
                        "experience": {"years": 7},
                        "college": {"name": "Duke"},
                        "headshot": {"href": "http://tatum.png"},
                    }
                ]
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=data)
            result = await get_team_roster("BOS")
            assert len(result) == 1
            assert result[0].name == "Jayson Tatum"
            assert result[0].position == "SF"

    async def test_empty_for_unknown_team(self):
        result = await get_team_roster("ZZZZZ")
        assert result == []

    async def test_empty_when_espn_returns_none(self):
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=None)
            result = await get_team_roster("BOS")
            assert result == []


@pytest.mark.asyncio
class TestGetTeamSchedule:
    async def test_returns_schedule(self, team_session):
        result = await get_team_schedule("BOS", team_session)
        assert len(result) == 2
        # Should include result for final game
        final_game = next((g for g in result if g.status == "Final"), None)
        assert final_game is not None
        assert "W" in final_game.result or "L" in final_game.result

    async def test_empty_for_no_games(self, team_session):
        result = await get_team_schedule("XXX", team_session)
        assert result == []


@pytest.mark.asyncio
class TestGetTeamStats:
    async def test_returns_empty_without_pool(self):
        with patch("src.services.team_service.get_players_pool", return_value=None):
            result = await get_team_stats("BOS")
            assert result == []

    async def test_returns_empty_on_db_error(self):
        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(side_effect=Exception("DB error"))

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        mock_pool = AsyncMock()
        mock_pool.acquire = MagicMock(return_value=mock_ctx)
        with patch("src.services.team_service.get_players_pool", return_value=mock_pool):
            result = await get_team_stats("BOS")
            assert result == []
