"""Tests for stats_service — ESPN stat leaders fallback and the retired team stats list."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from src.services.stats_service import get_stat_leaders, get_team_stats_list


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
