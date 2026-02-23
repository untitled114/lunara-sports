"""Tests for the ESPN scoreboard collector."""

from datetime import datetime, timezone

from src.collectors.scoreboard import _parse_competitor, _parse_game


# Minimal ESPN event fixture matching the real API shape
def _make_espn_event(
    *,
    game_id="401710647",
    home_abbrev="BOS",
    home_name="Boston Celtics",
    away_abbrev="LAL",
    away_name="Los Angeles Lakers",
    home_score="108",
    away_score="102",
    status_name="STATUS_IN_PROGRESS",
    status_state="in",
    period=3,
    display_clock="5:42",
    short_detail="3rd 5:42",
    venue_name="TD Garden",
    date="2026-02-17T00:00Z",
):
    return {
        "id": game_id,
        "date": date,
        "competitions": [
            {
                "competitors": [
                    {
                        "homeAway": "home",
                        "score": home_score,
                        "team": {
                            "abbreviation": home_abbrev,
                            "displayName": home_name,
                        },
                    },
                    {
                        "homeAway": "away",
                        "score": away_score,
                        "team": {
                            "abbreviation": away_abbrev,
                            "displayName": away_name,
                        },
                    },
                ],
                "status": {
                    "period": period,
                    "displayClock": display_clock,
                    "type": {
                        "name": status_name,
                        "state": status_state,
                        "shortDetail": short_detail,
                    },
                },
                "venue": {"fullName": venue_name},
            }
        ],
    }


class TestParseCompetitor:
    def test_home_team(self):
        competitors = [
            {
                "homeAway": "home",
                "score": "55",
                "team": {"abbreviation": "MIA", "displayName": "Miami Heat"},
            },
            {
                "homeAway": "away",
                "score": "48",
                "team": {"abbreviation": "NYK", "displayName": "New York Knicks"},
            },
        ]
        result = _parse_competitor(competitors, "home")
        assert result["abbrev"] == "MIA"
        assert result["name"] == "Miami Heat"
        assert result["score"] == 55

    def test_away_team(self):
        competitors = [
            {
                "homeAway": "home",
                "score": "55",
                "team": {"abbreviation": "MIA", "displayName": "Miami Heat"},
            },
            {
                "homeAway": "away",
                "score": "48",
                "team": {"abbreviation": "NYK", "displayName": "New York Knicks"},
            },
        ]
        result = _parse_competitor(competitors, "away")
        assert result["abbrev"] == "NYK"
        assert result["score"] == 48

    def test_missing_team_returns_defaults(self):
        result = _parse_competitor([], "home")
        assert result["abbrev"] == "UNK"
        assert result["score"] == 0


class TestParseGame:
    def test_live_game(self):
        polled = datetime(2026, 2, 17, 1, 0, 0, tzinfo=timezone.utc)
        event = _make_espn_event()
        result = _parse_game(event, polled)

        assert result is not None
        assert result.game_id == "401710647"
        assert result.home_team == "BOS"
        assert result.away_team == "LAL"
        assert result.home_team_name == "Boston Celtics"
        assert result.away_team_name == "Los Angeles Lakers"
        assert result.home_score == 108
        assert result.away_score == 102
        assert result.status == "live"
        assert result.quarter == 3
        assert result.clock == "5:42"
        assert result.venue == "TD Garden"
        assert result.polled_at == polled

    def test_scheduled_game(self):
        polled = datetime(2026, 2, 17, 12, 0, 0, tzinfo=timezone.utc)
        event = _make_espn_event(
            home_score="0",
            away_score="0",
            status_name="STATUS_SCHEDULED",
            status_state="pre",
            period=0,
            display_clock="0.0",
            short_detail="2/17 - 7:00 PM EST",
        )
        result = _parse_game(event, polled)

        assert result.status == "scheduled"
        assert result.home_score == 0
        assert result.quarter is None
        assert result.clock is None  # "0.0" is filtered out

    def test_final_game(self):
        polled = datetime(2026, 2, 17, 4, 0, 0, tzinfo=timezone.utc)
        event = _make_espn_event(
            home_score="115",
            away_score="110",
            status_name="STATUS_FINAL",
            status_state="post",
            period=4,
            display_clock="0.0",
            short_detail="Final",
        )
        result = _parse_game(event, polled)

        assert result.status == "final"
        assert result.home_score == 115
        assert result.away_score == 110
        assert result.status_detail == "Final"

    def test_halftime(self):
        polled = datetime(2026, 2, 17, 2, 0, 0, tzinfo=timezone.utc)
        event = _make_espn_event(
            status_name="STATUS_HALFTIME",
            status_state="in",
            period=2,
            display_clock="0.0",
            short_detail="Halftime",
        )
        result = _parse_game(event, polled)
        assert result.status == "halftime"

    def test_empty_competitions_returns_none(self):
        result = _parse_game({"id": "123", "competitions": []}, datetime.now(timezone.utc))
        assert result is None

    def test_serializes_to_dict(self):
        polled = datetime(2026, 2, 17, 1, 0, 0, tzinfo=timezone.utc)
        event = _make_espn_event()
        result = _parse_game(event, polled)
        d = result.model_dump(mode="json")

        assert isinstance(d, dict)
        assert d["game_id"] == "401710647"
        assert isinstance(d["polled_at"], str)
