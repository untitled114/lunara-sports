"""Live-game WebSocket races: watermarks on join/leave, broadcast under churn,
slow clients, and the poller's rate-limited warning while Postgres is down."""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest
from starlette.websockets import WebSocketState

from src.db.models import Play
from src.ws import live_feed, play_poller
from src.ws.live_feed import ConnectionManager, manager


def _ws(send=None):
    ws = AsyncMock()
    ws.client_state = WebSocketState.CONNECTED
    if send is not None:
        ws.send_text = AsyncMock(side_effect=send)
    return ws


async def _seed(session_factory, game_id: str, seqs: list[int], id_base: int) -> None:
    async with session_factory() as sess:
        sess.add_all(
            [Play(id=id_base + s, game_id=game_id, sequence_number=s, quarter=1) for s in seqs]
        )
        await sess.commit()


@pytest.fixture
def watermarks(monkeypatch):
    marks: dict[str, int] = {}
    monkeypatch.setattr(play_poller, "_watermarks", marks)
    return marks


# ── Finding 2: a joiner must not advance the broadcast watermark ─────────


class TestJoinDoesNotSkipPlays:
    async def test_new_joiner_keeps_the_existing_watermark(self, session_factory, watermarks):
        """Plays 2-3 were committed after the poller's last cycle (watermark 1). A
        second client joining now gets them in its history, but the already-connected
        clients must still receive 2-3 from the poller's next cycle."""
        await _seed(session_factory, "g-join", [1, 2, 3], id_base=7000)
        watermarks["g-join"] = 1

        with patch("src.ws.play_poller.get_session_factory", return_value=session_factory):
            history = await play_poller.get_recent_plays("g-join")
        assert [p["sequence_number"] for p in history] == [1, 2, 3]
        assert watermarks["g-join"] == 1  # untouched by the join

        sent: list[int] = []

        async def capture(game_id, msg):
            sent.append(msg["data"]["sequence_number"])

        with (
            patch.object(manager, "active_games", return_value=["g-join"]),
            patch.object(manager, "broadcast", side_effect=capture),
        ):
            await play_poller.poll_once(session_factory)
        assert sent == [2, 3]
        assert watermarks["g-join"] == 3

    async def test_first_joiner_starts_the_watermark_at_the_db_max(
        self, session_factory, watermarks
    ):
        await _seed(session_factory, "g-first", [4, 9], id_base=7100)
        with patch("src.ws.play_poller.get_session_factory", return_value=session_factory):
            await play_poller.get_recent_plays("g-first")
        assert watermarks["g-first"] == 9


class TestEmptyRoomDropsWatermark:
    async def test_last_disconnect_drops_the_games_watermark(self, watermarks):
        watermarks["g-empty"] = 42
        watermarks["g-other"] = 7
        ws1, ws2 = _ws(), _ws()
        await manager.connect(ws1, "g-empty")
        await manager.connect(ws2, "g-empty")

        await manager.disconnect(ws1, "g-empty")
        assert watermarks["g-empty"] == 42  # room still has a client

        await manager.disconnect(ws2, "g-empty")
        assert "g-empty" not in watermarks  # a later first joiner starts fresh
        assert watermarks["g-other"] == 7

    async def test_broadcast_that_empties_the_room_drops_the_watermark(self, watermarks):
        watermarks["g-dead"] = 5
        ws = _ws(send=RuntimeError("gone"))
        await manager.connect(ws, "g-dead")
        await manager.broadcast("g-dead", {"type": "ping"})
        assert "g-dead" not in manager.active_games()
        assert "g-dead" not in watermarks

    async def test_forgetting_an_unknown_game_is_a_no_op(self, watermarks):
        play_poller.forget_watermark("never-seen")
        assert watermarks == {}

    async def test_a_failing_room_listener_does_not_break_disconnect(self):
        mgr = ConnectionManager()
        seen: list[str] = []

        def boom(game_id):
            raise RuntimeError("listener bug")

        mgr.on_room_emptied(boom)
        mgr.on_room_emptied(seen.append)
        ws = _ws()
        await mgr.connect(ws, "g1")
        await mgr.disconnect(ws, "g1")
        assert seen == ["g1"]
        assert mgr.active_games() == []


# ── Finding 3: broadcast under connection churn and slow clients ─────────


class TestBroadcastRobustness:
    async def test_connect_during_broadcast_does_not_break_iteration(self):
        mgr = ConnectionManager()
        release = asyncio.Event()
        entered = asyncio.Event()

        async def slow_send(payload):
            entered.set()
            await release.wait()

        ws1 = _ws(send=slow_send)
        ws2 = _ws()
        await mgr.connect(ws1, "g1")
        await mgr.connect(ws2, "g1")

        task = asyncio.create_task(mgr.broadcast("g1", {"type": "play", "data": {"id": 1}}))
        await asyncio.wait_for(entered.wait(), 1)
        late = _ws()
        await mgr.connect(late, "g1")  # tip-off: a new client joins mid-broadcast
        release.set()
        await asyncio.wait_for(task, 1)  # no "Set changed size during iteration"

        assert ws2.send_text.await_count == 1
        assert mgr.connection_count("g1") == 3

    async def test_slow_client_times_out_is_removed_and_others_still_receive(self, monkeypatch):
        monkeypatch.setattr(live_feed, "SEND_TIMEOUT", 0.05)
        mgr = ConnectionManager()

        async def hang(payload):
            await asyncio.sleep(10)

        slow = _ws(send=hang)
        fast1, fast2 = _ws(), _ws()
        for ws in (fast1, slow, fast2):
            await mgr.connect(ws, "g1")

        await asyncio.wait_for(mgr.broadcast("g1", {"type": "play", "data": {"id": 2}}), 1)

        for ws in (fast1, fast2):
            assert json.loads(ws.send_text.call_args[0][0])["data"]["id"] == 2
        assert mgr.connection_count("g1") == 2
        assert slow not in mgr.active_connections["g1"]
        await asyncio.sleep(0.01)  # let the background close run
        slow.close.assert_awaited()

    async def test_slow_clients_time_out_concurrently_not_one_after_another(self, monkeypatch):
        monkeypatch.setattr(live_feed, "SEND_TIMEOUT", 0.2)
        mgr = ConnectionManager()

        async def hang(payload):
            await asyncio.sleep(10)

        for _ in range(5):
            await mgr.connect(_ws(send=hang), "g1")
        loop = asyncio.get_running_loop()
        start = loop.time()
        await mgr.broadcast("g1", {"type": "ping"})
        assert loop.time() - start < 0.6  # 5 x 0.2 s serially would be >= 1.0 s
        assert mgr.connection_count("g1") == 0
        assert "g1" not in mgr.active_games()

    async def test_close_of_a_dropped_socket_failing_is_swallowed(self, monkeypatch):
        monkeypatch.setattr(live_feed, "SEND_TIMEOUT", 0.05)
        mgr = ConnectionManager()

        async def hang(payload):
            await asyncio.sleep(10)

        ws = _ws(send=hang)
        ws.close = AsyncMock(side_effect=RuntimeError("already closed"))
        await mgr.connect(ws, "g1")
        await mgr.broadcast("g1", {"type": "ping"})
        await asyncio.sleep(0.01)
        ws.close.assert_awaited()

    async def test_room_already_gone_when_dead_socket_is_removed(self):
        """A concurrent disconnect emptied the room while the send was failing."""
        mgr = ConnectionManager()

        async def fail_after_room_left(payload):
            await mgr.disconnect(ws, "g1")
            raise RuntimeError("gone")

        ws = _ws(send=fail_after_room_left)
        await mgr.connect(ws, "g1")
        await mgr.broadcast("g1", {"type": "ping"})
        assert mgr.active_games() == []


# ── Finding 10: poller warning rate-limited while Postgres is down ───────


class TestPollerWarningRateLimit:
    async def test_warns_at_most_once_per_window_with_suppressed_count(self, capsys):
        now = [1000.0]
        cycles = 0

        async def failing_poll():
            nonlocal cycles
            cycles += 1
            if cycles > 5:
                raise asyncio.CancelledError()
            raise OSError("connection refused")

        async def fake_sleep(secs):
            now[0] += 20.0  # 20 s per cycle: cycles at t=0,20,40,60,80

        with (
            patch("src.ws.play_poller._poll_once", side_effect=failing_poll),
            patch("src.ws.play_poller.asyncio.sleep", side_effect=fake_sleep),
            patch("src.ws.play_poller.time.monotonic", side_effect=lambda: now[0]),
            pytest.raises(asyncio.CancelledError),
        ):
            await play_poller.run_play_poller()

        lines = [ln for ln in capsys.readouterr().out.splitlines() if "ws.poller_error" in ln]
        assert len(lines) == 2  # t=0 and t=60; t=20,40 (and 80) suppressed
        assert "suppressed=0" in lines[0]
        assert "suppressed=2" in lines[1]
        assert "connection refused" in lines[0]
