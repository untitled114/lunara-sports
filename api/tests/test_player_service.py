"""Tests for player_service — athlete parsing and player lookup."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from src.services.player_service import (
    _parse_athlete,
    _parse_athlete_full,
    _parse_v3_athlete,
    get_all_players,
    get_player_by_id,
)


class TestParseAthlete:
    def test_full_athlete(self):
        data = {
            "id": "123",
            "displayName": "LeBron James",
            "jersey": "23",
            "position": {"abbreviation": "SF"},
            "displayHeight": "6' 9\"",
            "displayWeight": "250 lbs",
            "headshot": {"href": "http://img.png"},
        }
        result = _parse_athlete(data)
        assert result["id"] == "123"
        assert result["name"] == "LeBron James"
        assert result["jersey"] == "23"
        assert result["position"] == "SF"
        assert result["height"] == "6' 9\""
        assert result["weight"] == "250"
        assert result["headshot_url"] == "http://img.png"

    def test_missing_fields(self):
        result = _parse_athlete({})
        assert result["id"] == ""
        assert result["name"] == ""
        assert result["headshot_url"] == ""

    def test_fallback_to_fullname(self):
        data = {"fullName": "Fallback Name"}
        result = _parse_athlete(data)
        assert result["name"] == "Fallback Name"

    def test_no_headshot_object(self):
        data = {"id": "1", "headshot": None}
        result = _parse_athlete(data)
        assert result["headshot_url"] == ""


class TestParseAthleteFull:
    def test_includes_extra_fields(self):
        data = {
            "id": "456",
            "displayName": "Jayson Tatum",
            "age": 27,
            "experience": {"years": 7},
            "college": {"name": "Duke"},
        }
        result = _parse_athlete_full(data)
        assert result["name"] == "Jayson Tatum"
        assert result["age"] == 27
        assert result["experience"] == "7"
        assert result["college"] == "Duke"

    def test_experience_as_string(self):
        data = {"id": "1", "experience": "5"}
        result = _parse_athlete_full(data)
        assert result["experience"] == "5"

    def test_college_as_string(self):
        data = {"id": "1", "college": "MIT"}
        result = _parse_athlete_full(data)
        assert result["college"] == "MIT"

    def test_missing_experience_and_college(self):
        result = _parse_athlete_full({"id": "1"})
        assert result["experience"] == ""
        assert result["college"] == ""


class TestParseV3Athlete:
    def test_full_v3(self):
        data = {
            "id": "789",
            "displayName": "Kevin Durant",
            "jersey": "35",
            "displayJersey": "35",
            "position": {"abbreviation": "PF"},
            "displayHeight": "6' 10\"",
            "displayWeight": "240 lbs",
            "headshot": {"href": "http://kd.png"},
            "age": 36,
            "displayExperience": "16 Years",
            "displayDraft": "2007 R1 P2",
            "displayBirthPlace": "Washington, DC",
            "team": {
                "displayName": "Phoenix Suns",
                "abbreviation": "PHX",
            },
        }
        result = _parse_v3_athlete(data)
        assert result["id"] == "789"
        assert result["name"] == "Kevin Durant"
        assert result["position"] == "PF"
        assert result["weight"] == "240"
        assert result["age"] == 36
        assert result["experience"] == "16 Years"
        assert result["draft"] == "2007 R1 P2"
        assert result["team"] == "Phoenix Suns"
        assert result["team_abbrev"] == "PHX"

    def test_missing_nested(self):
        result = _parse_v3_athlete({})
        assert result["name"] == ""
        assert result["team"] == ""


@pytest.mark.asyncio
class TestGetAllPlayers:
    async def test_returns_players(self):
        roster_data = {
            "team": {
                "displayName": "Boston Celtics",
                "athletes": [
                    {"id": "1", "displayName": "Jayson Tatum"},
                    {"id": "2", "displayName": "Jaylen Brown"},
                ],
            }
        }
        with patch("src.services.player_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=roster_data)
            result = await get_all_players()
            assert len(result) > 0
            # At least some teams should have players
            teams_with_players = [t for t in result if t["players"]]
            assert len(teams_with_players) > 0

    async def test_search_filter(self):
        roster_data = {
            "team": {
                "displayName": "Boston Celtics",
                "athletes": [
                    {"id": "1", "displayName": "Jayson Tatum"},
                    {"id": "2", "displayName": "Jaylen Brown"},
                ],
            }
        }
        with patch("src.services.player_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=roster_data)
            result = await get_all_players(search="Tatum")
            found = [t for t in result if any(p["name"] == "Jayson Tatum" for p in t["players"])]
            assert len(found) > 0

    async def test_handles_none_roster(self):
        with patch("src.services.player_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=None)
            result = await get_all_players()
            assert result == []


@pytest.mark.asyncio
class TestGetPlayerById:
    async def test_from_v3_endpoint(self):
        v3_data = {
            "athlete": {
                "id": "123",
                "displayName": "Steph Curry",
                "team": {"displayName": "Warriors", "abbreviation": "GS"},
            }
        }
        with patch("src.services.player_service.espn_client") as mock:
            mock.get_athlete_info = AsyncMock(return_value=v3_data)
            result = await get_player_by_id("123")
            assert result is not None
            assert result["name"] == "Steph Curry"

    async def test_returns_none_when_not_found(self):
        with patch("src.services.player_service.espn_client") as mock:
            mock.get_athlete_info = AsyncMock(return_value=None)
            mock.get_team_roster = AsyncMock(return_value=None)
            result = await get_player_by_id("99999")
            assert result is None

    async def test_falls_back_to_roster_scan(self):
        roster_data = {
            "team": {
                "displayName": "Lakers",
                "athletes": [{"id": "42", "displayName": "Player X"}],
            }
        }
        with patch("src.services.player_service.espn_client") as mock:
            mock.get_athlete_info = AsyncMock(return_value=None)
            mock.get_team_roster = AsyncMock(return_value=roster_data)
            result = await get_player_by_id("42")
            assert result is not None
            assert result["name"] == "Player X"
