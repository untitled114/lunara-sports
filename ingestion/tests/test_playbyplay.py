"""Tests for the ESPN play-by-play collector."""

from datetime import datetime, timezone

from src.collectors.playbyplay import (
    _build_team_map,
    _extract_player_name,
    _normalize_event_type,
    _parse_play,
)


class TestNormalizeEventType:
    def test_exact_match(self):
        assert _normalize_event_type("Jump Shot") == "jump_shot"
        assert _normalize_event_type("Defensive Rebound") == "rebound_defensive"
        assert _normalize_event_type("Dunk") == "dunk"
        assert _normalize_event_type("Substitution") == "substitution"

    def test_free_throw_variants(self):
        assert _normalize_event_type("Free Throw 1 of 2") == "free_throw"
        assert _normalize_event_type("Free Throw 2 of 2") == "free_throw"
        assert _normalize_event_type("Free Throw 1 of 3") == "free_throw"
        assert _normalize_event_type("Free Throw 3 of 3") == "free_throw"
        # Unknown free throw variant still normalizes
        assert _normalize_event_type("Free Throw Technical") == "free_throw"

    def test_foul_variants(self):
        assert _normalize_event_type("Personal Foul") == "foul"
        assert _normalize_event_type("Shooting Foul") == "foul_shooting"
        # Unknown foul variant falls back to generic
        assert _normalize_event_type("Away From Play Foul") == "foul"

    def test_rebound_fallback(self):
        assert _normalize_event_type("Unknown Rebound") == "rebound"

    def test_unknown_becomes_snake_case(self):
        assert _normalize_event_type("Some New Play Type") == "some_new_play_type"

    def test_case_insensitive(self):
        assert _normalize_event_type("JUMP SHOT") == "jump_shot"
        assert _normalize_event_type("jump shot") == "jump_shot"


class TestExtractPlayerName:
    def test_simple_name(self):
        assert _extract_player_name("LeBron James makes 15-foot jumper") == "LeBron James"

    def test_hyphenated_name(self):
        assert _extract_player_name("Shai Gilgeous-Alexander makes layup") == "Shai Gilgeous-Alexander"

    def test_apostrophe_name(self):
        assert _extract_player_name("De'Aaron Fox misses jump shot") == "De'Aaron Fox"

    def test_suffix_jr(self):
        assert _extract_player_name("Jaren Jackson Jr. blocks shot") == "Jaren Jackson Jr."

    def test_three_word_name(self):
        assert _extract_player_name("Karl Anthony Towns makes dunk") == "Karl Anthony Towns"

    def test_no_match(self):
        assert _extract_player_name("End of 1st Quarter") is None
        assert _extract_player_name("") is None
        assert _extract_player_name(None) is None


class TestBuildTeamMap:
    def test_standard_header(self):
        header = {
            "competitions": [
                {
                    "competitors": [
                        {
                            "homeAway": "home",
                            "team": {"id": "2", "abbreviation": "BOS"},
                        },
                        {
                            "homeAway": "away",
                            "team": {"id": "13", "abbreviation": "LAL"},
                        },
                    ]
                }
            ]
        }
        result = _build_team_map(header)
        assert result == {"2": "BOS", "13": "LAL"}

    def test_empty_header(self):
        assert _build_team_map({}) == {}
        assert _build_team_map({"competitions": []}) == {}


def _make_espn_play(
    *,
    play_id="4018106437",
    seq="7",
    type_text="Pullup Jump Shot",
    text="De'Aaron Fox misses 11-foot pullup jump shot",
    away_score=0,
    home_score=0,
    period_number=1,
    clock="11:45",
    scoring_play=False,
    score_value=0,
    team_id="24",
    wallclock="2026-02-12T03:11:45Z",
):
    return {
        "id": play_id,
        "sequenceNumber": seq,
        "type": {"text": type_text},
        "text": text,
        "awayScore": away_score,
        "homeScore": home_score,
        "period": {"number": period_number},
        "clock": {"displayValue": clock},
        "scoringPlay": scoring_play,
        "scoreValue": score_value,
        "team": {"id": team_id},
        "wallclock": wallclock,
    }


class TestParsePlay:
    def setup_method(self):
        self.team_map = {"24": "SA", "9": "GS"}
        self.polled = datetime(2026, 2, 12, 4, 0, 0, tzinfo=timezone.utc)

    def test_missed_shot(self):
        play = _make_espn_play()
        result = _parse_play(play, "401810643", self.team_map, self.polled)

        assert result is not None
        assert result.game_id == "401810643"
        assert result.play_id == "4018106437"
        assert result.sequence_number == 7
        assert result.quarter == 1
        assert result.clock == "11:45"
        assert result.event_type == "jump_shot"
        assert result.event_text == "Pullup Jump Shot"
        assert result.player_name == "De'Aaron Fox"
        assert result.team == "SA"
        assert result.scoring_play is False
        assert result.score_value == 0
        assert result.polled_at == self.polled

    def test_scoring_play(self):
        play = _make_espn_play(
            play_id="40181064311",
            seq="11",
            type_text="Jump Shot",
            text="Moses Moody makes 27-foot three point jumper (Pat Spencer assists)",
            home_score=3,
            scoring_play=True,
            score_value=3,
            team_id="9",
        )
        result = _parse_play(play, "401810643", self.team_map, self.polled)

        assert result.scoring_play is True
        assert result.score_value == 3
        assert result.home_score == 3
        assert result.team == "GS"
        assert result.player_name == "Moses Moody"

    def test_rebound(self):
        play = _make_espn_play(
            seq="8",
            type_text="Defensive Rebound",
            text="Pat Spencer defensive rebound",
            team_id="9",
        )
        result = _parse_play(play, "401810643", self.team_map, self.polled)

        assert result.event_type == "rebound_defensive"
        assert result.player_name == "Pat Spencer"
        assert result.team == "GS"

    def test_unknown_team_id_returns_none_team(self):
        play = _make_espn_play(team_id="999")
        result = _parse_play(play, "401810643", self.team_map, self.polled)
        assert result.team is None

    def test_wallclock_parsed(self):
        play = _make_espn_play(wallclock="2026-02-12T03:11:45Z")
        result = _parse_play(play, "401810643", self.team_map, self.polled)
        assert result.wallclock == datetime(2026, 2, 12, 3, 11, 45, tzinfo=timezone.utc)

    def test_missing_wallclock(self):
        play = _make_espn_play()
        del play["wallclock"]
        result = _parse_play(play, "401810643", self.team_map, self.polled)
        assert result.wallclock is None

    def test_invalid_sequence_returns_none(self):
        play = _make_espn_play(seq="not_a_number")
        result = _parse_play(play, "401810643", self.team_map, self.polled)
        assert result is None

    def test_serializes_to_dict(self):
        play = _make_espn_play()
        result = _parse_play(play, "401810643", self.team_map, self.polled)
        d = result.model_dump(mode="json")
        assert isinstance(d, dict)
        assert d["game_id"] == "401810643"
        assert d["sequence_number"] == 7
