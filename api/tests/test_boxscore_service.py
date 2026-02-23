"""Tests for boxscore_service — parsing ESPN box score data."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from src.services.boxscore_service import (
    _parse_player_stats,
    _parse_team_boxscore,
    _safe_int,
    get_boxscore,
)


class TestSafeInt:
    def test_valid_int(self):
        assert _safe_int("5") == 5

    def test_zero(self):
        assert _safe_int("0") == 0

    def test_invalid(self):
        assert _safe_int("abc") == 0

    def test_none(self):
        assert _safe_int(None) == 0

    def test_empty(self):
        assert _safe_int("") == 0


class TestParsePlayerStats:
    def _make_player(self, stats):
        labels = ["MIN", "FG", "3PT", "FT", "REB", "AST", "PF", "STL", "BLK", "TO", "+/-", "PTS"]
        return {
            "athlete": {
                "displayName": "Test Player",
                "position": {"abbreviation": "PG"},
                "id": "12345",
                "jersey": "7",
                "headshot": {"href": "http://img/12345.png"},
            },
            "starter": True,
            "stats": stats,
        }, labels

    def test_full_stats(self):
        player_data, labels = self._make_player(
            ["32", "8-15", "2-5", "3-4", "6", "8", "2", "1", "0", "3", "+10", "21"]
        )
        result = _parse_player_stats(player_data, labels)
        assert result.name == "Test Player"
        assert result.position == "PG"
        assert result.starter is True
        assert result.minutes == "32"
        assert result.fg == "8-15"
        assert result.three_pt == "2-5"
        assert result.ft == "3-4"
        assert result.rebounds == 6
        assert result.assists == 8
        assert result.fouls == 2
        assert result.steals == 1
        assert result.blocks == 0
        assert result.turnovers == 3
        assert result.plus_minus == "+10"
        assert result.points == 21
        assert result.headshot_url == "http://img/12345.png"

    def test_missing_headshot_uses_fallback(self):
        player_data = {
            "athlete": {"displayName": "No Headshot", "id": "99"},
            "stats": [],
        }
        result = _parse_player_stats(player_data, [])
        assert "99.png" in result.headshot_url

    def test_empty_stats(self):
        player_data = {
            "athlete": {"displayName": "Empty"},
            "stats": [],
        }
        result = _parse_player_stats(player_data, ["MIN", "PTS"])
        assert result.minutes == "0"
        assert result.points == 0


class TestParseTeamBoxscore:
    def test_basic_team(self):
        team_data = {
            "team": {"abbreviation": "BOS", "displayName": "Boston Celtics"},
            "statistics": [
                {
                    "name": "basketball",
                    "labels": ["MIN", "PTS"],
                    "athletes": [
                        {
                            "athlete": {"displayName": "Player A"},
                            "stats": ["30", "25"],
                        }
                    ],
                    "totals": ["240", "110"],
                }
            ],
        }
        result = _parse_team_boxscore(team_data)
        assert result.team == "Boston Celtics"
        assert result.abbrev == "BOS"
        assert len(result.players) == 1
        assert result.players[0].name == "Player A"
        assert result.totals == {"MIN": "240", "PTS": "110"}

    def test_abbreviation_normalization(self):
        team_data = {
            "team": {"abbreviation": "GSW", "displayName": "Golden State Warriors"},
            "statistics": [],
        }
        result = _parse_team_boxscore(team_data)
        assert result.abbrev == "GS"

    def test_nyk_normalization(self):
        team_data = {
            "team": {"abbreviation": "NYK", "displayName": "New York Knicks"},
            "statistics": [],
        }
        result = _parse_team_boxscore(team_data)
        assert result.abbrev == "NY"


@pytest.mark.asyncio
class TestGetBoxscore:
    async def test_returns_boxscore_on_success(self):
        mock_data = {
            "boxscore": {
                "players": [
                    {  # away
                        "team": {"abbreviation": "LAL", "displayName": "Los Angeles Lakers"},
                        "statistics": [
                            {
                                "labels": ["PTS"],
                                "athletes": [{"athlete": {"displayName": "A"}, "stats": ["20"]}],
                            }
                        ],
                    },
                    {  # home
                        "team": {"abbreviation": "BOS", "displayName": "Boston Celtics"},
                        "statistics": [
                            {
                                "labels": ["PTS"],
                                "athletes": [{"athlete": {"displayName": "B"}, "stats": ["25"]}],
                            }
                        ],
                    },
                ]
            }
        }
        with patch("src.services.boxscore_service.espn_client") as mock_espn:
            mock_espn.get_game_summary = AsyncMock(return_value=mock_data)
            result = await get_boxscore("401810001")
            assert result is not None
            assert result.game_id == "401810001"
            assert result.home.team == "Boston Celtics"
            assert result.away.team == "Los Angeles Lakers"

    async def test_returns_none_on_empty_data(self):
        with patch("src.services.boxscore_service.espn_client") as mock_espn:
            mock_espn.get_game_summary = AsyncMock(return_value=None)
            result = await get_boxscore("401810001")
            assert result is None

    async def test_returns_none_on_insufficient_teams(self):
        with patch("src.services.boxscore_service.espn_client") as mock_espn:
            mock_espn.get_game_summary = AsyncMock(return_value={"boxscore": {"players": [{}]}})
            result = await get_boxscore("401810001")
            assert result is None
