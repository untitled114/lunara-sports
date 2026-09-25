"""Tests for the Game Context Engine — Lumen's brain."""

import sys
from pathlib import Path

import pytest

# Add lumen-bot to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from game_context import (
    AlertType,
    GameContextEngine,
    GamePhase,
    GameState,
    PickContext,
    PlayerSnapshot,
    _clock_to_seconds,
    calculate_pace_projection,
    parse_minutes_str,
    parse_shot_str,
)


def _pick(**overrides) -> PickContext:
    """Free-standing PickContext builder for the supplementary tests below."""
    defaults = dict(
        pick_id=1,
        player_name="Jayson Tatum",
        team="BOS",
        opponent_team="NYK",
        market="POINTS",
        line=26.5,
        prediction="OVER",
        tier="X",
        model_version="v3",
        book="DraftKings",
        is_home=True,
    )
    defaults.update(overrides)
    return PickContext(**defaults)


def _pick_with_pace(prediction, line, pace) -> PickContext:
    ctx = _pick(prediction=prediction, line=line)
    ctx.snapshots.append(
        PlayerSnapshot(
            timestamp=0,
            actual_value=pace,
            game_minutes_elapsed=24,
            quarter=2,
            clock="0:00",
            pace_projection=pace,
            score_diff=0,
        )
    )
    return ctx


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


# ---------------------------------------------------------------------------
# Supplementary characterization — closes remaining gaps toward the
# service-wide ≥99.1% coverage target (Task 6). Everything above this line
# is pre-existing; everything below was added for that purpose.
# ---------------------------------------------------------------------------


class TestComfortLevelMatrix:
    """Full comfort_level matrix for both OVER and UNDER, line=100 for clean math."""

    def test_resolved_hit_and_miss(self):
        hit = _pick()
        hit.is_hit = True
        assert hit.comfort_level == "hit"

        miss = _pick()
        miss.is_hit = False
        assert miss.comfort_level == "miss"

    @pytest.mark.parametrize(
        ("pace", "expected"),
        [
            (135, "crushing"),  # diff=35 > 30
            (120, "comfortable"),  # diff=20, 15<20<=30
            (105, "on_track"),  # diff=5, 0<5<=15
            (95, "tight"),  # diff=-5 > -10
            (85, "behind"),  # diff=-15, -25<-15<=-10
            (50, "buried"),  # diff=-50 <= -25
        ],
    )
    def test_over(self, pace, expected):
        ctx = _pick_with_pace("OVER", 100, pace)
        assert ctx.comfort_level == expected

    @pytest.mark.parametrize(
        ("pace", "expected"),
        [
            (60, "crushing"),  # diff=40 > 30
            (75, "comfortable"),  # diff=25
            (95, "on_track"),  # diff=5
            (105, "tight"),  # diff=-5
            (115, "behind"),  # diff=-15
            (150, "buried"),  # diff=-50
        ],
    )
    def test_under(self, pace, expected):
        ctx = _pick_with_pace("UNDER", 100, pace)
        assert ctx.comfort_level == expected


class TestLeadingTeamAndPhase:
    def test_leading_team_away(self):
        game = GameState(game_id="1", home_team="DEN", away_team="LAL")
        game.home_score, game.away_score = 60, 70
        assert game.leading_team == "LAL"

    @pytest.mark.parametrize(
        ("quarter", "expected"),
        [
            (1, GamePhase.Q1),
            (2, GamePhase.Q2),
            (3, GamePhase.Q3),
            (4, GamePhase.Q4),
            (5, GamePhase.OT),
        ],
    )
    def test_phase(self, quarter, expected):
        game = GameState(
            game_id="1", home_team="DEN", away_team="LAL", status="live", quarter=quarter
        )
        assert game.phase == expected


class TestIsGarbageTimeBranches:
    def test_false_when_diff_below_severe(self):
        game = GameState(
            game_id="1", home_team="A", away_team="B", status="live", quarter=4, clock="3:00"
        )
        game.home_score, game.away_score = 100, 90  # abs_diff=10 < BLOWOUT_SEVERE(30)
        assert game.is_garbage_time is False

    def test_false_when_quarter_too_early(self):
        game = GameState(
            game_id="1", home_team="A", away_team="B", status="live", quarter=3, clock="3:00"
        )
        game.home_score, game.away_score = 120, 80  # abs_diff=40, but quarter=3 < 4
        assert game.is_garbage_time is False

    def test_true_when_both_conditions_met(self):
        game = GameState(
            game_id="1", home_team="A", away_team="B", status="live", quarter=4, clock="3:00"
        )
        game.home_score, game.away_score = 120, 80
        assert game.is_garbage_time is True


class TestTeamAndOpponentScore:
    def test_team_score_and_opponent_score_both_sides(self):
        game = GameState(game_id="1", home_team="DEN", away_team="LAL")
        game.home_score, game.away_score = 80, 70
        assert game.team_score("DEN") == 80
        assert game.team_score("LAL") == 70
        assert game.opponent_score("DEN") == 70
        assert game.opponent_score("LAL") == 80


class TestParsingExceptionPaths:
    def test_clock_to_seconds_value_error(self):
        assert _clock_to_seconds("ab:cd") == 0.0

    def test_parse_minutes_str_value_error(self):
        assert parse_minutes_str("ab:cd") == 0.0

    def test_parse_shot_str_value_error(self):
        assert parse_shot_str("ab-cd") == (0, 0)


class TestRegisterPicksSkipBranches:
    def test_missing_game_id_or_pick_id_skipped(self):
        engine = GameContextEngine()
        engine.register_picks([{"id": 1, "player_name": "X"}])  # no game_id
        engine.register_picks([{"game_id": "g1", "player_name": "X"}])  # no id
        assert engine.games == {}

    def test_already_resolved_pick_id_is_not_reregistered(self):
        engine = GameContextEngine()
        engine._resolved_pick_ids.add(1)
        engine.register_picks(
            [{"id": 1, "game_id": "g1", "player_name": "X", "home_team": "A", "away_team": "B"}]
        )
        assert "g1" not in engine.games

    def test_second_pick_in_same_known_game_reuses_game_state(self):
        """Second register_picks call for a game_id already in engine.games must
        not recreate the GameState, and a pick_id already tracked must not be
        recreated either."""
        engine = GameContextEngine()
        base = {
            "game_id": "g1",
            "home_team": "A",
            "away_team": "B",
            "team": "A",
            "opponent_team": "B",
            "market": "POINTS",
            "line": 10.5,
            "prediction": "OVER",
            "tier": "X",
            "model_version": "v3",
            "book": "DK",
            "is_home": True,
        }
        engine.register_picks([{**base, "id": 1, "player_name": "First"}])
        game_before = engine.games["g1"]

        engine.register_picks([{**base, "id": 1, "player_name": "First"}])  # same pick again
        assert engine.games["g1"] is game_before  # not recreated
        assert engine.games["g1"].picks[1].player_name == "First"

        engine.register_picks([{**base, "id": 2, "player_name": "Second"}])  # new pick, same game
        assert engine.games["g1"] is game_before
        assert set(engine.games["g1"].picks) == {1, 2}


class TestUpdateGameEdgeCases:
    def test_missing_id_returns_empty(self):
        engine = GameContextEngine()
        assert engine.update_game({"status": "live"}) == []

    def test_creates_new_game_when_not_previously_registered(self):
        engine = GameContextEngine()
        assert engine.games == {}
        engine.update_game(
            {"id": "g1", "home_team": "A", "away_team": "B", "status": "live", "quarter": 1}
        )
        assert "g1" in engine.games
        assert engine.games["g1"].home_team == "A"


class TestUpdatePicksSkipBranches:
    def test_missing_pick_id_or_game_id_skipped(self):
        engine = GameContextEngine()
        alerts = engine.update_picks([{"game_id": "g1", "actual_value": 10}])  # no "id"
        assert alerts == []

    def test_unknown_game_id_skipped(self):
        engine = GameContextEngine()
        alerts = engine.update_picks([{"id": 1, "game_id": "nope", "actual_value": 10}])
        assert alerts == []

    def test_unknown_pick_id_skipped(self):
        engine = GameContextEngine()
        engine.games["g1"] = GameState(game_id="g1", home_team="A", away_team="B")
        alerts = engine.update_picks([{"id": 999, "game_id": "g1", "actual_value": 10}])
        assert alerts == []

    def test_is_hit_only_update_does_not_touch_actual_value(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B", status="live")
        ctx = _pick(pick_id=1)
        game.picks = {1: ctx}
        engine.games["g1"] = game

        engine.update_picks([{"id": 1, "game_id": "g1", "is_hit": True}])

        assert ctx.actual_value == 0.0  # never set — only is_hit path ran
        assert ctx.is_hit is True
        assert 1 in engine._resolved_pick_ids
        assert ctx.snapshots == []  # actual was None -> no snapshot recorded

    def test_zero_elapsed_time_skips_snapshot(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B", status="scheduled")
        ctx = _pick(pick_id=1)
        game.picks = {1: ctx}
        engine.games["g1"] = game

        alerts = engine.update_picks([{"id": 1, "game_id": "g1", "actual_value": 10.0}])

        assert ctx.actual_value == 10.0
        assert ctx.snapshots == []  # game_minutes_elapsed == 0 for "scheduled"
        assert alerts == []


class TestGetPicksUnknownGame:
    def test_get_halftime_picks_unknown_game(self):
        engine = GameContextEngine()
        assert engine.get_halftime_picks("nope") == []

    def test_get_halftime_picks_found(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        reported = _pick(pick_id=1)
        reported.halftime_reported = True
        pending = _pick(pick_id=2)
        game.picks = {1: reported, 2: pending}
        engine.games["g1"] = game
        assert engine.get_halftime_picks("g1") == [pending]

    def test_get_quarter_picks_unknown_game(self):
        engine = GameContextEngine()
        assert engine.get_quarter_picks("nope", 1) == []

    def test_get_quarter_picks_found(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        summarized = _pick(pick_id=1)
        summarized.quarter_summaries_sent.add(2)
        pending = _pick(pick_id=2)
        game.picks = {1: summarized, 2: pending}
        engine.games["g1"] = game
        assert engine.get_quarter_picks("g1", 2) == [pending]

    def test_get_all_resolved_today_mixed(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        hit = _pick(pick_id=1)
        hit.is_hit = True
        unresolved = _pick(pick_id=2)
        game.picks = {1: hit, 2: unresolved}
        engine.games["g1"] = game
        resolved = engine.get_all_resolved_today()
        assert resolved == [hit]


class TestCheckGameAlertsDetails:
    def test_halftime_transition_skips_already_resolved_pick(self):
        engine = GameContextEngine()
        game = GameState(
            game_id="g1", home_team="A", away_team="B", status="live", prev_status="live"
        )
        resolved = _pick(pick_id=1)
        resolved.is_hit = True
        unresolved = _pick(pick_id=2)
        game.picks = {1: resolved, 2: unresolved}
        game.status = "halftime"
        game.prev_status = "live"

        alerts = engine._check_game_alerts(game)

        assert resolved.halftime_reported is False  # ctx.is_hit is not None -> skipped
        assert unresolved.halftime_reported is True
        assert AlertType.HALFTIME_REPORT in [a[0] for a in alerts]

    def test_garbage_time_alerts_leading_team_only_once(self):
        engine = GameContextEngine()
        game = GameState(
            game_id="g1", home_team="BOS", away_team="NYK", status="live", quarter=4, clock="3:00"
        )
        game.home_score, game.away_score = 120, 80  # abs_diff=40 >= BLOWOUT_SEVERE
        leading_unresolved = _pick(pick_id=1, team="BOS")
        leading_already_alerted = _pick(pick_id=2, team="BOS")
        leading_already_alerted.garbage_time_alerted = True
        leading_resolved = _pick(pick_id=3, team="BOS")
        leading_resolved.is_hit = True
        trailing = _pick(pick_id=4, team="NYK", opponent_team="BOS")
        game.picks = {
            1: leading_unresolved,
            2: leading_already_alerted,
            3: leading_resolved,
            4: trailing,
        }

        alerts = engine._check_game_alerts(game)
        gt_alerts = [a for a in alerts if a[0] == AlertType.GARBAGE_TIME]

        assert len(gt_alerts) == 1
        assert gt_alerts[0][2] is leading_unresolved
        assert leading_unresolved.garbage_time_alerted is True


class TestUpdateBoxScoreDetails:
    def test_unknown_game_returns_empty(self):
        engine = GameContextEngine()
        assert engine.update_box_score("nope", []) == []

    def test_empty_name_entry_is_not_indexed(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        ctx = _pick(pick_id=1, player_name="Jayson Tatum")
        game.picks = {1: ctx}
        engine.games["g1"] = game

        engine.update_box_score("g1", [{"name": ""}, {"name": "Jayson Tatum", "minutes": "10:00"}])
        assert ctx.box_score.minutes == 10.0

    def test_short_last_name_not_indexed_by_last_name(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        ctx = _pick(pick_id=1, player_name="Al Li")  # last name "li" is <=2 chars
        game.picks = {1: ctx}
        engine.games["g1"] = game

        # Exact full-name match still works even though the last-name index was skipped.
        engine.update_box_score("g1", [{"name": "Al Li", "minutes": "5:00"}])
        assert ctx.box_score.minutes == 5.0

    def test_resolved_pick_is_skipped(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        ctx = _pick(pick_id=1, player_name="Jayson Tatum")
        ctx.is_hit = True
        game.picks = {1: ctx}
        engine.games["g1"] = game

        engine.update_box_score("g1", [{"name": "Jayson Tatum", "minutes": "20:00"}])
        assert ctx.box_score.minutes == 0.0  # never touched

    def test_no_matching_player_data_is_skipped(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        ctx = _pick(pick_id=1, player_name="Jayson Tatum")
        game.picks = {1: ctx}
        engine.games["g1"] = game

        engine.update_box_score("g1", [{"name": "Someone Else", "minutes": "20:00"}])
        assert ctx.box_score.minutes == 0.0

    def test_plus_minus_parse_error_defaults_to_zero(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        ctx = _pick(pick_id=1, player_name="Jayson Tatum")
        game.picks = {1: ctx}
        engine.games["g1"] = game

        engine.update_box_score(
            "g1", [{"name": "Jayson Tatum", "minutes": "10:00", "plus_minus": "N/A"}]
        )
        assert ctx.box_score.plus_minus == 0

    def test_player_id_is_stored(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        ctx = _pick(pick_id=1, player_name="Jayson Tatum")
        game.picks = {1: ctx}
        engine.games["g1"] = game

        engine.update_box_score(
            "g1", [{"name": "Jayson Tatum", "minutes": "10:00", "player_id": 12345}]
        )
        assert ctx.player_api_id == "12345"


class TestUpdatePlaysDetails:
    def test_unknown_game_returns_empty(self):
        engine = GameContextEngine()
        assert engine.update_plays("nope", [{"sequence_number": 1}]) == []

    def test_duplicate_sequence_number_ignored(self):
        engine = GameContextEngine()
        engine.games["g1"] = GameState(game_id="g1", home_team="A", away_team="B")
        engine.update_plays("g1", [{"sequence_number": 1}])
        engine.update_plays("g1", [{"sequence_number": 1}])  # duplicate — ignored
        assert len(engine.games["g1"].recent_plays) == 1

    def test_recent_plays_truncated_to_30(self):
        engine = GameContextEngine()
        engine.games["g1"] = GameState(game_id="g1", home_team="A", away_team="B")
        plays = [{"sequence_number": i} for i in range(35)]
        engine.update_plays("g1", plays)
        assert len(engine.games["g1"].recent_plays) == 30


class TestUpdateSeasonStatsDetails:
    def test_unknown_game_is_a_noop(self):
        engine = GameContextEngine()
        engine.update_season_stats("nope", "Tatum", {"ppg": "20"})  # no raise

    def test_name_mismatch_skipped(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        ctx = _pick(pick_id=1, player_name="Jayson Tatum")
        game.picks = {1: ctx}
        engine.games["g1"] = game
        engine.update_season_stats("g1", "Someone Else", {"ppg": "20"})
        assert ctx.season_avg is None

    def test_unmapped_market_skipped(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        ctx = _pick(pick_id=1, player_name="Jayson Tatum", market="TURNOVERS")
        game.picks = {1: ctx}
        engine.games["g1"] = game
        engine.update_season_stats("g1", "Jayson Tatum", {"ppg": "20"})
        assert ctx.season_avg is None

    def test_stat_key_missing_from_stats_dict_skipped(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        ctx = _pick(pick_id=1, player_name="Jayson Tatum", market="POINTS")
        game.picks = {1: ctx}
        engine.games["g1"] = game
        engine.update_season_stats("g1", "Jayson Tatum", {"rpg": "10"})  # no "ppg"
        assert ctx.season_avg is None

    def test_invalid_stat_value_swallowed(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B")
        ctx = _pick(pick_id=1, player_name="Jayson Tatum", market="POINTS")
        game.picks = {1: ctx}
        engine.games["g1"] = game
        engine.update_season_stats("g1", "Jayson Tatum", {"ppg": "N/A"})
        assert ctx.season_avg is None


class TestCheckFoulTroubleEarlyExit:
    def test_already_alerted_returns_empty(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B", quarter=1)
        ctx = _pick(pick_id=1)
        ctx.foul_trouble_alerted = True
        ctx.box_score.fouls = 5
        assert engine._check_foul_trouble(game, ctx) == []

    def test_resolved_pick_returns_empty(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B", quarter=1)
        ctx = _pick(pick_id=1)
        ctx.is_hit = True
        ctx.box_score.fouls = 5
        assert engine._check_foul_trouble(game, ctx) == []


class TestCheckMomentumDetails:
    def test_non_matching_plays_dont_count_and_resolved_or_non_points_picks_skipped(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B", status="live")
        resolved = _pick(pick_id=1, player_name="Resolved Guy")
        resolved.is_hit = True
        non_points = _pick(pick_id=2, player_name="Rebound Guy", market="REBOUNDS")
        tracked = _pick(pick_id=3, player_name="Jayson Tatum", market="POINTS")
        game.picks = {1: resolved, 2: non_points, 3: tracked}
        engine.games["g1"] = game

        plays = [
            {"sequence_number": 1, "player_name": "Someone Else", "event_type": "shot"},
            {"sequence_number": 2, "player_name": "Jayson Tatum", "event_type": "rebound"},
            {"sequence_number": 3, "player_name": "Jayson Tatum", "event_type": "shot"},
            {"sequence_number": 4, "player_name": "Jayson Tatum", "event_type": "shot"},
            {"sequence_number": 5, "player_name": "Jayson Tatum", "event_type": "shot"},
        ]
        alerts = engine.update_plays("g1", plays)
        # Only 3 real scoring plays (seq 3,4,5) — below the 4-play scoring-run threshold.
        assert alerts == []
        assert tracked.scoring_run_alerted is False

    def test_drought_condition_not_met_without_enough_snapshots(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B", status="live")
        tracked = _pick(pick_id=1, player_name="Jayson Tatum", market="POINTS")
        game.picks = {1: tracked}
        engine.games["g1"] = game
        plays = [
            {"sequence_number": i, "player_name": "Nobody", "event_type": "noop"} for i in range(5)
        ]
        alerts = engine.update_plays("g1", plays)
        assert alerts == []
        assert tracked.drought_alerted is False

    def test_drought_detected_when_stat_unchanged(self):
        engine = GameContextEngine()
        game = GameState(
            game_id="g1", home_team="A", away_team="B", status="live", quarter=3, clock="0:00"
        )
        tracked = _pick(pick_id=1, player_name="Jayson Tatum", market="POINTS")
        for _ in range(3):
            tracked.snapshots.append(
                PlayerSnapshot(
                    timestamp=0,
                    actual_value=10.0,
                    game_minutes_elapsed=18,
                    quarter=3,
                    clock="0:00",
                    pace_projection=20.0,
                    score_diff=0,
                )
            )
        game.picks = {1: tracked}
        engine.games["g1"] = game
        plays = [
            {"sequence_number": i, "player_name": "Nobody", "event_type": "noop"} for i in range(5)
        ]

        alerts = engine.update_plays("g1", plays)

        assert AlertType.DROUGHT in [a[0] for a in alerts]
        assert tracked.drought_alerted is True

    def test_scoring_run_alert_appended_and_not_repeated(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B", status="live")
        tracked = _pick(pick_id=1, player_name="Jayson Tatum", market="POINTS")
        game.picks = {1: tracked}
        engine.games["g1"] = game

        plays = [
            {"sequence_number": i, "player_name": "Jayson Tatum", "event_type": "shot"}
            for i in range(5)
        ]
        alerts = engine.update_plays("g1", plays)
        assert AlertType.SCORING_RUN in [a[0] for a in alerts]
        assert tracked.scoring_run_alerted is True

        # A further batch must not re-fire the same alert.
        more_plays = [
            {"sequence_number": i, "player_name": "Jayson Tatum", "event_type": "shot"}
            for i in range(5, 10)
        ]
        alerts2 = engine.update_plays("g1", more_plays)
        assert AlertType.SCORING_RUN not in [a[0] for a in alerts2]

    def test_drought_not_fired_when_stat_value_changed(self):
        """recent snapshot values differ -> the `all(...)` check fails, so the
        loop moves on without appending DROUGHT (branch 772->734)."""
        engine = GameContextEngine()
        game = GameState(
            game_id="g1", home_team="A", away_team="B", status="live", quarter=3, clock="0:00"
        )
        tracked = _pick(pick_id=1, player_name="Jayson Tatum", market="POINTS")
        for value in (8.0, 9.0, 10.0):  # stat DID move between snapshots
            tracked.snapshots.append(
                PlayerSnapshot(
                    timestamp=0,
                    actual_value=value,
                    game_minutes_elapsed=18,
                    quarter=3,
                    clock="0:00",
                    pace_projection=20.0,
                    score_diff=0,
                )
            )
        game.picks = {1: tracked}
        engine.games["g1"] = game
        plays = [
            {"sequence_number": i, "player_name": "Nobody", "event_type": "noop"} for i in range(5)
        ]

        alerts = engine.update_plays("g1", plays)

        assert AlertType.DROUGHT not in [a[0] for a in alerts]
        assert tracked.drought_alerted is False


class TestCheckPaceAlertsDetails:
    def test_resolved_pick_returns_empty(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B", status="live")
        ctx = _pick(pick_id=1)
        ctx.is_hit = True
        assert engine._check_pace_alerts(game, ctx) == []

    def test_no_pace_returns_empty(self):
        engine = GameContextEngine()
        game = GameState(game_id="g1", home_team="A", away_team="B", status="live")
        ctx = _pick(pick_id=1)
        assert engine._check_pace_alerts(game, ctx) == []

    def test_pace_concern_fires_past_halftime(self):
        engine = GameContextEngine()
        game = GameState(
            game_id="g1", home_team="A", away_team="B", status="live", quarter=3, clock="0:00"
        )
        ctx = _pick_with_pace("OVER", 100, 50)  # comfort "buried"
        alerts = engine._check_pace_alerts(game, ctx)
        assert AlertType.PACE_CONCERN in [a[0] for a in alerts]
        assert ctx.pace_concern_alerted is True

    def test_on_track_comfort_skips_both_comfort_and_concern_alerts(self):
        engine = GameContextEngine()
        game = GameState(
            game_id="g1", home_team="A", away_team="B", status="live", quarter=3, clock="0:00"
        )
        ctx = _pick_with_pace("OVER", 100, 105)  # comfort "on_track" — neither bucket
        alerts = engine._check_pace_alerts(game, ctx)
        assert AlertType.PACE_COMFORT not in [a[0] for a in alerts]
        assert AlertType.PACE_CONCERN not in [a[0] for a in alerts]

    def test_line_cleared_early_over(self):
        engine = GameContextEngine()
        game = GameState(
            game_id="g1", home_team="A", away_team="B", status="live", quarter=2, clock="0:00"
        )
        ctx = _pick_with_pace("OVER", 26.5, 40)
        ctx.actual_value = 30.0  # already past the line, elapsed=24 < 40
        alerts = engine._check_pace_alerts(game, ctx)
        assert AlertType.LINE_CLEARED_EARLY in [a[0] for a in alerts]
        assert ctx.line_cleared_alerted is True

    def test_line_cleared_early_under_requires_late_game(self):
        engine = GameContextEngine()
        # quarter=4, clock="9:00" -> elapsed = 36 + (12-9) = 39: inside the outer
        # `elapsed < 40` guard AND satisfies the UNDER branch's `elapsed >= 36`.
        game = GameState(
            game_id="g1", home_team="A", away_team="B", status="live", quarter=4, clock="9:00"
        )
        ctx = _pick_with_pace("UNDER", 26.5, 30)  # pace close to line -> comfort not crushing
        ctx.actual_value = 20.0  # under the line
        alerts = engine._check_pace_alerts(game, ctx)
        assert AlertType.LINE_CLEARED_EARLY in [a[0] for a in alerts]
        assert ctx.line_cleared_alerted is True

    def test_already_line_cleared_alerted_skips_recheck(self):
        engine = GameContextEngine()
        game = GameState(
            game_id="g1", home_team="A", away_team="B", status="live", quarter=2, clock="0:00"
        )
        ctx = _pick_with_pace("OVER", 26.5, 40)
        ctx.actual_value = 30.0
        ctx.line_cleared_alerted = True
        alerts = engine._check_pace_alerts(game, ctx)
        assert AlertType.LINE_CLEARED_EARLY not in [a[0] for a in alerts]
