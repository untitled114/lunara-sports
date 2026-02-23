"""Tests for poller helper functions — scoreboard, pick_sync, pick_tracker."""

from __future__ import annotations

from types import SimpleNamespace

from src.services.pick_sync_poller import _eastern_today as sync_eastern_today
from src.services.pick_tracker_poller import (
    MARKET_STAT_MAP,
    _get_stat_value,
    _name_match,
)
from src.services.scoreboard_poller import _eastern_today, _parse_event


class TestParseEvent:
    def _make_event(
        self, state="post", home="BOS", away="LAL", home_score=110, away_score=105, **overrides
    ):
        event = {
            "id": "401810001",
            "competitions": [
                {
                    "competitors": [
                        {
                            "team": {"abbreviation": home},
                            "homeAway": "home",
                            "score": str(home_score),
                        },
                        {
                            "team": {"abbreviation": away},
                            "homeAway": "away",
                            "score": str(away_score),
                        },
                    ],
                    "date": "2026-02-20T00:30:00Z",
                    "venue": {"fullName": "TD Garden"},
                }
            ],
            "status": {
                "type": {"state": state, "description": ""},
                "period": 4,
                "displayClock": "0:00",
            },
        }
        event.update(overrides)
        return event

    def test_final_game(self):
        event = self._make_event(state="post")
        result = _parse_event(event)
        assert result is not None
        assert result["id"] == "401810001"
        assert result["home_team"] == "BOS"
        assert result["away_team"] == "LAL"
        assert result["home_score"] == 110
        assert result["away_score"] == 105
        assert result["status"] == "final"
        assert result["venue"] == "TD Garden"

    def test_live_game(self):
        event = self._make_event(state="in")
        result = _parse_event(event)
        assert result["status"] == "live"
        assert result["quarter"] == 4
        assert result["clock"] == "0:00"

    def test_halftime(self):
        event = self._make_event(state="in")
        event["status"]["type"]["description"] = "Halftime"
        result = _parse_event(event)
        assert result["status"] == "halftime"

    def test_scheduled(self):
        result = _parse_event(self._make_event(state="pre"))
        assert result["status"] == "scheduled"
        assert result["quarter"] is None
        assert result["clock"] is None

    def test_missing_competitors(self):
        event = {"id": "1", "competitions": [{"competitors": []}], "status": {"type": {}}}
        assert _parse_event(event) is None

    def test_only_one_competitor(self):
        event = {
            "id": "1",
            "competitions": [
                {
                    "competitors": [
                        {"team": {"abbreviation": "BOS"}, "homeAway": "home", "score": "0"},
                    ]
                }
            ],
            "status": {"type": {}},
        }
        assert _parse_event(event) is None

    def test_score_zero_or_empty(self):
        event = self._make_event(home_score=0, away_score=0)
        result = _parse_event(event)
        assert result["home_score"] == 0
        assert result["away_score"] == 0


class TestEasternToday:
    def test_returns_date(self):
        result = _eastern_today()
        assert result is not None
        # Should be a date object
        assert hasattr(result, "year")

    def test_sync_eastern_today(self):
        result = sync_eastern_today()
        assert result is not None


class TestNameMatch:
    def test_exact_match(self):
        assert _name_match("LeBron James", "LeBron James") is True

    def test_case_insensitive(self):
        assert _name_match("lebron james", "LEBRON JAMES") is True

    def test_last_name_match(self):
        assert _name_match("LeBron James", "L. James") is True

    def test_no_match(self):
        assert _name_match("LeBron James", "Stephen Curry") is False

    def test_empty_strings(self):
        assert _name_match("", "") is True  # both empty → pn == bn

    def test_whitespace_handling(self):
        assert _name_match("  LeBron James  ", "LeBron James") is True

    def test_short_last_name_no_match(self):
        # Last names <= 2 chars shouldn't trigger last-name match
        assert _name_match("Chris Lu", "John Lu") is False


class TestGetStatValue:
    def _make_player(self, **kwargs):
        return SimpleNamespace(**kwargs)

    def test_points(self):
        player = self._make_player(points=25)
        assert _get_stat_value(player, "POINTS") == 25.0

    def test_rebounds(self):
        player = self._make_player(rebounds=10)
        assert _get_stat_value(player, "REBOUNDS") == 10.0

    def test_assists(self):
        player = self._make_player(assists=8)
        assert _get_stat_value(player, "ASSISTS") == 8.0

    def test_steals(self):
        player = self._make_player(steals=3)
        assert _get_stat_value(player, "STEALS") == 3.0

    def test_blocks(self):
        player = self._make_player(blocks=2)
        assert _get_stat_value(player, "BLOCKS") == 2.0

    def test_threes_parsed_from_made_format(self):
        player = self._make_player(three_pt="3-7")
        assert _get_stat_value(player, "THREES") == 3.0

    def test_threes_zero(self):
        player = self._make_player(three_pt="0-5")
        assert _get_stat_value(player, "THREES") == 0.0

    def test_unknown_market(self):
        player = self._make_player()
        assert _get_stat_value(player, "UNKNOWN") is None

    def test_missing_stat_returns_none(self):
        player = self._make_player()
        assert _get_stat_value(player, "POINTS") is None


class TestMarketStatMap:
    def test_expected_markets(self):
        assert "POINTS" in MARKET_STAT_MAP
        assert "REBOUNDS" in MARKET_STAT_MAP
        assert "ASSISTS" in MARKET_STAT_MAP
        assert "STEALS" in MARKET_STAT_MAP
        assert "BLOCKS" in MARKET_STAT_MAP
        assert "THREES" in MARKET_STAT_MAP
