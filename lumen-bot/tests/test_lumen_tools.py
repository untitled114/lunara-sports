"""Characterization tests for lumen_tools.py — Claude tool_use handlers."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

import lumen_tools  # noqa: E402
from game_context import GameContextEngine, GameState, PickContext, PlayerSnapshot  # noqa: E402
from lumen_tools import (  # noqa: E402
    TOOLS,
    _find_pick_by_name,
    _format_game_header,
    handle_tool,
    init_tools,
)


@pytest.fixture(autouse=True)
def _reset_engine():
    """Module-level `_engine` is shared global state — start every test clean."""
    lumen_tools._engine = None
    yield
    lumen_tools._engine = None


def _mk_pick(**overrides) -> PickContext:
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


def _engine_with_game(**game_overrides) -> GameContextEngine:
    engine = GameContextEngine()
    defaults = dict(game_id="401", home_team="BOS", away_team="NYK")
    defaults.update(game_overrides)
    game = GameState(**defaults)
    engine.games["401"] = game
    return engine, game


class TestInitTools:
    def test_before_init_tools_engine_is_none_and_handler_reports_it(self):
        assert lumen_tools._engine is None
        assert handle_tool("get_active_picks", {}) == (
            "Engine not initialized — no game data available yet."
        )

    def test_init_tools_sets_module_engine(self):
        engine = GameContextEngine()
        init_tools(engine)
        assert lumen_tools._engine is engine


class TestHandleToolDispatch:
    def test_unknown_tool_name(self):
        init_tools(GameContextEngine())
        assert handle_tool("nonexistent_tool", {}) == "Unknown tool: nonexistent_tool"

    def test_error_path_wraps_exception(self):
        class BoomEngine:
            @property
            def games(self):
                raise RuntimeError("boom")

        init_tools(BoomEngine())
        assert handle_tool("get_game_status", {}) == "Tool error: boom"

    def test_tools_schema_names_match_handlers(self):
        names = {t["name"] for t in TOOLS}
        assert names == {
            "get_active_picks",
            "get_game_status",
            "get_pick_detail",
            "get_daily_recap",
            "get_player_box_score",
        }


class TestFormatGameHeader:
    def test_final(self):
        _, game = _engine_with_game(status="final", home_score=100, away_score=90)
        assert "FINAL" in _format_game_header(game)

    def test_halftime(self):
        _, game = _engine_with_game(status="halftime")
        assert "Halftime" in _format_game_header(game)

    def test_scheduled(self):
        _, game = _engine_with_game(status="scheduled")
        assert "Scheduled" in _format_game_header(game)

    def test_live_regulation_no_flags(self):
        _, game = _engine_with_game(status="live", quarter=2, clock="5:00")
        header = _format_game_header(game)
        assert "Q2 5:00" in header
        assert "[" not in header

    def test_live_overtime(self):
        _, game = _engine_with_game(status="live", quarter=5, clock="3:00")
        assert "OT1 3:00" in _format_game_header(game)

    def test_blowout_flag(self):
        _, game = _engine_with_game(
            status="live", quarter=3, clock="5:00", home_score=90, away_score=60
        )
        header = _format_game_header(game)
        assert "BLOWOUT" in header

    def test_garbage_time_flag(self):
        _, game = _engine_with_game(
            status="live", quarter=4, clock="3:00", home_score=100, away_score=60
        )
        header = _format_game_header(game)
        assert "GARBAGE TIME" in header
        # abs_diff=40 also satisfies is_blowout (>=20, quarter>=3) — both flags show.
        assert "BLOWOUT" in header


class TestHandleActivePicks:
    def test_no_games_tracked(self):
        init_tools(GameContextEngine())
        assert handle_tool("get_active_picks", {}) == "No games being tracked right now."

    def test_games_with_no_picks(self):
        engine, _ = _engine_with_game(status="live", quarter=1, clock="10:00")
        init_tools(engine)
        assert handle_tool("get_active_picks", {}) == "No picks being tracked."

    def test_active_pick_listed(self):
        engine, game = _engine_with_game(status="live", quarter=2, clock="5:00")
        pick = _mk_pick()
        pick.actual_value = 18.0
        game.picks = {1: pick}
        init_tools(engine)
        result = handle_tool("get_active_picks", {})
        assert "Tatum" in result

    def test_game_id_filter_excludes_other_games(self):
        engine, game = _engine_with_game(status="live", quarter=2, clock="5:00")
        pick = _mk_pick()
        game.picks = {1: pick}
        other = GameState(game_id="999", home_team="LAL", away_team="GSW")
        other.picks = {2: _mk_pick(pick_id=2, player_name="Other Player")}
        engine.games["999"] = other
        init_tools(engine)

        result = handle_tool("get_active_picks", {"game_id": "401"})
        assert "Tatum" in result
        assert "Other Player" not in result

    def test_resolved_pick_shows_result(self):
        engine, game = _engine_with_game(status="final")
        pick = _mk_pick()
        pick.is_hit = True
        pick.actual_value = 30.0
        game.picks = {1: pick}
        init_tools(engine)
        result = handle_tool("get_active_picks", {})
        assert "HIT" in result

    def test_pick_with_pace_and_extras(self):
        engine, game = _engine_with_game(status="live", quarter=2, clock="6:00")
        pick = _mk_pick()
        pick.actual_value = 18.0
        pick.season_avg = 27.4
        pick.box_score.minutes = 20.0
        pick.box_score.fouls = 3
        pick.box_score.fg_made, pick.box_score.fg_attempted = 7, 10
        pick.snapshots.append(
            PlayerSnapshot(
                timestamp=0,
                actual_value=18.0,
                game_minutes_elapsed=18.0,
                quarter=2,
                clock="6:00",
                pace_projection=32.0,
                score_diff=5,
            )
        )
        game.picks = {1: pick}
        init_tools(engine)
        result = handle_tool("get_active_picks", {})
        assert "pace 32" in result
        assert "avg:27.4" in result


class TestHandleGameStatus:
    def test_no_games(self):
        init_tools(GameContextEngine())
        assert handle_tool("get_game_status", {}) == "No games being tracked."

    def test_with_games(self):
        engine, game = _engine_with_game(status="live", quarter=2, clock="5:00")
        pick = _mk_pick()
        pick.is_hit = True
        game.picks = {1: pick}
        init_tools(engine)
        result = handle_tool("get_game_status", {})
        assert "1 picks (1 resolved)" in result


class TestFindPickByName:
    def test_exact_match(self):
        engine, game = _engine_with_game()
        game.picks = {1: _mk_pick(player_name="Jayson Tatum")}
        lumen_tools.init_tools(engine)
        found = _find_pick_by_name("Jayson Tatum")
        assert found is not None
        assert found[0].player_name == "Jayson Tatum"

    def test_partial_match(self):
        engine, game = _engine_with_game()
        game.picks = {1: _mk_pick(player_name="Jayson Tatum")}
        lumen_tools.init_tools(engine)
        found = _find_pick_by_name("tatum")
        assert found is not None

    def test_last_name_match(self):
        engine, game = _engine_with_game()
        game.picks = {1: _mk_pick(player_name="Jayson Tatum")}
        lumen_tools.init_tools(engine)
        found = _find_pick_by_name("Tatum")
        assert found is not None

    def test_no_match(self):
        engine, game = _engine_with_game()
        game.picks = {1: _mk_pick(player_name="Jayson Tatum")}
        lumen_tools.init_tools(engine)
        assert _find_pick_by_name("Nobody Here") is None


class TestHandlePickDetail:
    def test_no_match(self):
        init_tools(GameContextEngine())
        result = handle_tool("get_pick_detail", {"player_name": "Nobody"})
        assert "No pick found" in result

    def test_full_detail_with_pace_boxscore_and_snapshots(self):
        engine, game = _engine_with_game(status="live", quarter=2, clock="6:00")
        pick = _mk_pick()
        pick.actual_value = 18.0
        pick.season_avg = 27.4
        pick.box_score.minutes = 20.0
        pick.box_score.fouls = 2
        pick.box_score.fg_made, pick.box_score.fg_attempted = 7, 10
        pick.box_score.three_made, pick.box_score.three_attempted = 2, 4
        pick.box_score.ft_made, pick.box_score.ft_attempted = 3, 4
        pick.box_score.plus_minus = 5
        pick.box_score.starter = True
        pick.box_score.last_updated = 123.0
        pick.snapshots.append(
            PlayerSnapshot(
                timestamp=0,
                actual_value=18.0,
                game_minutes_elapsed=18.0,
                quarter=2,
                clock="6:00",
                pace_projection=32.0,
                score_diff=5,
            )
        )
        game.picks = {1: pick}
        init_tools(engine)

        result = handle_tool("get_pick_detail", {"player_name": "Tatum"})
        assert "Tatum" in result
        assert "Season average: 27.4" in result
        assert "Pace projection: 32" in result
        assert "FG: 7/10" in result
        assert "3PT: 2/4" in result
        assert "FT: 3/4" in result
        assert "Starter: Yes" in result
        assert "Pace History" in result

    def test_minimal_detail_no_pace_no_boxscore_no_snapshots(self):
        engine, game = _engine_with_game(status="live", quarter=1, clock="10:00")
        pick = _mk_pick()
        game.picks = {1: pick}
        init_tools(engine)

        result = handle_tool("get_pick_detail", {"player_name": "Tatum"})
        assert "Pace projection" not in result
        assert "Season average" not in result
        assert "Box Score" not in result
        assert "Pace History" not in result

    def test_boxscore_present_but_no_shots_attempted(self):
        """Box score section renders, but fg/3pt/ft lines are each skipped
        when their attempt count is 0."""
        engine, game = _engine_with_game(status="live", quarter=1, clock="10:00")
        pick = _mk_pick()
        pick.box_score.minutes = 5.0
        pick.box_score.last_updated = 100.0  # enters the box-score block
        game.picks = {1: pick}
        init_tools(engine)

        result = handle_tool("get_pick_detail", {"player_name": "Tatum"})
        assert "Box Score" in result
        assert "FG:" not in result
        assert "3PT:" not in result
        assert "FT:" not in result

    def test_final_result_shown(self):
        engine, game = _engine_with_game(status="final")
        pick = _mk_pick()
        pick.is_hit = False
        pick.actual_value = 20.0
        game.picks = {1: pick}
        init_tools(engine)
        result = handle_tool("get_pick_detail", {"player_name": "Tatum"})
        assert "MISS" in result


class TestHandleDailyRecap:
    def test_no_resolved_picks(self):
        init_tools(GameContextEngine())
        assert handle_tool("get_daily_recap", {}) == "No resolved picks yet today."

    def test_with_resolved_picks(self):
        engine, game = _engine_with_game(status="final")
        hit = _mk_pick(pick_id=1, player_name="Tatum")
        hit.is_hit = True
        hit.actual_value = 30.0
        miss = _mk_pick(pick_id=2, player_name="Brown")
        miss.is_hit = False
        miss.actual_value = 10.0
        game.picks = {1: hit, 2: miss}
        init_tools(engine)

        result = handle_tool("get_daily_recap", {})
        assert "1W - 1L" in result
        assert "[W]" in result
        assert "[L]" in result


class TestHandlePlayerBoxScore:
    def test_no_match(self):
        init_tools(GameContextEngine())
        result = handle_tool("get_player_box_score", {"player_name": "Nobody"})
        assert "No tracked player found" in result

    def test_match_but_no_boxscore_data_yet(self):
        engine, game = _engine_with_game()
        game.picks = {1: _mk_pick()}
        init_tools(engine)
        result = handle_tool("get_player_box_score", {"player_name": "Tatum"})
        assert "No box score data available yet" in result

    def test_full_box_score(self):
        engine, game = _engine_with_game()
        pick = _mk_pick()
        pick.box_score.minutes = 30.0
        pick.box_score.fouls = 1
        pick.box_score.fg_made, pick.box_score.fg_attempted = 8, 15
        pick.box_score.three_made, pick.box_score.three_attempted = 3, 6
        pick.box_score.ft_made, pick.box_score.ft_attempted = 2, 2
        pick.box_score.plus_minus = -4
        pick.box_score.starter = False
        pick.box_score.last_updated = 100.0
        game.picks = {1: pick}
        init_tools(engine)

        result = handle_tool("get_player_box_score", {"player_name": "Tatum"})
        assert "FG: 8/15" in result
        assert "3PT: 3/6" in result
        assert "FT: 2/2" in result
        assert "+/-: -4" in result
        assert "Starter: No" in result

    def test_box_score_no_shots_attempted(self):
        engine, game = _engine_with_game()
        pick = _mk_pick()
        pick.box_score.minutes = 2.0
        pick.box_score.last_updated = 100.0
        game.picks = {1: pick}
        init_tools(engine)

        result = handle_tool("get_player_box_score", {"player_name": "Tatum"})
        assert "FG:" not in result
        assert "3PT:" not in result
        assert "FT:" not in result
