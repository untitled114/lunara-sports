"""Tests for poller helper functions: the scoreboard poller."""

from __future__ import annotations

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

    def test_neither_competitor_marked_home_returns_none(self):
        """Two competitors but neither has homeAway=="home" - home_team
        stays None and the event is dropped."""
        event = {
            "id": "1",
            "competitions": [
                {
                    "competitors": [
                        {"team": {"abbreviation": "BOS"}, "homeAway": "away", "score": "0"},
                        {"team": {"abbreviation": "LAL"}, "homeAway": "away", "score": "0"},
                    ]
                }
            ],
            "status": {"type": {}},
        }
        assert _parse_event(event) is None

    def test_malformed_event_missing_id_is_caught(self):
        """A KeyError while parsing (missing "id", accessed via event["id"]
        as the very first statement) is caught and logged, returning None
        instead of raising."""
        event = {"competitions": [], "status": {"type": {}}}
        assert _parse_event(event) is None


class TestEasternToday:
    def test_returns_date(self):
        result = _eastern_today()
        assert result is not None
        # Should be a date object
        assert hasattr(result, "year")
