"""Characterization tests for game_log.py — JSONL game context recorder."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
import time_machine

sys.path.insert(0, str(Path(__file__).parent.parent))

from game_context import GameState, PickContext  # noqa: E402
from game_log import GameLogRecorder, _eastern_today  # noqa: E402


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


class TestEasternToday:
    def test_standard_time_matches_real_et(self):
        # January = EST (UTC-5) both for the hardcoded offset and real ET.
        frozen = datetime(2026, 1, 15, 4, 30, tzinfo=timezone.utc)
        with time_machine.travel(frozen):
            assert _eastern_today() == frozen.astimezone(ZoneInfo("America/New_York")).date()

    @pytest.mark.xfail(
        strict=True,
        reason=(
            "bug: _eastern_today hardcodes a fixed UTC-5 offset instead of "
            "ZoneInfo('America/New_York'). During EDT (UTC-4, roughly mid-March "
            "to early November) it returns the wrong calendar date for anything "
            "in the last hour before real ET midnight."
        ),
    )
    def test_daylight_time_currently_wrong(self):
        # July = EDT (UTC-4) in real ET, but the function always subtracts 5h.
        frozen = datetime(2026, 7, 15, 4, 30, tzinfo=timezone.utc)
        with time_machine.travel(frozen):
            assert _eastern_today() == frozen.astimezone(ZoneInfo("America/New_York")).date()


class TestRecordGameSnapshot:
    def test_writes_one_line_with_expected_keys(self, tmp_path):
        recorder = GameLogRecorder(log_dir=str(tmp_path))
        game = GameState(game_id="401", home_team="BOS", away_team="NYK")
        game.home_score, game.away_score, game.quarter, game.clock, game.status = (
            55,
            50,
            3,
            "6:00",
            "live",
        )
        pick = _mk_pick()
        pick.actual_value = 20.0
        game.picks = {1: pick}

        with time_machine.travel(datetime(2026, 1, 15, 20, 0, tzinfo=timezone.utc)):
            recorder.record_game_snapshot(game, "game_update")

        files = list(tmp_path.glob("*.jsonl"))
        assert len(files) == 1
        lines = files[0].read_text().splitlines()
        assert len(lines) == 1

        record = json.loads(lines[0])
        assert record["event"] == "game_update"
        assert record["game_id"] == "401"
        assert record["home_team"] == "BOS"
        assert record["away_team"] == "NYK"
        assert record["home_score"] == 55
        assert record["away_score"] == 50
        assert record["score_diff"] == 5
        assert record["status"] == "live"
        assert record["quarter"] == 3
        assert record["clock"] == "6:00"
        assert record["is_blowout"] is False
        assert record["is_garbage_time"] is False
        assert record["phase"] == "Q3"
        assert len(record["picks"]) == 1
        assert record["picks"][0]["pick_id"] == 1
        assert record["picks"][0]["player_name"] == "Jayson Tatum"

        recorder.close()


class TestRecordPickUpdate:
    def test_writes_one_line_with_expected_keys(self, tmp_path):
        recorder = GameLogRecorder(log_dir=str(tmp_path))
        game = GameState(game_id="401", home_team="BOS", away_team="NYK")
        game.home_score, game.away_score, game.quarter, game.clock, game.status = (
            55,
            50,
            3,
            "6:00",
            "live",
        )
        pick = _mk_pick()
        pick.actual_value = 20.0

        with time_machine.travel(datetime(2026, 1, 15, 20, 0, tzinfo=timezone.utc)):
            recorder.record_pick_update(game, pick, "PACE_COMFORT")

        files = list(tmp_path.glob("*.jsonl"))
        lines = files[0].read_text().splitlines()
        assert len(lines) == 1
        record = json.loads(lines[0])
        assert record["event"] == "PACE_COMFORT"
        assert record["game_id"] == "401"
        assert record["quarter"] == 3
        assert record["is_blowout"] is False
        assert record["pick"]["player_name"] == "Jayson Tatum"
        assert record["pick"]["actual_value"] == 20.0

        recorder.close()


class TestRotationAndClose:
    def test_rotates_when_et_date_changes(self, tmp_path):
        recorder = GameLogRecorder(log_dir=str(tmp_path))
        game = GameState(game_id="401", home_team="BOS", away_team="NYK")

        with time_machine.travel(datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)):
            recorder.record_game_snapshot(game, "day1")
            day1_handle = recorder._file_handle
            assert day1_handle is not None
            assert not day1_handle.closed

        with time_machine.travel(datetime(2026, 1, 16, 12, 0, tzinfo=timezone.utc)):
            recorder.record_game_snapshot(game, "day2")
            assert day1_handle.closed
            day2_handle = recorder._file_handle
            assert day2_handle is not day1_handle
            assert not day2_handle.closed

        files = sorted(tmp_path.glob("*.jsonl"))
        assert len(files) == 2

        recorder.close()

    def test_close_is_idempotent(self, tmp_path):
        recorder = GameLogRecorder(log_dir=str(tmp_path))
        game = GameState(game_id="401", home_team="BOS", away_team="NYK")
        recorder.record_game_snapshot(game, "ev")
        recorder.close()
        assert recorder._file_handle is None
        recorder.close()  # second call must not raise
        assert recorder._file_handle is None

    def test_write_after_close_same_day_is_a_noop(self, tmp_path):
        """After close(), _current_date is unchanged. A same-day _get_file() call
        then skips the rotation branch entirely and returns the (now-None)
        handle — _write's `if f:` guard swallows that silently."""
        recorder = GameLogRecorder(log_dir=str(tmp_path))
        game = GameState(game_id="401", home_team="BOS", away_team="NYK")

        with time_machine.travel(datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)):
            recorder.record_game_snapshot(game, "first")
            recorder.close()
            assert recorder._file_handle is None
            recorder.record_game_snapshot(game, "second")  # no-op, no raise
            assert recorder._file_handle is None

    def test_write_failure_is_swallowed(self, tmp_path, monkeypatch):
        """_write catches all exceptions and just logs — verify no raise."""
        recorder = GameLogRecorder(log_dir=str(tmp_path))

        def boom():
            raise OSError("disk full")

        monkeypatch.setattr(recorder, "_get_file", boom)
        game = GameState(game_id="401", home_team="BOS", away_team="NYK")
        recorder.record_game_snapshot(game, "ev")  # should not raise
