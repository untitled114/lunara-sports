"""Tests for stats_service — percentage categories (FG%, 3P%, FT%) and ESPN fallback."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from src.services.stats_service import get_stat_leaders, get_team_stats_list


class TestGetStatLeadersESPNFallback:
    """Test ESPN fallback when Sport-Suite pool is unavailable."""

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
            patch("src.services.stats_service.get_players_pool", return_value=None),
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
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_stat_leaders = AsyncMock(side_effect=Exception("ESPN down"))
            result = await get_stat_leaders(limit=5)
            assert result.categories == {}

    async def test_espn_returns_none(self):
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
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
            patch("src.services.stats_service.get_players_pool", return_value=None),
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
        nothing (`if leaders:` False, line 475->449), while a sibling
        category with real leaders still comes through."""
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
            patch("src.services.stats_service.get_players_pool", return_value=None),
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


class TestGetStatLeadersDB:
    """Test Sport-Suite DB query path."""

    async def test_db_query_error(self):
        mock_pool = MagicMock()
        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(side_effect=Exception("DB error"))
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("src.services.stats_service.get_players_pool", return_value=mock_pool):
            result = await get_stat_leaders(limit=5)
            # Falls through to ESPN fallback, but that also fails → empty
            assert isinstance(result.categories, dict)

    async def test_db_pool_acquire_error(self):
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(
            side_effect=Exception("pool exhausted")
        )
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("src.services.stats_service.get_players_pool", return_value=mock_pool),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_stat_leaders = AsyncMock(return_value=None)
            result = await get_stat_leaders(limit=5)
            assert result.categories == {}


class TestGetStatLeadersDBSuccess:
    """Test successful DB queries for both avg and pct categories."""

    async def test_db_returns_avg_and_pct_leaders(self):
        avg_row = {
            "full_name": "Shai Gilgeous-Alexander",
            "player_id": 123,
            "headshot_url": "http://img.png",
            "team_abbrev": "OKC",
            "gp": 70,
            "avg_val": 32.7,
        }
        pct_row = {
            "full_name": "Rudy Gobert",
            "player_id": 456,
            "headshot_url": "http://img2.png",
            "team_abbrev": "MIN",
            "gp": 65,
            "avg_val": 66.2,
        }

        call_count = 0

        async def mock_fetch(query, *args):
            nonlocal call_count
            call_count += 1
            # First 6 calls are avg categories, next 3 are pct categories
            if call_count <= 6:
                return [avg_row]
            return [pct_row]

        mock_conn = AsyncMock()
        mock_conn.fetch = mock_fetch
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("src.services.stats_service.get_players_pool", return_value=mock_pool):
            result = await get_stat_leaders(limit=5)
            # Should have avg categories
            assert "pts" in result.categories
            assert result.categories["pts"][0].value == "32.7"
            # Should have pct categories
            assert "fg_pct" in result.categories
            assert result.categories["fg_pct"][0].value == "66.2%"

    async def test_db_pct_none_value(self):
        pct_row = {
            "full_name": "Player X",
            "player_id": 789,
            "headshot_url": "",
            "team_abbrev": "LAL",
            "gp": 10,
            "avg_val": None,
        }

        call_count = 0

        async def mock_fetch(query, *args):
            nonlocal call_count
            call_count += 1
            if call_count <= 6:
                return []  # no avg results
            return [pct_row]

        mock_conn = AsyncMock()
        mock_conn.fetch = mock_fetch
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("src.services.stats_service.get_players_pool", return_value=mock_pool):
            result = await get_stat_leaders(limit=5)
            assert "fg_pct" in result.categories
            assert result.categories["fg_pct"][0].value == "0.0%"

    async def test_db_pct_category_empty_then_nonempty(self):
        """One pct category (fg_pct) returns no rows — `if leaders:` is
        False and the loop continues to the next category (421->379) —
        while a later one (three_pct) still succeeds normally."""
        avg_row = {
            "full_name": "Player",
            "player_id": 1,
            "headshot_url": "",
            "team_abbrev": "BOS",
            "gp": 70,
            "avg_val": 25.0,
        }
        pct_row = {
            "full_name": "Rudy Gobert",
            "player_id": 456,
            "headshot_url": "",
            "team_abbrev": "MIN",
            "gp": 65,
            "avg_val": 66.2,
        }

        call_count = 0

        async def mock_fetch(query, *args):
            nonlocal call_count
            call_count += 1
            if call_count <= 6:
                return [avg_row]
            if call_count == 7:  # fg_pct
                return []
            return [pct_row]  # three_pct, ft_pct

        mock_conn = AsyncMock()
        mock_conn.fetch = mock_fetch
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("src.services.stats_service.get_players_pool", return_value=mock_pool):
            result = await get_stat_leaders(limit=5)
            assert "fg_pct" not in result.categories
            assert "three_pct" in result.categories

    async def test_db_pct_category_error(self):
        avg_row = {
            "full_name": "Player",
            "player_id": 1,
            "headshot_url": "",
            "team_abbrev": "BOS",
            "gp": 70,
            "avg_val": 25.0,
        }

        call_count = 0

        async def mock_fetch(query, *args):
            nonlocal call_count
            call_count += 1
            if call_count <= 6:
                return [avg_row]
            raise Exception("pct query error")

        mock_conn = AsyncMock()
        mock_conn.fetch = mock_fetch
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("src.services.stats_service.get_players_pool", return_value=mock_pool):
            result = await get_stat_leaders(limit=5)
            # avg categories should still be present
            assert "pts" in result.categories


class TestGetTeamStatsList:
    async def test_no_pool(self):
        with patch("src.services.stats_service.get_teams_pool", return_value=None):
            result = await get_team_stats_list()
            assert result == []

    async def test_pool_error(self):
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(side_effect=Exception("DB down"))
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("src.services.stats_service.get_teams_pool", return_value=mock_pool):
            result = await get_team_stats_list()
            assert result == []

    async def test_current_season_rows_returned_directly(self):
        """Rows come back for the current-season query — the fallback
        query (516-517) is never issued."""
        row = {
            "team_abbrev": "BOS",
            "wins": 50,
            "losses": 10,
            "pace": 99.5,
            "ortg": 118.2,
            "drtg": 108.1,
            "net_rtg": 10.1,
            "ts_pct": 58.3,
        }
        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(return_value=[row])
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("src.services.stats_service.get_teams_pool", return_value=mock_pool):
            result = await get_team_stats_list()
            assert len(result) == 1
            assert result[0].team == "BOS"
            assert mock_conn.fetch.call_count == 1

    async def test_empty_current_season_falls_back_to_max_season(self):
        """The current-season query returns no rows, so the fallback query
        against MAX(season) is issued and its rows are used (516-519)."""
        row = {
            "team_abbrev": "LAL",
            "wins": 40,
            "losses": 20,
            "pace": 101.2,
            "ortg": 114.0,
            "drtg": 110.5,
            "net_rtg": 3.5,
            "ts_pct": 56.0,
        }
        call_count = 0

        async def mock_fetch(query, *args):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return []
            return [row]

        mock_conn = AsyncMock()
        mock_conn.fetch = mock_fetch
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("src.services.stats_service.get_teams_pool", return_value=mock_pool):
            result = await get_team_stats_list()
            assert call_count == 2
            assert len(result) == 1
            assert result[0].team == "LAL"
