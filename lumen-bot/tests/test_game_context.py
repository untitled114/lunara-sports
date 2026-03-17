"""Tests for the Game Context Engine — Lumen's brain."""

import sys
from pathlib import Path

# Add lumen-bot to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from game_context import (
    AlertType,
    GameContextEngine,
    GamePhase,
    GameState,
    PickContext,
    calculate_pace_projection,
    parse_minutes_str,
    parse_shot_str,
    _clock_to_seconds,
)


class TestClockToSeconds:
    def test_standard(self):
        assert _clock_to_seconds("4:30") == 270.0

    def test_zero(self):
        assert _clock_to_seconds("0:00") == 0.0

    def test_full_quarter(self):
        assert _clock_to_seconds("12:00") == 720.0

    def test_empty(self):
        assert _clock_to_seconds("") == 0.0

    def test_none(self):
        assert _clock_to_seconds(None) == 0.0

    def test_seconds_only(self):
        assert _clock_to_seconds("30") == 30.0


class TestPaceProjection:
    def test_basic_projection(self):
        # 12 points in 24 minutes → 24 in 48
        result = calculate_pace_projection(12.0, 24.0)
        assert result == 24.0

    def test_too_early(self):
        # Under 6 minutes, should return None
        result = calculate_pace_projection(4.0, 5.0)
        assert result is None

    def test_halftime(self):
        # 18 points in 24 minutes → 36 in 48
        result = calculate_pace_projection(18.0, 24.0)
        assert result == 36.0

    def test_quarter(self):
        # 10 points in 12 minutes → 40 in 48
        result = calculate_pace_projection(10.0, 12.0)
        assert result == 40.0

    def test_with_real_minutes(self):
        # 18 points in 20 real minutes → 18/20 * 36 = 32.4
        result = calculate_pace_projection(18.0, 24.0, player_minutes=20.0)
        assert result == 32.4

    def test_real_minutes_too_few(self):
        # Under 5 real minutes, falls back to game clock
        result = calculate_pace_projection(4.0, 12.0, player_minutes=4.0)
        assert result == 16.0  # game clock fallback


class TestParseMinutes:
    def test_standard(self):
        assert parse_minutes_str("35:42") == 35.7

    def test_round(self):
        assert parse_minutes_str("24:00") == 24.0

    def test_empty(self):
        assert parse_minutes_str("") == 0.0

    def test_integer(self):
        assert parse_minutes_str("12") == 12.0


class TestParseShotStr:
    def test_standard(self):
        assert parse_shot_str("12-24") == (12, 24)

    def test_empty(self):
        assert parse_shot_str("") == (0, 0)

    def test_zeros(self):
        assert parse_shot_str("0-0") == (0, 0)


class TestGameState:
    def test_score_diff(self):
        game = GameState(game_id="1", home_team="DEN", away_team="LAL")
        game.home_score = 85
        game.away_score = 67
        assert game.score_diff == 18
        assert game.abs_diff == 18
        assert game.leading_team == "DEN"

    def test_tie(self):
        game = GameState(game_id="1", home_team="DEN", away_team="LAL")
        game.home_score = 50
        game.away_score = 50
        assert game.leading_team == "TIE"

    def test_phase_scheduled(self):
        game = GameState(game_id="1", home_team="DEN", away_team="LAL", status="scheduled")
        assert game.phase == GamePhase.PRE_GAME

    def test_phase_live_q3(self):
        game = GameState(game_id="1", home_team="DEN", away_team="LAL", status="live", quarter=3)
        assert game.phase == GamePhase.Q3

    def test_phase_halftime(self):
        game = GameState(game_id="1", home_team="DEN", away_team="LAL", status="halftime")
        assert game.phase == GamePhase.HALFTIME

    def test_phase_final(self):
        game = GameState(game_id="1", home_team="DEN", away_team="LAL", status="final")
        assert game.phase == GamePhase.FINAL

    def test_game_minutes_elapsed_q1(self):
        game = GameState(
            game_id="1",
            home_team="DEN",
            away_team="LAL",
            status="live",
            quarter=1,
            clock="6:00",
        )
        assert game.game_minutes_elapsed == 6.0

    def test_game_minutes_elapsed_q2(self):
        game = GameState(
            game_id="1",
            home_team="DEN",
            away_team="LAL",
            status="live",
            quarter=2,
            clock="6:00",
        )
        assert game.game_minutes_elapsed == 18.0

    def test_game_minutes_elapsed_halftime(self):
        game = GameState(
            game_id="1",
            home_team="DEN",
            away_team="LAL",
            status="halftime",
        )
        assert game.game_minutes_elapsed == 24.0

    def test_game_minutes_elapsed_final(self):
        game = GameState(
            game_id="1",
            home_team="DEN",
            away_team="LAL",
            status="final",
        )
        assert game.game_minutes_elapsed == 48.0

    def test_blowout_not_q3(self):
        game = GameState(
            game_id="1",
            home_team="DEN",
            away_team="LAL",
            status="live",
            quarter=2,
        )
        game.home_score = 60
        game.away_score = 30
        assert not game.is_blowout  # Only in Q3+

    def test_blowout_q3(self):
        game = GameState(
            game_id="1",
            home_team="DEN",
            away_team="LAL",
            status="live",
            quarter=3,
        )
        game.home_score = 85
        game.away_score = 60
        assert game.is_blowout

    def test_garbage_time(self):
        game = GameState(
            game_id="1",
            home_team="DEN",
            away_team="LAL",
            status="live",
            quarter=4,
            clock="3:00",
        )
        game.home_score = 120
        game.away_score = 85
        assert game.is_garbage_time

    def test_score_diff_for_team(self):
        game = GameState(game_id="1", home_team="DEN", away_team="LAL")
        game.home_score = 85
        game.away_score = 67
        assert game.score_diff_for_team("DEN") == 18
        assert game.score_diff_for_team("LAL") == -18


class TestPickContext:
    def _make_pick(self, prediction="OVER", line=26.5, actual=0.0):
        return PickContext(
            pick_id=1,
            player_name="Jokic",
            team="DEN",
            opponent_team="LAL",
            market="POINTS",
            line=line,
            prediction=prediction,
            tier="X",
            model_version="v3",
            book="DraftKings",
            is_home=True,
            actual_value=actual,
        )

    def test_comfort_unknown_no_snapshots(self):
        pick = self._make_pick()
        assert pick.comfort_level == "unknown"

    def test_latest_pace_empty(self):
        pick = self._make_pick()
        assert pick.latest_pace is None


class TestGameContextEngine:
    def test_register_picks(self):
        engine = GameContextEngine()
        picks = [
            {
                "id": 1,
                "game_id": "g1",
                "player_name": "Jokic",
                "team": "DEN",
                "opponent_team": "LAL",
                "market": "POINTS",
                "line": 26.5,
                "prediction": "OVER",
                "tier": "X",
                "model_version": "v3",
                "book": "DraftKings",
                "is_home": True,
            }
        ]
        engine.register_picks(picks)
        assert "g1" in engine.games
        assert 1 in engine.games["g1"].picks

    def test_update_game_halftime(self):
        engine = GameContextEngine()
        # Register a pick first
        engine.register_picks(
            [
                {
                    "id": 1,
                    "game_id": "g1",
                    "player_name": "Jokic",
                    "team": "DEN",
                    "opponent_team": "LAL",
                    "market": "POINTS",
                    "line": 26.5,
                    "prediction": "OVER",
                    "tier": "X",
                    "model_version": "v3",
                    "book": "DK",
                    "is_home": True,
                }
            ]
        )

        # First update: live
        engine.update_game(
            {
                "id": "g1",
                "home_team": "DEN",
                "away_team": "LAL",
                "home_score": 50,
                "away_score": 45,
                "status": "live",
                "quarter": 2,
                "clock": "0:01",
            }
        )

        # Second update: halftime
        alerts = engine.update_game(
            {
                "id": "g1",
                "home_team": "DEN",
                "away_team": "LAL",
                "home_score": 52,
                "away_score": 45,
                "status": "halftime",
                "quarter": 2,
                "clock": "0:00",
            }
        )

        alert_types = [a[0] for a in alerts]
        assert AlertType.HALFTIME_REPORT in alert_types

    def test_update_game_blowout(self):
        engine = GameContextEngine()
        engine.register_picks(
            [
                {
                    "id": 1,
                    "game_id": "g1",
                    "player_name": "Jokic",
                    "team": "DEN",
                    "opponent_team": "LAL",
                    "market": "POINTS",
                    "line": 26.5,
                    "prediction": "OVER",
                    "tier": "X",
                    "model_version": "v3",
                    "book": "DK",
                    "is_home": True,
                }
            ]
        )

        alerts = engine.update_game(
            {
                "id": "g1",
                "home_team": "DEN",
                "away_team": "LAL",
                "home_score": 95,
                "away_score": 70,
                "status": "live",
                "quarter": 3,
                "clock": "6:00",
            }
        )

        alert_types = [a[0] for a in alerts]
        assert AlertType.BLOWOUT_WARNING in alert_types

    def test_blowout_only_for_leading_team(self):
        """Blowout alert should only fire for picks on the LEADING team."""
        engine = GameContextEngine()
        # Pick on the LOSING team
        engine.register_picks(
            [
                {
                    "id": 1,
                    "game_id": "g1",
                    "player_name": "LeBron",
                    "team": "LAL",
                    "opponent_team": "DEN",
                    "market": "POINTS",
                    "line": 26.5,
                    "prediction": "OVER",
                    "tier": "X",
                    "model_version": "v3",
                    "book": "DK",
                    "is_home": False,
                }
            ]
        )

        alerts = engine.update_game(
            {
                "id": "g1",
                "home_team": "DEN",
                "away_team": "LAL",
                "home_score": 95,
                "away_score": 70,
                "status": "live",
                "quarter": 3,
                "clock": "6:00",
            }
        )

        # LeBron is on LAL (losing) — no blowout alert for him
        alert_types = [a[0] for a in alerts]
        assert AlertType.BLOWOUT_WARNING not in alert_types

    def test_update_picks_with_snapshot(self):
        engine = GameContextEngine()
        engine.register_picks(
            [
                {
                    "id": 1,
                    "game_id": "g1",
                    "player_name": "Jokic",
                    "team": "DEN",
                    "opponent_team": "LAL",
                    "market": "POINTS",
                    "line": 26.5,
                    "prediction": "OVER",
                    "tier": "X",
                    "model_version": "v3",
                    "book": "DK",
                    "is_home": True,
                }
            ]
        )

        # Set game state to live Q2
        engine.update_game(
            {
                "id": "g1",
                "home_team": "DEN",
                "away_team": "LAL",
                "home_score": 50,
                "away_score": 45,
                "status": "live",
                "quarter": 2,
                "clock": "6:00",
            }
        )

        # Update pick with actual value
        engine.update_picks(
            [
                {
                    "id": 1,
                    "game_id": "g1",
                    "player_name": "Jokic",
                    "market": "POINTS",
                    "actual_value": 18.0,
                }
            ]
        )

        ctx = engine.games["g1"].picks[1]
        assert ctx.actual_value == 18.0
        assert len(ctx.snapshots) == 1
        assert ctx.snapshots[0].pace_projection > 0

    def test_box_score_update(self):
        engine = GameContextEngine()
        engine.register_picks(
            [
                {
                    "id": 1,
                    "game_id": "g1",
                    "player_name": "Nikola Jokic",
                    "team": "DEN",
                    "opponent_team": "LAL",
                    "market": "POINTS",
                    "line": 26.5,
                    "prediction": "OVER",
                    "tier": "X",
                    "model_version": "v3",
                    "book": "DK",
                    "is_home": True,
                }
            ]
        )

        engine.update_game(
            {
                "id": "g1",
                "home_team": "DEN",
                "away_team": "LAL",
                "home_score": 50,
                "away_score": 45,
                "status": "live",
                "quarter": 2,
                "clock": "6:00",
            }
        )

        # Update with box score data
        engine.update_box_score(
            "g1",
            [
                {
                    "name": "Nikola Jokic",
                    "minutes": "18:30",
                    "fouls": 2,
                    "fg": "7-12",
                    "three_pt": "1-3",
                    "ft": "3-4",
                    "plus_minus": "+8",
                    "starter": True,
                }
            ],
        )

        ctx = engine.games["g1"].picks[1]
        assert ctx.box_score.minutes == 18.5
        assert ctx.box_score.fouls == 2
        assert ctx.box_score.fg_made == 7
        assert ctx.box_score.fg_attempted == 12
        assert ctx.box_score.starter is True

    def test_foul_trouble_alert(self):
        engine = GameContextEngine()
        engine.register_picks(
            [
                {
                    "id": 1,
                    "game_id": "g1",
                    "player_name": "Joel Embiid",
                    "team": "PHI",
                    "opponent_team": "BOS",
                    "market": "POINTS",
                    "line": 30.5,
                    "prediction": "OVER",
                    "tier": "X",
                    "model_version": "v3",
                    "book": "DK",
                    "is_home": True,
                }
            ]
        )

        engine.update_game(
            {
                "id": "g1",
                "home_team": "PHI",
                "away_team": "BOS",
                "home_score": 30,
                "away_score": 28,
                "status": "live",
                "quarter": 2,
                "clock": "6:00",
            }
        )

        # Embiid with 4 fouls in Q2 = foul trouble
        alerts = engine.update_box_score(
            "g1",
            [
                {
                    "name": "Joel Embiid",
                    "minutes": "14:00",
                    "fouls": 4,
                    "fg": "5-10",
                    "three_pt": "0-2",
                    "ft": "2-2",
                    "plus_minus": "+3",
                    "starter": True,
                }
            ],
        )

        alert_types = [a[0] for a in alerts]
        assert AlertType.FOUL_TROUBLE in alert_types

    def test_season_stats(self):
        engine = GameContextEngine()
        engine.register_picks(
            [
                {
                    "id": 1,
                    "game_id": "g1",
                    "player_name": "Jokic",
                    "team": "DEN",
                    "opponent_team": "LAL",
                    "market": "POINTS",
                    "line": 26.5,
                    "prediction": "OVER",
                    "tier": "X",
                    "model_version": "v3",
                    "book": "DK",
                    "is_home": True,
                }
            ]
        )

        engine.update_season_stats("g1", "Jokic", {"ppg": "26.3", "rpg": "12.1"})
        ctx = engine.games["g1"].picks[1]
        assert ctx.season_avg == 26.3

    def test_last_name_matching_box_score(self):
        engine = GameContextEngine()
        engine.register_picks(
            [
                {
                    "id": 1,
                    "game_id": "g1",
                    "player_name": "Nikola Jokic",
                    "team": "DEN",
                    "opponent_team": "LAL",
                    "market": "POINTS",
                    "line": 26.5,
                    "prediction": "OVER",
                    "tier": "X",
                    "model_version": "v3",
                    "book": "DK",
                    "is_home": True,
                }
            ]
        )
        engine.update_game(
            {
                "id": "g1",
                "home_team": "DEN",
                "away_team": "LAL",
                "home_score": 50,
                "away_score": 45,
                "status": "live",
                "quarter": 2,
                "clock": "6:00",
            }
        )

        # Box score has slightly different name format
        engine.update_box_score(
            "g1",
            [
                {
                    "name": "N. Jokic",
                    "minutes": "20:00",
                    "fouls": 1,
                    "fg": "8-14",
                    "three_pt": "1-2",
                    "ft": "1-1",
                    "plus_minus": "+5",
                    "starter": True,
                }
            ],
        )
        # Should match on last name "jokic"
        ctx = engine.games["g1"].picks[1]
        assert ctx.box_score.minutes == 20.0

    def test_quarter_transition(self):
        engine = GameContextEngine()
        engine.register_picks(
            [
                {
                    "id": 1,
                    "game_id": "g1",
                    "player_name": "Jokic",
                    "team": "DEN",
                    "opponent_team": "LAL",
                    "market": "POINTS",
                    "line": 26.5,
                    "prediction": "OVER",
                    "tier": "X",
                    "model_version": "v3",
                    "book": "DK",
                    "is_home": True,
                }
            ]
        )

        # Set up Q1
        engine.update_game(
            {
                "id": "g1",
                "home_team": "DEN",
                "away_team": "LAL",
                "home_score": 25,
                "away_score": 22,
                "status": "live",
                "quarter": 1,
                "clock": "0:01",
            }
        )

        # Transition to Q2
        alerts = engine.update_game(
            {
                "id": "g1",
                "home_team": "DEN",
                "away_team": "LAL",
                "home_score": 25,
                "away_score": 22,
                "status": "live",
                "quarter": 2,
                "clock": "12:00",
            }
        )

        alert_types = [a[0] for a in alerts]
        assert AlertType.QUARTER_SUMMARY in alert_types
