"""Tests for pick_sync_service — file finding, pick parsing, field mapping."""

from __future__ import annotations

from datetime import date

from src.services.pick_sync_service import _parse_picks, find_picks_file


class TestFindPicksFile:
    def test_iso_date_format(self, tmp_path):
        p = tmp_path / "xl_picks_2026-02-20.json"
        p.write_text("[]")
        result = find_picks_file(str(tmp_path), date(2026, 2, 20))
        assert result == p

    def test_compact_date_format(self, tmp_path):
        p = tmp_path / "xl_picks_20260220.json"
        p.write_text("[]")
        result = find_picks_file(str(tmp_path), date(2026, 2, 20))
        assert result == p

    def test_iso_preferred_over_compact(self, tmp_path):
        iso = tmp_path / "xl_picks_2026-02-20.json"
        iso.write_text("[]")
        compact = tmp_path / "xl_picks_20260220.json"
        compact.write_text("[]")
        result = find_picks_file(str(tmp_path), date(2026, 2, 20))
        assert result == iso

    def test_returns_none_for_missing_file(self, tmp_path):
        result = find_picks_file(str(tmp_path), date(2026, 1, 1))
        assert result is None

    def test_returns_none_for_invalid_directory(self):
        result = find_picks_file("/nonexistent/path", date(2026, 1, 1))
        assert result is None


class TestParsePicks:
    def test_basic_pick_parsing(self):
        raw = [
            {
                "player_name": "LeBron James",
                "team": "LAL",
                "stat_type": "POINTS",
                "side": "OVER",
                "best_line": 24.5,
                "best_book": "DraftKings",
                "filter_tier": "X",
                "edge_pct": 8.5,
                "consensus_line": 25.0,
                "model_version": "xl",
                "p_over": 0.85,
                "edge": 4.5,
                "reasoning": "Strong matchup",
                "confidence": "high",
                "line_spread": 2.5,
                "opponent_team": "WAS",
                "is_home": True,
            }
        ]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert len(picks) == 1
        p = picks[0]
        assert p["player_name"] == "LeBron James"
        assert p["team"] == "LAL"
        assert p["market"] == "POINTS"
        assert p["prediction"] == "OVER"
        assert p["line"] == 24.5
        assert p["book"] == "DraftKings"
        assert p["tier"] == "X"
        assert p["edge_pct"] == 8.5
        assert p["consensus_line"] == 25.0
        assert p["model_version"] == "xl"
        assert p["p_over"] == 0.85
        assert p["edge"] == 4.5
        assert p["reasoning"] == "Strong matchup"
        assert p["confidence"] == "high"
        assert p["line_spread"] == 2.5
        assert p["game_date"] == date(2026, 2, 20)
        assert p["is_home"] is True

    def test_sport_suite_abbrev_mapping(self):
        raw = [{"team": "GSW", "opponent_team": "WAS", "player_name": "Curry"}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["team"] == "GS"
        assert picks[0]["opponent_team"] == "WSH"

    def test_missing_team_defaults_to_empty(self):
        raw = [{"player_name": "Test", "opponent_team": "BOS"}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["team"] == ""

    def test_numeric_conversion(self):
        raw = [
            {
                "player_name": "Test",
                "best_line": "22.5",
                "edge_pct": "8.0",
                "p_over": "0.85",
                "edge": "4.5",
                "consensus_line": "23.0",
                "line_spread": "2.0",
            }
        ]
        picks = _parse_picks(raw, date(2026, 2, 20))
        p = picks[0]
        assert p["line"] == 22.5
        assert p["edge_pct"] == 8.0
        assert p["p_over"] == 0.85

    def test_invalid_numeric_becomes_none(self):
        raw = [
            {
                "player_name": "Test",
                "best_line": "invalid",
            }
        ]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["line"] is None

    def test_player_name_fallback_to_player_key(self):
        raw = [{"player": "Fallback Player"}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["player_name"] == "Fallback Player"

    def test_empty_raw_returns_empty(self):
        assert _parse_picks([], date(2026, 2, 20)) == []

    def test_multiple_picks(self):
        raw = [
            {"player_name": "A", "team": "BOS"},
            {"player_name": "B", "team": "LAL"},
            {"player_name": "C", "team": "NYK"},
        ]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert len(picks) == 3
        assert picks[2]["team"] == "NY"  # NYK → NY mapping
