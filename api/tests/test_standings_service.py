"""Tests for standings_service — parsing ESPN standings data."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from src.services.standings_service import (
    _get_stat,
    _parse_conference,
    _parse_record,
    get_standings,
)


class TestParseRecord:
    def test_found_by_abbreviation(self):
        entry = {"stats": [{"abbreviation": "W", "displayValue": "40"}]}
        assert _parse_record(entry, "W") == "40"

    def test_found_by_name(self):
        entry = {"stats": [{"name": "wins", "displayValue": "40"}]}
        assert _parse_record(entry, "wins") == "40"

    def test_not_found(self):
        entry = {"stats": [{"name": "losses", "displayValue": "10"}]}
        assert _parse_record(entry, "wins") == ""

    def test_empty_stats(self):
        assert _parse_record({"stats": []}, "W") == ""
        assert _parse_record({}, "W") == ""


class TestGetStat:
    def test_found_by_name(self):
        entry = {"stats": [{"name": "wins", "displayValue": "42"}]}
        assert _get_stat(entry, "wins") == "42"

    def test_found_by_abbreviation(self):
        entry = {"stats": [{"abbreviation": "GB", "displayValue": "3.5"}]}
        assert _get_stat(entry, "GB") == "3.5"

    def test_not_found(self):
        entry = {"stats": []}
        assert _get_stat(entry, "missing") == ""


class TestParseConference:
    def _make_conf(self, entries):
        return {"standings": {"entries": entries}}

    def _make_entry(self, name, abbrev, wins, losses, espn_id="1"):
        return {
            "team": {
                "id": espn_id,
                "displayName": name,
                "abbreviation": abbrev,
                "logos": [{"href": "http://logo.png"}],
            },
            "stats": [
                {"name": "wins", "displayValue": str(wins)},
                {"name": "losses", "displayValue": str(losses)},
                {"name": "gamesBehind", "displayValue": "2.5"},
                {"name": "streak", "displayValue": "W3"},
            ],
        }

    def test_single_team(self):
        conf = self._make_conf([self._make_entry("Boston Celtics", "BOS", 40, 10)])
        teams = _parse_conference(conf)
        assert len(teams) == 1
        assert teams[0].name == "Boston Celtics"
        assert teams[0].abbrev == "BOS"
        assert teams[0].w == 40
        assert teams[0].l == 10
        assert teams[0].pct == ".800"
        assert teams[0].gb == "2.5"
        assert teams[0].strk == "W3"
        assert teams[0].rank == 1

    def test_sorted_by_win_pct(self):
        conf = self._make_conf(
            [
                self._make_entry("Team A", "AAA", 20, 30, "1"),
                self._make_entry("Team B", "BBB", 40, 10, "2"),
            ]
        )
        teams = _parse_conference(conf)
        assert teams[0].abbrev == "BBB"  # .800 > .400
        assert teams[0].rank == 1
        assert teams[1].abbrev == "AAA"
        assert teams[1].rank == 2

    def test_gsw_normalization(self):
        conf = self._make_conf([self._make_entry("Warriors", "GSW", 30, 20)])
        teams = _parse_conference(conf)
        assert teams[0].abbrev == "GS"

    def test_empty_conference(self):
        assert _parse_conference({"standings": {"entries": []}}) == []

    def test_zero_games_pct(self):
        conf = self._make_conf([self._make_entry("Team", "TST", 0, 0)])
        teams = _parse_conference(conf)
        assert teams[0].pct == ".000"

    def test_gb_zero_becomes_dash(self):
        entry = {
            "team": {"id": "1", "displayName": "Team", "abbreviation": "TST"},
            "stats": [
                {"name": "wins", "displayValue": "50"},
                {"name": "losses", "displayValue": "10"},
                {"name": "gamesBehind", "displayValue": "0"},
            ],
        }
        teams = _parse_conference({"standings": {"entries": [entry]}})
        assert teams[0].gb == "-"


@pytest.mark.asyncio
class TestGetStandings:
    async def test_returns_standings(self):
        mock_data = {
            "children": [
                {
                    "name": "Eastern Conference",
                    "standings": {
                        "entries": [
                            {
                                "team": {
                                    "id": "2",
                                    "displayName": "Boston Celtics",
                                    "abbreviation": "BOS",
                                },
                                "stats": [
                                    {"name": "wins", "displayValue": "40"},
                                    {"name": "losses", "displayValue": "10"},
                                ],
                            }
                        ]
                    },
                },
                {
                    "name": "Western Conference",
                    "standings": {
                        "entries": [
                            {
                                "team": {
                                    "id": "13",
                                    "displayName": "Los Angeles Lakers",
                                    "abbreviation": "LAL",
                                },
                                "stats": [
                                    {"name": "wins", "displayValue": "35"},
                                    {"name": "losses", "displayValue": "15"},
                                ],
                            }
                        ]
                    },
                },
            ],
            "seasons": [{"displayName": "2025-26"}],
        }
        with patch("src.services.standings_service.espn_client") as mock_espn:
            mock_espn.get_standings = AsyncMock(return_value=mock_data)
            result = await get_standings()
            assert len(result.eastern) == 1
            assert len(result.western) == 1
            assert result.eastern[0].name == "Boston Celtics"
            assert result.western[0].name == "Los Angeles Lakers"
            assert result.season == "2025-26"

    async def test_empty_on_no_data(self):
        with patch("src.services.standings_service.espn_client") as mock_espn:
            mock_espn.get_standings = AsyncMock(return_value=None)
            result = await get_standings()
            assert result.eastern == []
            assert result.western == []
