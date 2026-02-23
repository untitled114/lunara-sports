"""Tests for stats_service — stat leaders and player stats."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.stats_service import (
    _resolve_athlete,
    _safe_float,
    get_player_game_log,
    get_player_season_stats,
    get_stat_leaders,
    get_team_stats_list,
)


class TestSafeFloat:
    def test_valid(self):
        assert _safe_float("3.5") == "3.5"

    def test_int_string(self):
        assert _safe_float("42") == "42"

    def test_invalid(self):
        assert _safe_float("abc") == "0.0"

    def test_dash_format(self):
        assert _safe_float("4.2-9.8") == "0.0"

    def test_none(self):
        assert _safe_float(None) == "0.0"

    def test_custom_default(self):
        assert _safe_float("bad", default="N/A") == "N/A"


@pytest.mark.asyncio
class TestGetPlayerSeasonStats:
    async def test_espn_fallback(self):
        espn_data = {
            "categories": [
                {
                    "displayName": "Regular Season Averages",
                    "labels": [
                        "GP",
                        "GS",
                        "MIN",
                        "FG",
                        "FG%",
                        "3PT",
                        "3P%",
                        "FT",
                        "FT%",
                        "OR",
                        "DR",
                        "REB",
                        "AST",
                        "BLK",
                        "STL",
                        "PF",
                        "TO",
                        "PTS",
                    ],
                    "statistics": [
                        {
                            "stats": [
                                "60",
                                "60",
                                "35.2",
                                "8.1-17.5",
                                "46.3",
                                "2.2-5.8",
                                "37.9",
                                "5.5-6.2",
                                "88.7",
                                "0.8",
                                "4.2",
                                "5.0",
                                "4.5",
                                "0.6",
                                "1.2",
                                "2.1",
                                "2.8",
                                "23.9",
                            ],
                        }
                    ],
                }
            ],
        }
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_stats = AsyncMock(return_value=espn_data)
            result = await get_player_season_stats("123")
            assert result is not None
            assert result.gp == 60
            assert result.ppg == "23.9"
            assert result.rpg == "5.0"
            assert result.apg == "4.5"

    async def test_returns_none_when_no_data(self):
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_stats = AsyncMock(return_value=None)
            result = await get_player_season_stats("999")
            assert result is None

    async def test_returns_none_on_espn_error(self):
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_stats = AsyncMock(side_effect=Exception("fail"))
            result = await get_player_season_stats("123")
            assert result is None

    async def test_skips_zero_gp(self):
        espn_data = {
            "categories": [
                {
                    "displayName": "Average",
                    "labels": ["GP", "PTS"],
                    "statistics": [{"stats": ["0", "0"]}],
                }
            ],
        }
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_stats = AsyncMock(return_value=espn_data)
            result = await get_player_season_stats("123")
            assert result is None


@pytest.mark.asyncio
class TestGetPlayerGameLog:
    async def test_espn_fallback(self):
        gamelog_data = {
            "labels": [
                "MIN",
                "FG",
                "FG%",
                "3PT",
                "3P%",
                "FT",
                "FT%",
                "REB",
                "AST",
                "BLK",
                "STL",
                "PF",
                "TO",
                "PTS",
            ],
            "events": {
                "e1": {
                    "gameDate": "2026-02-15T02:30:00",
                    "opponent": {"abbreviation": "LAL"},
                    "team": {"abbreviation": "BOS"},
                    "atVs": "vs",
                    "gameResult": "W",
                    "score": "110-105",
                }
            },
            "seasonTypes": [
                {
                    "categories": [
                        {
                            "events": [
                                {
                                    "eventId": "e1",
                                    "stats": [
                                        "35",
                                        "8-15",
                                        "53.3",
                                        "2-5",
                                        "40.0",
                                        "3-4",
                                        "75.0",
                                        "6",
                                        "8",
                                        "1",
                                        "2",
                                        "2",
                                        "3",
                                        "21",
                                    ],
                                }
                            ],
                        }
                    ],
                }
            ],
        }
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_gamelog = AsyncMock(return_value=gamelog_data)
            result = await get_player_game_log("123")
            assert len(result) == 1
            assert result[0]["pts"] == 21
            assert result[0]["reb"] == 6
            assert result[0]["date"] == "2026-02-15"

    async def test_empty_on_no_data(self):
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_gamelog = AsyncMock(return_value=None)
            result = await get_player_game_log("123")
            assert result == []


@pytest.mark.asyncio
class TestResolveAthlete:
    async def test_from_map(self):
        athlete_map = {"123": {"name": "LeBron James", "abbrev": "LAL"}}
        result = await _resolve_athlete("123", athlete_map)
        assert result["name"] == "LeBron James"

    async def test_fallback_to_espn(self):
        athlete_map = {}
        with patch("src.services.stats_service.espn_client") as mock:
            mock.get_athlete_info = AsyncMock(
                return_value={
                    "athlete": {"displayName": "Steph Curry", "team": {"abbreviation": "GS"}}
                }
            )
            result = await _resolve_athlete("456", athlete_map)
            assert result["name"] == "Steph Curry"

    async def test_unknown_athlete(self):
        athlete_map = {}
        with patch("src.services.stats_service.espn_client") as mock:
            mock.get_athlete_info = AsyncMock(return_value=None)
            result = await _resolve_athlete("789", athlete_map)
            assert "789" in result["name"]


@pytest.mark.asyncio
class TestGetStatLeaders:
    async def test_espn_fallback(self):
        espn_data = {
            "categories": [
                {
                    "name": "pointsPerGame",
                    "leaders": [
                        {
                            "athlete": {"$ref": "http://api/athletes/123?season=2026"},
                            "displayValue": "33.5",
                        }
                    ],
                }
            ],
        }
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_stat_leaders = AsyncMock(return_value=espn_data)
            mock_espn.get_team_roster = AsyncMock(return_value=None)
            mock_espn.get_athlete_info = AsyncMock(
                return_value={"athlete": {"displayName": "SGA", "team": {"abbreviation": "OKC"}}}
            )
            result = await get_stat_leaders(limit=5)
            assert "pts" in result.categories
            assert len(result.categories["pts"]) == 1

    async def test_empty_categories_on_failure(self):
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_stat_leaders = AsyncMock(return_value=None)
            result = await get_stat_leaders()
            assert result.categories == {}


@pytest.mark.asyncio
class TestGetTeamStatsList:
    async def test_empty_without_pool(self):
        with patch("src.services.stats_service.get_teams_pool", return_value=None):
            result = await get_team_stats_list()
            assert result == []

    async def test_empty_on_error(self):
        mock_pool = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(side_effect=Exception("DB error"))

        async def _acquire():
            return mock_conn

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_pool.acquire = MagicMock(return_value=mock_ctx)
        with patch("src.services.stats_service.get_teams_pool", return_value=mock_pool):
            result = await get_team_stats_list()
            assert result == []
