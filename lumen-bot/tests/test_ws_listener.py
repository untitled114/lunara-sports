"""Characterization tests for ws_listener.py — the real-time WS/poll engine.

All HTTP is stubbed with respx; all websocket connections are stubbed with a
small async-iterator fake (no real sockets, no real sleeping).
"""

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
import respx
import websockets

sys.path.insert(0, str(Path(__file__).parent.parent))

import ws_listener  # noqa: E402
from formatter import PickFormatter  # noqa: E402
from game_context import AlertType, GameState, PickContext  # noqa: E402
from ws_listener import WS_RETRY_DELAY, WSListener  # noqa: E402

API_URL = "http://127.0.0.1:8010"
WS_URL = "ws://127.0.0.1:8010/ws"


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


@pytest.fixture
def listener():
    return WSListener(
        api_url=API_URL,
        ws_url=WS_URL,
        alert_cfg={},
        send_dm=AsyncMock(),
        formatter=PickFormatter(),
    )


@pytest.fixture(autouse=True)
async def _cleanup_leftover_tasks():
    """Safety net: cancel any asyncio.Task a test spun up but didn't clean up,
    so pending-task warnings never leak across tests."""
    yield
    current = asyncio.current_task()
    leftovers = [t for t in asyncio.all_tasks() if t is not current and not t.done()]
    for t in leftovers:
        t.cancel()
    if leftovers:
        await asyncio.gather(*leftovers, return_exceptions=True)


def _stop_after(obj, n=1, attr="_running"):
    """Fake asyncio.sleep that records each call and flips `obj.<attr>` False
    once it's been called `n` times — lets a `while self._running:` loop run
    exactly `n` passes without any real waiting."""
    calls = []

    async def _sleep(seconds):
        calls.append(seconds)
        if len(calls) >= n:
            setattr(obj, attr, False)

    _sleep.calls = calls
    return _sleep


class FakeWSConn:
    """Async-iterator fake standing in for an open websocket connection."""

    def __init__(self, items):
        self._items = list(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._items:
            raise StopAsyncIteration
        item = self._items.pop(0)
        if isinstance(item, BaseException):
            raise item
        return item


class FakeConnectCtx:
    """Async context manager standing in for `websockets.connect(url)`."""

    def __init__(self, items):
        self._items = items

    async def __aenter__(self):
        return FakeWSConn(self._items)

    async def __aexit__(self, exc_type, exc, tb):
        return False


# ---------------------------------------------------------------------------
# _fetch_picks
# ---------------------------------------------------------------------------


class TestFetchPicks:
    async def test_success_dict_wrapper(self, listener):
        with respx.mock:
            respx.get(f"{API_URL}/picks/today").mock(
                return_value=httpx.Response(200, json={"picks": [{"id": 1}]})
            )
            result = await listener._fetch_picks()
        assert result == [{"id": 1}]

    async def test_success_raw_list(self, listener):
        with respx.mock:
            respx.get(f"{API_URL}/picks/today").mock(
                return_value=httpx.Response(200, json=[{"id": 2}])
            )
            result = await listener._fetch_picks()
        assert result == [{"id": 2}]

    async def test_non_200_returns_none(self, listener):
        with respx.mock:
            respx.get(f"{API_URL}/picks/today").mock(return_value=httpx.Response(503))
            result = await listener._fetch_picks()
        assert result is None

    async def test_exception_returns_none(self, listener):
        with respx.mock:
            respx.get(f"{API_URL}/picks/today").mock(side_effect=httpx.ConnectError("down"))
            result = await listener._fetch_picks()
        assert result is None


# ---------------------------------------------------------------------------
# _poll_and_subscribe
# ---------------------------------------------------------------------------


class TestPollAndSubscribe:
    async def test_returns_early_when_fetch_fails(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_fetch_picks", AsyncMock(return_value=None))
        monkeypatch.setattr(listener, "_check_daily_recap", AsyncMock())
        await listener._poll_and_subscribe()
        assert listener._all_picks == []
        listener._check_daily_recap.assert_not_awaited()

    async def test_starts_one_task_per_new_game(self, listener, monkeypatch):
        async def never_ending(game_id):
            await asyncio.sleep(3600)

        monkeypatch.setattr(listener, "_listen_game", never_ending)
        monkeypatch.setattr(listener, "_fetch_season_stats_for_picks", AsyncMock())
        monkeypatch.setattr(listener, "_check_daily_recap", AsyncMock())
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())

        picks = [
            {
                "id": 1,
                "game_id": "401",
                "is_hit": None,
                "home_team": "BOS",
                "away_team": "NYK",
                "player_name": "A",
            },
            {
                "id": 2,
                "game_id": "402",
                "is_hit": None,
                "home_team": "LAL",
                "away_team": "GSW",
                "player_name": "B",
            },
        ]
        monkeypatch.setattr(listener, "_fetch_picks", AsyncMock(return_value=picks))

        await listener._poll_and_subscribe()

        assert set(listener._game_tasks.keys()) == {"401", "402"}
        assert listener._summary_sent is True
        listener._queue_dm.assert_awaited_once()

    async def test_known_running_game_is_not_restarted(self, listener, monkeypatch):
        async def never_ending(game_id):
            await asyncio.sleep(3600)

        monkeypatch.setattr(listener, "_listen_game", never_ending)
        monkeypatch.setattr(listener, "_fetch_season_stats_for_picks", AsyncMock())
        monkeypatch.setattr(listener, "_check_daily_recap", AsyncMock())
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())

        pick = {
            "id": 1,
            "game_id": "401",
            "is_hit": None,
            "home_team": "BOS",
            "away_team": "NYK",
            "player_name": "A",
        }
        monkeypatch.setattr(listener, "_fetch_picks", AsyncMock(return_value=[pick]))

        await listener._poll_and_subscribe()
        first_task = listener._game_tasks["401"]

        await listener._poll_and_subscribe()  # second poll, same still-pending game
        assert listener._game_tasks["401"] is first_task  # not replaced

    async def test_cleans_up_finished_games(self, listener, monkeypatch):
        async def never_ending(game_id):
            await asyncio.sleep(3600)

        monkeypatch.setattr(listener, "_listen_game", never_ending)
        monkeypatch.setattr(listener, "_fetch_season_stats_for_picks", AsyncMock())
        monkeypatch.setattr(listener, "_check_daily_recap", AsyncMock())
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())

        listener._game_tasks["999"] = asyncio.create_task(never_ending("999"))

        pick = {
            "id": 1,
            "game_id": "401",
            "is_hit": None,
            "home_team": "BOS",
            "away_team": "NYK",
            "player_name": "A",
        }
        monkeypatch.setattr(listener, "_fetch_picks", AsyncMock(return_value=[pick]))

        await listener._poll_and_subscribe()

        assert "999" not in listener._game_tasks
        assert "401" in listener._game_tasks

    async def test_no_summary_when_no_picks(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_fetch_picks", AsyncMock(return_value=[]))
        monkeypatch.setattr(listener, "_check_daily_recap", AsyncMock())
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())

        await listener._poll_and_subscribe()

        assert listener._summary_sent is False
        listener._queue_dm.assert_not_awaited()


# ---------------------------------------------------------------------------
# _listen_game
# ---------------------------------------------------------------------------


class TestListenGame:
    async def test_routes_every_message_type(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_handle_pick_updates", AsyncMock())
        monkeypatch.setattr(listener, "_handle_game_update", AsyncMock())
        monkeypatch.setattr(listener, "_handle_play", AsyncMock())
        monkeypatch.setattr(listener, "_handle_play_batch", AsyncMock())

        messages = [
            json.dumps({"type": "history", "data": [{"a": 1}]}),
            json.dumps({"type": "history", "data": []}),  # empty -> batch not called again
            json.dumps({"type": "play", "data": {"x": 1}}),
            json.dumps({"type": "game_update", "data": {"id": "401"}}),
            json.dumps({"type": "pick_update", "data": {"picks": [{"id": 1}]}}),
            json.dumps({"type": "something_else"}),
            "not valid json {{{",  # JSONDecodeError -> continue
            json.dumps({"type": "pick_update", "data": {}}),  # KeyError on ["picks"]
        ]
        monkeypatch.setattr(
            ws_listener.websockets, "connect", lambda url: FakeConnectCtx(list(messages))
        )
        monkeypatch.setattr(ws_listener.asyncio, "sleep", _stop_after(listener))

        await listener._listen_game("401")

        listener._handle_play_batch.assert_awaited_once_with("401", [{"a": 1}])
        listener._handle_play.assert_awaited_once_with("401", {"x": 1})
        listener._handle_game_update.assert_awaited_once_with({"id": "401"})
        listener._handle_pick_updates.assert_awaited_once_with([{"id": 1}])

    async def test_reconnects_after_connection_closed(self, listener, monkeypatch):
        items = [websockets.ConnectionClosed(None, None)]
        monkeypatch.setattr(
            ws_listener.websockets, "connect", lambda url: FakeConnectCtx(list(items))
        )
        sleep_stub = _stop_after(listener)
        monkeypatch.setattr(ws_listener.asyncio, "sleep", sleep_stub)

        await listener._listen_game("401")

        assert sleep_stub.calls == [WS_RETRY_DELAY]

    async def test_reconnects_after_generic_exception(self, listener, monkeypatch):
        items = [RuntimeError("socket exploded")]
        monkeypatch.setattr(
            ws_listener.websockets, "connect", lambda url: FakeConnectCtx(list(items))
        )
        sleep_stub = _stop_after(listener)
        monkeypatch.setattr(ws_listener.asyncio, "sleep", sleep_stub)

        await listener._listen_game("401")  # must not raise

        assert sleep_stub.calls == [WS_RETRY_DELAY]


# ---------------------------------------------------------------------------
# _listen_scoreboard
# ---------------------------------------------------------------------------


class TestListenScoreboard:
    async def test_routes_scoreboard_updates(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_handle_game_update", AsyncMock())
        messages = [
            json.dumps({"type": "scoreboard_update", "data": [{"id": "1"}, {"id": "2"}]}),
            json.dumps({"type": "other"}),
            "bad json {{",
        ]
        monkeypatch.setattr(
            ws_listener.websockets, "connect", lambda url: FakeConnectCtx(list(messages))
        )
        monkeypatch.setattr(ws_listener.asyncio, "sleep", _stop_after(listener))

        await listener._listen_scoreboard()

        assert listener._handle_game_update.await_count == 2

    async def test_reconnects_after_connection_closed(self, listener, monkeypatch):
        items = [websockets.ConnectionClosed(None, None)]
        monkeypatch.setattr(
            ws_listener.websockets, "connect", lambda url: FakeConnectCtx(list(items))
        )
        sleep_stub = _stop_after(listener)
        monkeypatch.setattr(ws_listener.asyncio, "sleep", sleep_stub)

        await listener._listen_scoreboard()

        assert sleep_stub.calls == [WS_RETRY_DELAY]

    async def test_reconnects_after_generic_exception(self, listener, monkeypatch):
        items = [RuntimeError("boom")]
        monkeypatch.setattr(
            ws_listener.websockets, "connect", lambda url: FakeConnectCtx(list(items))
        )
        sleep_stub = _stop_after(listener)
        monkeypatch.setattr(ws_listener.asyncio, "sleep", sleep_stub)

        await listener._listen_scoreboard()

        assert sleep_stub.calls == [WS_RETRY_DELAY]


# ---------------------------------------------------------------------------
# _handle_game_update / _handle_play / _handle_play_batch
# ---------------------------------------------------------------------------


class TestHandleGameUpdate:
    async def test_logs_snapshot_for_live_status_and_dispatches_alerts(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_send_copilot_alert", AsyncMock())
        logged = []
        monkeypatch.setattr(
            listener.game_log,
            "record_game_snapshot",
            lambda g, e: logged.append((g.game_id, e)),
        )

        # First update establishes quarter=1/live.
        await listener._handle_game_update(
            {
                "id": "401",
                "home_team": "BOS",
                "away_team": "NYK",
                "home_score": 10,
                "away_score": 8,
                "status": "live",
                "quarter": 1,
                "clock": "10:00",
            }
        )
        # Second update transitions to halftime -> triggers HALFTIME_REPORT alert.
        await listener._handle_game_update(
            {
                "id": "401",
                "home_score": 40,
                "away_score": 35,
                "status": "halftime",
                "quarter": 2,
                "clock": "0:00",
            }
        )

        assert logged == [("401", "game_update"), ("401", "game_update")]
        alert_types = [c.args[0] for c in listener._send_copilot_alert.await_args_list]
        assert AlertType.HALFTIME_REPORT in alert_types

    async def test_scheduled_status_skips_log(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_send_copilot_alert", AsyncMock())
        logged = []
        monkeypatch.setattr(
            listener.game_log, "record_game_snapshot", lambda g, e: logged.append(1)
        )
        await listener._handle_game_update(
            {"id": "401", "status": "scheduled", "home_team": "BOS", "away_team": "NYK"}
        )
        assert logged == []

    async def test_missing_game_id_no_log_lookup(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_send_copilot_alert", AsyncMock())
        # data has no "id" -> engine.update_game returns [] early, game lookup skipped
        await listener._handle_game_update({"status": "live"})
        listener._send_copilot_alert.assert_not_awaited()


class TestHandlePlay:
    async def test_updates_recent_plays_when_game_known(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_send_copilot_alert", AsyncMock())
        listener.engine.games["401"] = GameState(game_id="401", home_team="BOS", away_team="NYK")
        await listener._handle_play("401", {"sequence_number": 1, "event_type": "shot"})
        assert len(listener.engine.games["401"].recent_plays) == 1

    async def test_unknown_game_is_a_noop(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_send_copilot_alert", AsyncMock())
        await listener._handle_play("nope", {"sequence_number": 1})
        listener._send_copilot_alert.assert_not_awaited()

    async def test_scoring_run_alert_dispatched(self, listener, monkeypatch):
        """5 scoring plays for the same tracked POINTS player trips the
        _check_momentum scoring-run detector, which _handle_play forwards."""
        monkeypatch.setattr(listener, "_send_copilot_alert", AsyncMock())
        game = GameState(game_id="401", home_team="BOS", away_team="NYK")
        game.picks = {1: _mk_pick()}
        listener.engine.games["401"] = game

        for i in range(5):
            await listener._handle_play(
                "401",
                {
                    "sequence_number": i,
                    "player_name": "Jayson Tatum",
                    "event_type": "shot",
                    "description": "Tatum makes 2-pt shot",
                },
            )

        alert_types = [c.args[0] for c in listener._send_copilot_alert.await_args_list]
        assert AlertType.SCORING_RUN in alert_types


class TestHandlePlayBatch:
    async def test_seeds_recent_plays_without_alerts(self, listener):
        listener.engine.games["401"] = GameState(game_id="401", home_team="BOS", away_team="NYK")
        plays = [{"sequence_number": i} for i in range(35)]
        await listener._handle_play_batch("401", plays)
        game = listener.engine.games["401"]
        assert len(game.recent_plays) == 30  # truncated to last 30
        assert len(game._play_sequences_seen) == 35

    async def test_unknown_game_is_a_noop(self, listener):
        await listener._handle_play_batch("nope", [{"sequence_number": 1}])  # no raise


# ---------------------------------------------------------------------------
# _handle_pick_updates
# ---------------------------------------------------------------------------


class TestHandlePickUpdates:
    async def test_skips_missing_id_and_missing_line(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        await listener._handle_pick_updates(
            [
                {"actual_value": 5, "line": 10},  # no "id"
                {"id": 1, "actual_value": 5, "line": 0},  # line <= 0
                {"id": 2, "actual_value": 5, "line": None},  # falsy line
            ]
        )
        listener._queue_dm.assert_not_awaited()

    async def test_approaching_alert_fires_once(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        pick = {
            "id": 1,
            "actual_value": 25.0,
            "line": 26.5,
            "prediction": "OVER",
            "player_name": "Tatum",
            "market": "POINTS",
            "is_hit": None,
        }
        await listener._handle_pick_updates([pick])
        state = listener._pick_states[1]
        assert state.approach_alerted is True
        listener._queue_dm.assert_awaited_once()

        # Second call at same value must not re-alert.
        await listener._handle_pick_updates([pick])
        assert listener._queue_dm.await_count == 1

    async def test_approaching_disabled_by_config(self, listener, monkeypatch):
        listener.alert_cfg = {"approaching_line": False}
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        pick = {
            "id": 1,
            "actual_value": 25.0,
            "line": 26.5,
            "prediction": "OVER",
            "player_name": "Tatum",
            "market": "POINTS",
            "is_hit": None,
        }
        await listener._handle_pick_updates([pick])
        listener._queue_dm.assert_not_awaited()
        assert listener._pick_states[1].approach_alerted is False

    async def test_approaching_skipped_when_actual_unchanged(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        listener.alert_cfg = {"approaching_line": False}
        pick = {
            "id": 1,
            "actual_value": 9.0,
            "line": 10.0,
            "prediction": "OVER",
            "player_name": "X",
            "market": "POINTS",
            "is_hit": None,
        }
        await listener._handle_pick_updates([pick])  # config disabled: sets last_actual, no alert
        state = listener._pick_states[1]
        assert state.approach_alerted is False
        assert state.last_actual == 9.0

        listener.alert_cfg = {"approaching_line": True}
        await listener._handle_pick_updates([pick])  # same actual as last_actual -> still skipped
        listener._queue_dm.assert_not_awaited()
        assert state.approach_alerted is False

    async def test_mid_game_hit_over(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        pick = {
            "id": 1,
            "actual_value": 27.0,
            "line": 26.5,
            "prediction": "OVER",
            "player_name": "Tatum",
            "market": "POINTS",
            "is_hit": None,
        }
        await listener._handle_pick_updates([pick])
        state = listener._pick_states[1]
        assert state.mid_game_hit_alerted is True
        assert state.approach_alerted is True
        listener._queue_dm.assert_awaited_once()

    async def test_mid_game_hit_under(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        pick = {
            "id": 1,
            "actual_value": 3.0,
            "line": 4.5,
            "prediction": "UNDER",
            "player_name": "Brown",
            "market": "ASSISTS",
            "is_hit": None,
        }
        await listener._handle_pick_updates([pick])
        assert listener._pick_states[1].mid_game_hit_alerted is True

    async def test_final_hit(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        listener.alert_cfg = {"hit_miss": True}
        pick = {
            "id": 1,
            "actual_value": 30.0,
            "line": 26.5,
            "prediction": "OVER",
            "player_name": "Tatum",
            "market": "POINTS",
            "is_hit": True,
        }
        await listener._handle_pick_updates([pick])
        state = listener._pick_states[1]
        assert state.is_hit is True
        listener._queue_dm.assert_awaited_once()

    async def test_final_miss(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        pick = {
            "id": 1,
            "actual_value": 10.0,
            "line": 26.5,
            "prediction": "OVER",
            "player_name": "Tatum",
            "market": "POINTS",
            "is_hit": False,
        }
        await listener._handle_pick_updates([pick])
        assert listener._pick_states[1].is_hit is False
        listener._queue_dm.assert_awaited_once()

    async def test_hit_miss_disabled_by_config_still_records_state(self, listener, monkeypatch):
        listener.alert_cfg = {"hit_miss": False}
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        pick = {
            "id": 1,
            "actual_value": 30.0,
            "line": 26.5,
            "prediction": "OVER",
            "player_name": "Tatum",
            "market": "POINTS",
            "is_hit": True,
        }
        await listener._handle_pick_updates([pick])
        assert listener._pick_states[1].is_hit is True
        listener._queue_dm.assert_not_awaited()

    async def test_duplicate_final_result_suppressed(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        pick = {
            "id": 1,
            "actual_value": 30.0,
            "line": 26.5,
            "prediction": "OVER",
            "player_name": "Tatum",
            "market": "POINTS",
            "is_hit": True,
        }
        await listener._handle_pick_updates([pick])
        await listener._handle_pick_updates([pick])  # duplicate must not re-send
        assert listener._queue_dm.await_count == 1

    async def test_engine_alert_path_dispatches_and_logs(self, listener, monkeypatch):
        """When the context engine itself raises an alert (e.g. PACE_COMFORT),
        _handle_pick_updates must forward it through _send_copilot_alert and
        record it via game_log — separate from the legacy PickState alerts."""
        monkeypatch.setattr(listener, "_send_copilot_alert", AsyncMock())
        logged = []
        monkeypatch.setattr(
            listener.game_log,
            "record_pick_update",
            lambda game, ctx, name: logged.append(name),
        )

        listener.engine.register_picks(
            [
                {
                    "id": 1,
                    "game_id": "401",
                    "home_team": "BOS",
                    "away_team": "NYK",
                    "player_name": "Jayson Tatum",
                    "team": "BOS",
                    "opponent_team": "NYK",
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
        listener.engine.games["401"].status = "live"
        listener.engine.games["401"].quarter = 3
        listener.engine.games["401"].clock = "0:00"  # elapsed = 36 min

        pick = {"id": 1, "game_id": "401", "actual_value": 40.0, "is_hit": None, "line": 26.5}
        await listener._handle_pick_updates([pick])

        listener._send_copilot_alert.assert_awaited()
        assert "PACE_COMFORT" in logged

    async def test_new_pick_state_created_when_missing(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        assert 42 not in listener._pick_states
        pick = {
            "id": 42,
            "actual_value": 1.0,
            "line": 26.5,
            "prediction": "OVER",
            "player_name": "New Guy",
            "market": "POINTS",
            "is_hit": None,
        }
        await listener._handle_pick_updates([pick])
        assert 42 in listener._pick_states


# ---------------------------------------------------------------------------
# _poll_box_scores
# ---------------------------------------------------------------------------


class TestPollBoxScoresLoop:
    async def test_logs_exception_and_stops(self, listener, monkeypatch):
        calls = {"n": 0}

        async def raise_once():
            calls["n"] += 1
            raise RuntimeError("boom")

        monkeypatch.setattr(listener, "_poll_box_scores", raise_once)
        monkeypatch.setattr(ws_listener.asyncio, "sleep", _stop_after(listener))
        listener._running = True

        await listener._poll_box_scores_loop()

        assert calls["n"] == 1


class TestPollBoxScores:
    async def test_skips_non_live_games(self, listener):
        game = GameState(game_id="401", home_team="BOS", away_team="NYK", status="final")
        game.picks = {1: _mk_pick()}
        listener.engine.games["401"] = game
        with respx.mock:
            await listener._poll_box_scores()
            assert len(respx.calls) == 0

    async def test_skips_games_without_picks(self, listener):
        game = GameState(game_id="401", home_team="BOS", away_team="NYK", status="live")
        listener.engine.games["401"] = game
        with respx.mock:
            await listener._poll_box_scores()
            assert len(respx.calls) == 0

    async def test_success_updates_engine_and_alerts(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_send_copilot_alert", AsyncMock())
        game = GameState(game_id="401", home_team="BOS", away_team="NYK", status="live", quarter=1)
        pick = _mk_pick()
        pick.box_score.fouls = 6  # ensures the foul-trouble alert fires
        game.picks = {1: pick}
        listener.engine.games["401"] = game

        with respx.mock:
            respx.get(f"{API_URL}/games/401/boxscore").mock(
                return_value=httpx.Response(
                    200,
                    json={
                        "home": {
                            "players": [{"name": "Jayson Tatum", "minutes": "30:00", "fouls": 6}]
                        },
                        "away": {"players": []},
                    },
                )
            )
            await listener._poll_box_scores()

        assert pick.box_score.minutes == 30.0
        listener._send_copilot_alert.assert_awaited()

    async def test_no_players_in_response_is_skipped(self, listener):
        game = GameState(game_id="401", home_team="BOS", away_team="NYK", status="live")
        game.picks = {1: _mk_pick()}
        listener.engine.games["401"] = game

        with respx.mock:
            respx.get(f"{API_URL}/games/401/boxscore").mock(
                return_value=httpx.Response(200, json={"home": {}, "away": {}})
            )
            await listener._poll_box_scores()  # no raise, nothing to update

    async def test_non_200_is_skipped(self, listener):
        game = GameState(game_id="401", home_team="BOS", away_team="NYK", status="live")
        game.picks = {1: _mk_pick()}
        listener.engine.games["401"] = game

        with respx.mock:
            respx.get(f"{API_URL}/games/401/boxscore").mock(return_value=httpx.Response(500))
            await listener._poll_box_scores()

    async def test_exception_logs_warning(self, listener):
        game = GameState(game_id="401", home_team="BOS", away_team="NYK", status="live")
        game.picks = {1: _mk_pick()}
        listener.engine.games["401"] = game

        with respx.mock:
            respx.get(f"{API_URL}/games/401/boxscore").mock(side_effect=httpx.ConnectError("down"))
            await listener._poll_box_scores()  # must not raise


# ---------------------------------------------------------------------------
# _fetch_season_stats_for_picks
# ---------------------------------------------------------------------------


class TestFetchSeasonStatsForPicks:
    async def test_success_updates_engine(self, listener):
        game = GameState(game_id="401", home_team="BOS", away_team="NYK")
        pick = _mk_pick()
        game.picks = {1: pick}
        listener.engine.games["401"] = game

        picks = [{"player_name": "Jayson Tatum", "game_id": "401"}]
        with respx.mock:
            respx.get(f"{API_URL}/players", params={"search": "Jayson Tatum"}).mock(
                return_value=httpx.Response(200, json=[{"id": "p1"}])
            )
            respx.get(f"{API_URL}/players/p1/stats").mock(
                return_value=httpx.Response(200, json={"ppg": 27.4})
            )
            await listener._fetch_season_stats_for_picks(picks)

        assert pick.season_avg == 27.4
        assert "401:Jayson Tatum" in listener._season_stats_fetched

    async def test_missing_player_name_or_game_id_skipped(self, listener):
        with respx.mock:
            await listener._fetch_season_stats_for_picks([{"player_name": "", "game_id": "401"}])
            await listener._fetch_season_stats_for_picks([{"player_name": "X", "game_id": ""}])
            assert len(respx.calls) == 0

    async def test_already_fetched_is_skipped(self, listener):
        listener._season_stats_fetched.add("401:Jayson Tatum")
        with respx.mock:
            await listener._fetch_season_stats_for_picks(
                [{"player_name": "Jayson Tatum", "game_id": "401"}]
            )
            assert len(respx.calls) == 0

    async def test_players_search_non_200(self, listener):
        with respx.mock:
            respx.get(f"{API_URL}/players", params={"search": "X"}).mock(
                return_value=httpx.Response(500)
            )
            await listener._fetch_season_stats_for_picks([{"player_name": "X", "game_id": "401"}])

    async def test_players_search_empty(self, listener):
        with respx.mock:
            respx.get(f"{API_URL}/players", params={"search": "X"}).mock(
                return_value=httpx.Response(200, json=[])
            )
            await listener._fetch_season_stats_for_picks([{"player_name": "X", "game_id": "401"}])

    async def test_player_missing_id(self, listener):
        with respx.mock:
            respx.get(f"{API_URL}/players", params={"search": "X"}).mock(
                return_value=httpx.Response(200, json=[{"name": "X"}])
            )
            await listener._fetch_season_stats_for_picks([{"player_name": "X", "game_id": "401"}])

    async def test_stats_non_200(self, listener):
        with respx.mock:
            respx.get(f"{API_URL}/players", params={"search": "X"}).mock(
                return_value=httpx.Response(200, json=[{"id": "p1"}])
            )
            respx.get(f"{API_URL}/players/p1/stats").mock(return_value=httpx.Response(500))
            await listener._fetch_season_stats_for_picks([{"player_name": "X", "game_id": "401"}])

    async def test_exception_is_swallowed(self, listener):
        with respx.mock:
            respx.get(f"{API_URL}/players", params={"search": "X"}).mock(
                side_effect=httpx.ConnectError("down")
            )
            await listener._fetch_season_stats_for_picks([{"player_name": "X", "game_id": "401"}])


# ---------------------------------------------------------------------------
# _send_copilot_alert
# ---------------------------------------------------------------------------


class TestSendCopilotAlert:
    async def test_halftime_report_uses_dedicated_embed(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        game = GameState(game_id="401", home_team="BOS", away_team="NYK", status="halftime")
        await listener._send_copilot_alert(AlertType.HALFTIME_REPORT, game, None)
        listener._queue_dm.assert_awaited_once()
        kwargs = listener._queue_dm.await_args.kwargs
        assert kwargs["embed"].title.startswith("\U0001f4cb Halftime Report")

    async def test_other_alert_with_message_sends_copilot_embed(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        game = GameState(game_id="401", home_team="BOS", away_team="NYK", quarter=3, status="live")
        game.home_score, game.away_score = 90, 60  # blowout
        pick = _mk_pick()
        pick.blowout_alerted = True
        await listener._send_copilot_alert(AlertType.BLOWOUT_WARNING, game, pick)
        listener._queue_dm.assert_awaited_once()

    async def test_none_message_sends_nothing(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        game = GameState(game_id="401", home_team="BOS", away_team="NYK")
        game.prev_quarter = 0  # generate_alert_message requires prev_quarter > 0
        await listener._send_copilot_alert(AlertType.QUARTER_SUMMARY, game, None)
        listener._queue_dm.assert_not_awaited()


# ---------------------------------------------------------------------------
# _check_daily_recap
# ---------------------------------------------------------------------------


class TestCheckDailyRecap:
    async def test_already_sent_returns_immediately(self, listener, monkeypatch):
        listener._recap_sent = True
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        await listener._check_daily_recap()
        listener._queue_dm.assert_not_awaited()

    async def test_no_games_returns(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        await listener._check_daily_recap()
        listener._queue_dm.assert_not_awaited()

    async def test_not_all_final_returns(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        game = GameState(game_id="401", home_team="BOS", away_team="NYK", status="live")
        game.picks = {1: _mk_pick()}
        listener.engine.games["401"] = game
        await listener._check_daily_recap()
        listener._queue_dm.assert_not_awaited()

    async def test_all_final_but_none_resolved_returns(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        game = GameState(game_id="401", home_team="BOS", away_team="NYK", status="final")
        game.picks = {1: _mk_pick()}  # is_hit still None
        listener.engine.games["401"] = game
        await listener._check_daily_recap()
        listener._queue_dm.assert_not_awaited()
        assert listener._recap_sent is False

    async def test_sends_once(self, listener, monkeypatch):
        monkeypatch.setattr(listener, "_queue_dm", AsyncMock())
        game = GameState(game_id="401", home_team="BOS", away_team="NYK", status="final")
        pick = _mk_pick()
        pick.is_hit = True
        pick.actual_value = 30.0
        game.picks = {1: pick}
        listener.engine.games["401"] = game

        await listener._check_daily_recap()
        assert listener._recap_sent is True
        listener._queue_dm.assert_awaited_once()

        await listener._check_daily_recap()  # second call: already sent
        assert listener._queue_dm.await_count == 1


# ---------------------------------------------------------------------------
# _queue_dm / _dm_worker
# ---------------------------------------------------------------------------


class TestQueueDmAndWorker:
    async def test_queue_dm_puts_item_on_queue(self, listener):
        await listener._queue_dm(content="hi", embed=None)
        item = await listener._dm_queue.get()
        assert item == ("hi", None)

    async def test_worker_respects_cooldown(self, listener, monkeypatch):
        await listener._dm_queue.put((None, "embed-placeholder"))
        monkeypatch.setattr(listener, "send_dm", AsyncMock())
        sleeps = []

        async def fake_sleep(secs):
            sleeps.append(secs)

        monkeypatch.setattr(ws_listener.asyncio, "sleep", fake_sleep)
        listener._last_dm_time = asyncio.get_event_loop().time()  # elapsed ~0 < DM_COOLDOWN

        async def fake_wait_for(coro, timeout):
            item = await coro
            listener._running = False
            return item

        monkeypatch.setattr(ws_listener.asyncio, "wait_for", fake_wait_for)

        await listener._dm_worker()

        assert sleeps and sleeps[0] > 0
        listener.send_dm.assert_awaited_once()

    async def test_worker_skips_cooldown_when_elapsed(self, listener, monkeypatch):
        await listener._dm_queue.put((None, "embed-placeholder"))
        monkeypatch.setattr(listener, "send_dm", AsyncMock())
        sleeps = []

        async def fake_sleep(secs):
            sleeps.append(secs)

        monkeypatch.setattr(ws_listener.asyncio, "sleep", fake_sleep)
        listener._last_dm_time = 0.0  # elapsed is huge

        async def fake_wait_for(coro, timeout):
            item = await coro
            listener._running = False
            return item

        monkeypatch.setattr(ws_listener.asyncio, "wait_for", fake_wait_for)

        await listener._dm_worker()

        assert sleeps == []
        listener.send_dm.assert_awaited_once()

    async def test_worker_timeout_continues_then_stops(self, listener, monkeypatch):
        calls = {"n": 0}

        async def fake_wait_for(coro, timeout):
            coro.close()
            calls["n"] += 1
            listener._running = False
            raise asyncio.TimeoutError()

        monkeypatch.setattr(ws_listener.asyncio, "wait_for", fake_wait_for)
        listener._running = True

        await listener._dm_worker()

        assert calls["n"] == 1

    async def test_worker_cancelled_error_breaks(self, listener, monkeypatch):
        async def fake_wait_for(coro, timeout):
            coro.close()
            raise asyncio.CancelledError()

        monkeypatch.setattr(ws_listener.asyncio, "wait_for", fake_wait_for)
        listener._running = True

        await listener._dm_worker()  # break exits cleanly, no exception propagates

    async def test_worker_generic_exception_logs_and_sleeps(self, listener, monkeypatch):
        await listener._dm_queue.put((None, None))
        monkeypatch.setattr(listener, "send_dm", AsyncMock(side_effect=RuntimeError("boom")))
        sleeps = []

        async def fake_sleep(secs):
            sleeps.append(secs)
            listener._running = False

        monkeypatch.setattr(ws_listener.asyncio, "sleep", fake_sleep)
        listener._last_dm_time = 0.0
        listener._running = True

        await listener._dm_worker()

        assert sleeps == [1]


# ---------------------------------------------------------------------------
# run / stop
# ---------------------------------------------------------------------------


class TestRunAndStop:
    async def test_run_logs_poll_cycle_exception(self, listener, monkeypatch):
        async def forever():
            await asyncio.sleep(3600)

        monkeypatch.setattr(listener, "_listen_scoreboard", forever)
        monkeypatch.setattr(listener, "_poll_box_scores_loop", forever)
        monkeypatch.setattr(listener, "_dm_worker", forever)

        async def raise_poll():
            raise RuntimeError("poll boom")

        monkeypatch.setattr(listener, "_poll_and_subscribe", raise_poll)
        monkeypatch.setattr(ws_listener.asyncio, "sleep", _stop_after(listener))

        await listener.run()  # must not raise — caught and logged

    async def test_stop_without_run_is_safe(self, listener):
        """Calling stop() before run() means the three task attrs are still
        None — the guard `if self._scoreboard_task:` etc. must skip cleanly."""
        close_mock = Mock()
        listener.game_log.close = close_mock
        await listener.stop()
        close_mock.assert_called_once()

    async def test_run_starts_background_tasks_and_stop_cancels_them(self, listener, monkeypatch):
        async def forever():
            await asyncio.sleep(3600)

        monkeypatch.setattr(listener, "_listen_scoreboard", forever)
        monkeypatch.setattr(listener, "_poll_box_scores_loop", forever)
        monkeypatch.setattr(listener, "_dm_worker", forever)

        poll_calls = {"n": 0}

        async def fake_poll():
            poll_calls["n"] += 1

        monkeypatch.setattr(listener, "_poll_and_subscribe", fake_poll)
        monkeypatch.setattr(ws_listener.asyncio, "sleep", _stop_after(listener))

        await listener.run()

        assert poll_calls["n"] == 1
        assert listener._dm_worker_task is not None
        assert listener._scoreboard_task is not None
        assert listener._boxscore_task is not None

        # A fake per-game task, to exercise stop()'s game-task cleanup too.
        game_task = asyncio.create_task(forever())
        listener._game_tasks["401"] = game_task

        close_mock = Mock()
        monkeypatch.setattr(listener.game_log, "close", close_mock)

        await listener.stop()
        tasks = [
            listener._dm_worker_task,
            listener._scoreboard_task,
            listener._boxscore_task,
            game_task,
        ]
        await asyncio.gather(*tasks, return_exceptions=True)  # let cancellation fully propagate

        assert listener._game_tasks == {}
        assert listener._running is False
        close_mock.assert_called_once()
        for t in tasks:
            assert t.cancelled()
