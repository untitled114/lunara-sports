"""Extra tests for stats_service — player season stats, game log, athlete lookup."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from src.services.stats_service import (
    _build_athlete_lookup,
    _resolve_athlete,
    _safe_float,
    get_player_game_log,
    get_player_season_stats,
)


class TestSafeFloat:
    def test_valid_float(self):
        assert _safe_float("3.5") == "3.5"

    def test_invalid_float(self):
        assert _safe_float("bad") == "0.0"

    def test_range_format(self):
        assert _safe_float("4.2-9.8") == "0.0"

    def test_none(self):
        assert _safe_float(None) == "0.0"


class TestGetPlayerSeasonStatsDB:
    async def test_from_sport_suite(self):
        mock_row = {
            "gp": 70,
            "ppg": 25.3,
            "rpg": 7.2,
            "apg": 8.1,
            "spg": 1.5,
            "bpg": 0.8,
            "fg_pct": 52.1,
            "three_pct": 38.5,
            "ft_pct": 85.2,
        }
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value=mock_row)
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("src.services.stats_service.get_players_pool", return_value=mock_pool):
            result = await get_player_season_stats("12345")
            assert result is not None
            assert result.gp == 70
            assert result.ppg == "25.3"

    async def test_from_sport_suite_no_games(self):
        mock_row = {"gp": 0}
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value=mock_row)
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("src.services.stats_service.get_players_pool", return_value=mock_pool),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_stats = AsyncMock(return_value=None)
            result = await get_player_season_stats("12345")
            assert result is None

    async def test_from_sport_suite_error_falls_to_espn(self):
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(side_effect=Exception("DB error"))
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("src.services.stats_service.get_players_pool", return_value=mock_pool),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_stats = AsyncMock(return_value=None)
            result = await get_player_season_stats("12345")
            assert result is None

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
                                "70",
                                "70",
                                "36.5",
                                "9.2",
                                ".521",
                                "2.5",
                                ".385",
                                "7.0",
                                ".852",
                                "1.2",
                                "6.0",
                                "7.2",
                                "8.1",
                                "0.8",
                                "1.5",
                                "2.1",
                                "3.5",
                                "25.3",
                            ],
                        }
                    ],
                }
            ]
        }

        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_stats = AsyncMock(return_value=espn_data)
            result = await get_player_season_stats("12345")
            assert result is not None
            assert result.gp == 70

    async def test_espn_fallback_no_average_category(self):
        espn_data = {
            "categories": [
                {"displayName": "Regular Season Totals", "labels": [], "statistics": []},
            ]
        }
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_stats = AsyncMock(return_value=espn_data)
            result = await get_player_season_stats("12345")
            assert result is None

    async def test_espn_error(self):
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_stats = AsyncMock(side_effect=Exception("ESPN down"))
            result = await get_player_season_stats("12345")
            assert result is None


class TestGetPlayerGameLogDB:
    async def test_from_sport_suite(self):
        from datetime import date as dt_date

        mock_rows = [
            {
                "date": dt_date(2026, 3, 20),
                "team": "GSW",
                "opponent": "NOP",
                "is_home": True,
                "points": 30,
                "rebounds": 5,
                "assists": 8,
                "steals": 2,
                "blocks": 1,
                "fg_made": 12,
                "fg_attempted": 22,
                "tpm": 3,
                "tpa": 8,
            }
        ]
        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(return_value=mock_rows)
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("src.services.stats_service.get_players_pool", return_value=mock_pool):
            result = await get_player_game_log("12345")
            assert len(result) == 1
            assert result[0]["pts"] == 30
            assert result[0]["home_away"] == "vs"

    async def test_from_sport_suite_error_falls_to_espn(self):
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(side_effect=Exception("DB error"))
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("src.services.stats_service.get_players_pool", return_value=mock_pool),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_gamelog = AsyncMock(return_value=None)
            result = await get_player_game_log("12345")
            assert result == []

    async def test_espn_fallback(self):
        espn_data = {
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
                "ev1": {
                    "gameDate": "2026-03-20T02:30:00Z",
                    "opponent": {"abbreviation": "LAL"},
                    "team": {"abbreviation": "BOS"},
                    "atVs": "vs",
                    "gameResult": "W",
                    "score": "110-98",
                },
            },
            "seasonTypes": [
                {
                    "categories": [
                        {
                            "events": [
                                {
                                    "eventId": "ev1",
                                    "stats": [
                                        "36",
                                        "12-22",
                                        ".545",
                                        "3-8",
                                        ".375",
                                        "5-6",
                                        ".833",
                                        "7",
                                        "8",
                                        "1",
                                        "2",
                                        "2",
                                        "3",
                                        "30",
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        }
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_gamelog = AsyncMock(return_value=espn_data)
            result = await get_player_game_log("12345")
            assert len(result) == 1
            assert result[0]["pts"] == 30

    async def test_espn_error(self):
        with (
            patch("src.services.stats_service.get_players_pool", return_value=None),
            patch("src.services.stats_service.espn_client") as mock_espn,
        ):
            mock_espn.get_athlete_gamelog = AsyncMock(side_effect=Exception("ESPN down"))
            result = await get_player_game_log("12345")
            assert result == []


class TestBuildAthleteLookup:
    async def test_builds_lookup(self):
        roster_data = {
            "team": {
                "athletes": [
                    {"id": "123", "displayName": "LeBron James"},
                    {"id": "456", "displayName": "Anthony Davis"},
                ]
            }
        }
        with (
            patch("src.services.stats_service.espn_client") as mock_espn,
            patch("src.services.team_mapping.ESPN_TEAM_IDS", {"LAL": 13}),
        ):
            mock_espn.get_team_roster = AsyncMock(return_value=roster_data)
            result = await _build_athlete_lookup()
            assert "123" in result
            assert result["123"]["name"] == "LeBron James"

    async def test_handles_error(self):
        with (
            patch("src.services.stats_service.espn_client") as mock_espn,
            patch("src.services.team_mapping.ESPN_TEAM_IDS", {"LAL": 13}),
        ):
            mock_espn.get_team_roster = AsyncMock(side_effect=Exception("error"))
            result = await _build_athlete_lookup()
            assert result == {}


class TestResolveAthlete:
    async def test_from_map(self):
        athlete_map = {"123": {"name": "LeBron James", "abbrev": "LAL"}}
        result = await _resolve_athlete("123", athlete_map)
        assert result["name"] == "LeBron James"

    async def test_from_espn(self):
        espn_data = {
            "displayName": "Anthony Davis",
            "team": {"abbreviation": "LAL"},
        }
        with patch("src.services.stats_service.espn_client") as mock_espn:
            mock_espn.get_athlete_info = AsyncMock(return_value=espn_data)
            result = await _resolve_athlete("456", {})
            assert result["name"] == "Anthony Davis"

    async def test_espn_returns_none(self):
        with patch("src.services.stats_service.espn_client") as mock_espn:
            mock_espn.get_athlete_info = AsyncMock(return_value=None)
            result = await _resolve_athlete("999", {})
            assert "Player 999" in result["name"]

    async def test_espn_error(self):
        with patch("src.services.stats_service.espn_client") as mock_espn:
            mock_espn.get_athlete_info = AsyncMock(side_effect=Exception("err"))
            result = await _resolve_athlete("999", {})
            assert "Player 999" in result["name"]
