"""Tests for the Intelligence Engine — Lumen's voice."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from game_context import AlertType, BoxScoreContext, GameState, PickContext, PlayerSnapshot
from intelligence import (
    generate_alert_message,
    generate_blowout_warning,
    generate_daily_recap,
    generate_drought,
    generate_foul_trouble,
    generate_halftime_report,
    generate_line_cleared_early,
    generate_pace_comfort,
    generate_pace_concern,
    generate_quarter_summary,
    generate_scoring_run,
)


def _game(
    home="DEN",
    away="LAL",
    hs=52,
    as_=45,
    status="halftime",
    quarter=2,
    clock="0:00",
) -> GameState:
    g = GameState(game_id="g1", home_team=home, away_team=away)
    g.home_score = hs
    g.away_score = as_
    g.status = status
    g.quarter = quarter
    g.clock = clock
    return g


def _pick(
    name="Nikola Jokic",
    team="DEN",
    market="POINTS",
    line=26.5,
    prediction="OVER",
    actual=18.0,
    pace=36.0,
) -> PickContext:
    ctx = PickContext(
        pick_id=1,
        player_name=name,
        team=team,
        opponent_team="LAL",
        market=market,
        line=line,
        prediction=prediction,
        tier="X",
        model_version="v3",
        book="DraftKings",
        is_home=True,
        actual_value=actual,
    )
    if pace is not None:
        ctx.snapshots.append(
            PlayerSnapshot(
                timestamp=0,
                actual_value=actual,
                game_minutes_elapsed=24,
                quarter=2,
                clock="0:00",
                pace_projection=pace,
                score_diff=7,
            )
        )
    return ctx


class TestHalftimeReport:
    def test_basic(self):
        game = _game()
        pick = _pick()
        game.picks[1] = pick
        report = generate_halftime_report(game)
        assert "HALFTIME REPORT" in report
        assert "Jokic" in report
        assert "pace" in report.lower()
        assert "36" in report

    def test_includes_blowout_warning(self):
        game = _game(hs=65, as_=45)
        pick = _pick()
        game.picks[1] = pick
        report = generate_halftime_report(game)
        assert "reduced minutes" in report.lower()

    def test_empty_picks(self):
        game = _game()
        report = generate_halftime_report(game)
        assert report == ""


class TestBlowoutWarning:
    def test_over_pick_leading_team(self):
        game = _game(hs=95, as_=70, status="live", quarter=3, clock="6:00")
        pick = _pick(actual=20.0, pace=32.0)
        msg = generate_blowout_warning(game, pick)
        assert "BLOWOUT" in msg
        assert "Jokic" in msg
        assert "starters may sit" in msg.lower()
        assert "OVER" in msg

    def test_under_pick_leading_team(self):
        game = _game(hs=95, as_=70, status="live", quarter=3, clock="6:00")
        pick = _pick(prediction="UNDER", actual=20.0, pace=32.0)
        msg = generate_blowout_warning(game, pick)
        assert "good news" in msg.lower()


class TestPaceComfort:
    def test_over_comfortable(self):
        game = _game(status="live", quarter=2, clock="6:00")
        pick = _pick(actual=18.0, pace=36.0)
        msg = generate_pace_comfort(game, pick)
        assert "comfortable" in msg.lower()
        assert "18" in msg
        assert "36" in msg

    def test_under_comfortable(self):
        game = _game(status="live", quarter=2, clock="6:00")
        pick = _pick(prediction="UNDER", line=30.0, actual=10.0, pace=20.0)
        msg = generate_pace_comfort(game, pick)
        assert "pretty" in msg.lower()


class TestPaceConcern:
    def test_over_behind(self):
        game = _game(status="live", quarter=3, clock="6:00")
        pick = _pick(actual=10.0, pace=16.0)
        msg = generate_pace_concern(game, pick)
        assert "only" in msg.lower()
        assert "needs" in msg.lower()

    def test_under_in_trouble(self):
        game = _game(status="live", quarter=3, clock="6:00")
        pick = _pick(prediction="UNDER", line=20.0, actual=18.0, pace=28.0)
        msg = generate_pace_concern(game, pick)
        assert "trouble" in msg.lower()


class TestLineClearedEarly:
    def test_over_cleared(self):
        game = _game(status="live", quarter=3, clock="6:00")
        pick = _pick(line=26.5, actual=28.0, pace=45.0)
        msg = generate_line_cleared_early(game, pick)
        assert "EARLY CLEAR" in msg
        assert "28" in msg
        assert "26.5" in msg

    def test_under_safe(self):
        game = _game(status="live", quarter=4, clock="2:00")
        pick = _pick(prediction="UNDER", line=26.5, actual=20.0, pace=21.0)
        msg = generate_line_cleared_early(game, pick)
        assert "UNDER LOOKING SAFE" in msg


class TestQuarterSummary:
    def test_basic(self):
        game = _game(status="live", quarter=2, clock="12:00")
        pick = _pick(actual=12.0, pace=24.0)
        game.picks[1] = pick
        msg = generate_quarter_summary(game, 1)
        assert "End of Q1" in msg
        assert "Jokic" in msg


class TestFoulTrouble:
    def test_over_foul_trouble(self):
        game = _game(status="live", quarter=2, clock="6:00")
        pick = _pick(actual=12.0, pace=24.0)
        pick.box_score = BoxScoreContext(minutes=14.0, fouls=4, fg_made=5, fg_attempted=10)
        msg = generate_foul_trouble(game, pick)
        assert "FOUL TROUBLE" in msg
        assert "4 fouls" in msg
        assert "OVER" in msg
        assert "14 min" in msg

    def test_under_foul_trouble(self):
        game = _game(status="live", quarter=3, clock="8:00")
        pick = _pick(prediction="UNDER", line=30.0, actual=20.0, pace=28.0)
        pick.box_score = BoxScoreContext(minutes=22.0, fouls=5)
        msg = generate_foul_trouble(game, pick)
        assert "UNDER" in msg
        assert "help" in msg.lower()


class TestScoringRun:
    def test_basic(self):
        game = _game(status="live", quarter=3, clock="6:00")
        pick = _pick(actual=24.0, pace=38.0)
        pick.box_score = BoxScoreContext(fg_made=10, fg_attempted=15)
        msg = generate_scoring_run(game, pick)
        assert "HEATING UP" in msg
        assert "24" in msg
        assert "10/15" in msg

    def test_no_shooting_data(self):
        game = _game(status="live", quarter=2, clock="3:00")
        pick = _pick(actual=16.0, pace=32.0)
        msg = generate_scoring_run(game, pick)
        assert "HEATING UP" in msg


class TestDrought:
    def test_over_drought(self):
        game = _game(status="live", quarter=3, clock="4:00")
        pick = _pick(actual=12.0, pace=18.0)
        msg = generate_drought(game, pick)
        assert "DROUGHT" in msg
        assert "stuck at" in msg.lower()
        assert "OVER" in msg

    def test_under_drought(self):
        game = _game(status="live", quarter=3, clock="4:00")
        pick = _pick(prediction="UNDER", line=25.0, actual=10.0, pace=16.0)
        msg = generate_drought(game, pick)
        assert "UNDER" in msg
        assert "Good news" in msg


class TestHalftimeWithBoxScore:
    def test_includes_minutes_and_shooting(self):
        game = _game()
        pick = _pick()
        pick.box_score = BoxScoreContext(minutes=18.0, fg_made=7, fg_attempted=12, fouls=3)
        game.picks[1] = pick
        report = generate_halftime_report(game)
        assert "18 min" in report
        assert "7/12" in report
        assert "3 fouls" in report

    def test_includes_season_avg(self):
        game = _game()
        pick = _pick()
        pick.season_avg = 26.3
        game.picks[1] = pick
        report = generate_halftime_report(game)
        assert "26.3" in report


class TestPaceComfortWithContext:
    def test_includes_box_score_context(self):
        game = _game(status="live", quarter=2, clock="6:00")
        pick = _pick(actual=18.0, pace=36.0)
        pick.box_score = BoxScoreContext(minutes=16.0, fg_made=7, fg_attempted=11)
        pick.season_avg = 26.5
        msg = generate_pace_comfort(game, pick)
        assert "16 min" in msg
        assert "7/11" in msg
        assert "26.5" in msg


class TestDailyRecap:
    def test_recap(self):
        picks = [
            _pick(name="Jokic", actual=30.0, pace=30.0),
            _pick(name="LeBron", actual=20.0, pace=20.0),
        ]
        picks[0].is_hit = True
        picks[1].is_hit = False
        msg = generate_daily_recap(picks)
        assert "1W - 1L" in msg
        assert "50%" in msg

    def test_empty(self):
        msg = generate_daily_recap([])
        assert msg == ""


class TestAlertRouter:
    def test_halftime(self):
        game = _game()
        pick = _pick()
        game.picks[1] = pick
        msg = generate_alert_message(AlertType.HALFTIME_REPORT, game)
        assert msg is not None
        assert "HALFTIME" in msg

    def test_blowout(self):
        game = _game(hs=95, as_=70, status="live", quarter=3, clock="6:00")
        pick = _pick()
        msg = generate_alert_message(AlertType.BLOWOUT_WARNING, game, pick)
        assert msg is not None

    def test_pace_comfort(self):
        game = _game(status="live", quarter=2, clock="6:00")
        pick = _pick()
        msg = generate_alert_message(AlertType.PACE_COMFORT, game, pick)
        assert msg is not None

    def test_none_on_no_ctx(self):
        game = _game()
        msg = generate_alert_message(AlertType.BLOWOUT_WARNING, game, None)
        assert msg is None

    def test_foul_trouble_route(self):
        game = _game(status="live", quarter=2, clock="6:00")
        pick = _pick()
        pick.box_score = BoxScoreContext(fouls=4)
        msg = generate_alert_message(AlertType.FOUL_TROUBLE, game, pick)
        assert msg is not None
        assert "FOUL" in msg

    def test_scoring_run_route(self):
        game = _game(status="live", quarter=3, clock="5:00")
        pick = _pick()
        msg = generate_alert_message(AlertType.SCORING_RUN, game, pick)
        assert msg is not None

    def test_drought_route(self):
        game = _game(status="live", quarter=3, clock="4:00")
        pick = _pick()
        msg = generate_alert_message(AlertType.DROUGHT, game, pick)
        assert msg is not None
