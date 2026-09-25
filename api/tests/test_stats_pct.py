"""Tests for stats_service — ESPN stat leaders fallback and the retired team stats list."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

from src.services.stats_service import (
    _leaders_season_label,
    get_stat_leaders,
    get_team_stats_list,
)


class TestGetStatLeadersESPNFallback:
    """Get stat leaders from the ESPN core API."""

    async def test_espn_fallback_no_pool(self):
        espn_data = {
            "categories": [
                {
                    "name": "pointsPerGame",
                    "leaders": [
                        {
                            "displayValue": "32.5",
                            "athlete": {"$ref": "http://espn.com/athletes/12345?season=2025"},
                        },
                    ],
                },
                {
                    "name": "fieldGoalPct",
                    "leaders": [
                        {
                            "displayValue": ".542",
                            "athlete": {"$ref": "http://espn.com/athletes/67890?season=2025"},
                        },
                    ],
                },
                {
                    "name": "unknownCategory",
                    "leaders": [],
                },
            ],
        }

        with (
            patch("src.services.stats_service.espn_client") as mock_espn,
            patch(
                "src.services.stats_service._build_athlete_lookup",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch(
                "src.services.stats_service._resolve_athlete",
                new_callable=AsyncMock,
                return_value={"name": "Player X", "abbrev": "OKC"},
            ),
        ):
            mock_espn.get_stat_leaders = AsyncMock(return_value=espn_data)
            result = await get_stat_leaders(limit=5)
            assert "pts" in result.categories
            assert len(result.categories["pts"]) == 1
            assert result.categories["pts"][0].value == "32.5"

    async def test_espn_fallback_error(self):
        with patch("src.services.stats_service.espn_client") as mock_espn:
            mock_espn.get_stat_leaders = AsyncMock(side_effect=Exception("ESPN down"))
            result = await get_stat_leaders(limit=5)
            assert result.categories == {}

    async def test_espn_returns_none(self):
        with patch("src.services.stats_service.espn_client") as mock_espn:
            mock_espn.get_stat_leaders = AsyncMock(return_value=None)
            result = await get_stat_leaders(limit=5)
            assert result.categories == {}

    async def test_espn_no_ref_url(self):
        espn_data = {
            "categories": [
                {
                    "name": "stealsPerGame",
                    "leaders": [
                        {
                            "displayValue": "2.1",
                            "athlete": {},  # no $ref
                        },
                    ],
                },
            ],
        }

        with (
            patch("src.services.stats_service.espn_client") as mock_espn,
            patch(
                "src.services.stats_service._build_athlete_lookup",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch(
                "src.services.stats_service._resolve_athlete",
                new_callable=AsyncMock,
                return_value={"name": "Player Y", "abbrev": "MIA"},
            ),
        ):
            mock_espn.get_stat_leaders = AsyncMock(return_value=espn_data)
            result = await get_stat_leaders(limit=5)
            assert "stl" in result.categories

    async def test_espn_category_with_no_leaders_is_skipped(self):
        """A mapped category with an empty "leaders" list contributes
        nothing (`if leaders:` False), while a sibling category with real
        leaders still comes through."""
        espn_data = {
            "categories": [
                {"name": "reboundsPerGame", "leaders": []},
                {
                    "name": "stealsPerGame",
                    "leaders": [{"displayValue": "2.1", "athlete": {}}],
                },
            ],
        }
        with (
            patch("src.services.stats_service.espn_client") as mock_espn,
            patch(
                "src.services.stats_service._build_athlete_lookup",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch(
                "src.services.stats_service._resolve_athlete",
                new_callable=AsyncMock,
                return_value={"name": "Player Y", "abbrev": "MIA"},
            ),
        ):
            mock_espn.get_stat_leaders = AsyncMock(return_value=espn_data)
            result = await get_stat_leaders(limit=5)
            assert "reb" not in result.categories
            assert "stl" in result.categories


class TestGetTeamStatsList:
    """Team stats leaderboard has no data source since the Sport-suite DB
    pools were retired (owner-approved) — always empty."""

    async def test_always_empty(self):
        result = await get_team_stats_list()
        assert result == []


class TestStatLeadersSeasonLabel:
    """The leaders say which season they are from, read from ESPN's own payload.

    Fixture: espn_leaders_2025_types2_limit1.json is ESPN's response body, unedited
    (plus the trailing newline the end-of-file hook adds, like the other fixtures here), to
    GET https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2025/
    types/2/leaders?limit=1 (captured 2026-09-25). ESPN's season 2025 is 2024-25
    (GET .../seasons/2025 -> displayName "2024-25").
    """

    REAL = json.loads(
        (Path(__file__).parent / "fixtures" / "espn_leaders_2025_types2_limit1.json").read_text()
    )

    async def test_label_from_the_real_payload(self):
        with (
            patch("src.services.stats_service.espn_client") as mock_espn,
            patch(
                "src.services.stats_service._build_athlete_lookup",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch(
                "src.services.stats_service._resolve_athlete",
                new_callable=AsyncMock,
                return_value={},
            ),
        ):
            mock_espn.get_stat_leaders = AsyncMock(return_value=self.REAL)
            result = await get_stat_leaders(limit=1)
        assert result.season_label == "2024–25 regular season"
        assert result.categories["pts"][0].player_id == "4278073"
        assert result.categories["pts"][0].value == "32.7"

    def test_label_rules(self):
        assert _leaders_season_label(self.REAL["$ref"]) == "2024–25 regular season"
        assert _leaders_season_label(".../seasons/2026/types/3/leaders") == "2025–26 postseason"
        assert _leaders_season_label(".../seasons/2010/types/9/leaders") == "2009–10"
        assert _leaders_season_label("") == ""
        assert _leaders_season_label(None) == ""

    async def test_no_leaders_no_label(self):
        with patch("src.services.stats_service.espn_client") as mock_espn:
            mock_espn.get_stat_leaders = AsyncMock(return_value=None)
            result = await get_stat_leaders(limit=5)
        assert result.season_label == ""
