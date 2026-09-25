"""Tests for __main__ — ingestion orchestrator."""

from __future__ import annotations

import asyncio
from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.__main__ import LIVE_STATUSES, PBP_INTERVAL, SCOREBOARD_INTERVAL, run

# Patching "src.__main__.asyncio.wait_for" replaces the attribute on the shared
# asyncio module, so the fakes below keep a reference to the real one.
_real_wait_for = asyncio.wait_for


class TestLiveStatuses:
    def test_contains_live(self):
        assert "live" in LIVE_STATUSES

    def test_contains_halftime(self):
        assert "halftime" in LIVE_STATUSES

    def test_does_not_contain_final(self):
        assert "final" not in LIVE_STATUSES

    def test_does_not_contain_scheduled(self):
        assert "scheduled" not in LIVE_STATUSES


def _io(order: list[str] | None = None):
    """(sink, http) fakes; optionally record close order into ``order``."""
    order = order if order is not None else []
    sink = MagicMock()
    sink.flush = AsyncMock()
    sink.close = AsyncMock(side_effect=lambda: order.append("sink.close"))
    http = AsyncMock()
    http.aclose = AsyncMock(side_effect=lambda: order.append("http.aclose"))
    return sink, http


def _scoreboard(games=None):
    sb = AsyncMock()
    sb.poll = AsyncMock()
    sb.collect = AsyncMock(return_value=games if games is not None else [])
    sb.close = AsyncMock()
    return sb


def _pbp(new_play_count=0):
    pbp = AsyncMock()
    pbp.poll = AsyncMock()
    pbp.close = AsyncMock()
    pbp.new_play_count = new_play_count
    return pbp


def _patch_run(stack: ExitStack, *, settings, sink, http, scoreboard, pbp=None, wait_for=None):
    """Patch run()'s collaborators; returns the dict of patchers' mocks."""
    mocks = {
        "Settings": stack.enter_context(patch("src.__main__.Settings", return_value=settings)),
        "build_io": stack.enter_context(
            patch("src.__main__.build_io", new_callable=AsyncMock, return_value=(sink, http))
        ),
        "ScoreboardCollector": stack.enter_context(
            patch("src.__main__.ScoreboardCollector", return_value=scoreboard)
        ),
        "loop": stack.enter_context(patch("src.__main__.asyncio.get_running_loop")),
    }
    if pbp is not None:
        mocks["PlayByPlayCollector"] = stack.enter_context(
            patch("src.__main__.PlayByPlayCollector", return_value=pbp)
        )
    if wait_for is not None:
        stack.enter_context(patch("src.__main__.asyncio.wait_for", side_effect=wait_for))
    return mocks


def _split_wait_for(*, pbp_cycles: int, scoreboard_cycles: int):
    """Let each loop run N cycles (yielding between them so the two loops
    interleave as in production), then end BOTH together: a loop that hits
    its limit waits until the other one has too, so neither is still running
    when run()'s finally block closes the shared IO."""
    calls = {"pbp": 0, "sb": 0}
    done: set[str] = set()
    both_done: list[asyncio.Event] = []

    async def fake_wait_for(coro, timeout):
        coro.close()
        if not both_done:
            both_done.append(asyncio.Event())
        key = "pbp" if timeout == PBP_INTERVAL else "sb"
        calls[key] += 1
        limit = pbp_cycles if key == "pbp" else scoreboard_cycles
        if calls[key] >= limit:
            done.add(key)
            if done == {"pbp", "sb"}:
                both_done[0].set()
            await _real_wait_for(both_done[0].wait(), timeout=5)
            raise asyncio.CancelledError()
        await asyncio.sleep(0)
        raise TimeoutError()

    return fake_wait_for


@pytest.mark.asyncio
class TestRun:
    async def test_shutdown_immediately(self):
        """run() starts, polls once, and on cancel closes scoreboard, sink, http."""
        settings = MagicMock()
        sink, http = _io()
        scoreboard = _scoreboard()

        async def fake_wait_for(coro, timeout):
            coro.close()
            raise asyncio.CancelledError()

        with ExitStack() as stack:
            m = _patch_run(
                stack,
                settings=settings,
                sink=sink,
                http=http,
                scoreboard=scoreboard,
                wait_for=fake_wait_for,
            )
            with pytest.raises(asyncio.CancelledError):
                await run()

        m["build_io"].assert_awaited_once_with(settings)
        m["ScoreboardCollector"].assert_called_once_with(settings, sink, http)
        scoreboard.poll.assert_awaited()
        scoreboard.close.assert_awaited_once()
        sink.close.assert_awaited_once()
        http.aclose.assert_awaited_once()

    async def test_manages_pbp_collectors_with_the_shared_io(self):
        """A live game gets one PBP collector built on the SAME sink/http;
        when it goes final the collector is closed and dropped."""
        settings = MagicMock()
        sink, http = _io()
        scoreboard = _scoreboard()
        scoreboard.collect = AsyncMock(
            side_effect=[
                [{"game_id": "g1", "status": "live"}],
                [{"game_id": "g1", "status": "final"}],
            ]
        )
        pbp = _pbp(new_play_count=42)

        with ExitStack() as stack:
            m = _patch_run(
                stack,
                settings=settings,
                sink=sink,
                http=http,
                scoreboard=scoreboard,
                pbp=pbp,
                wait_for=_split_wait_for(pbp_cycles=1, scoreboard_cycles=2),
            )
            with pytest.raises(asyncio.CancelledError):
                await run()

        m["PlayByPlayCollector"].assert_called_once_with(settings, sink, game_id="g1", http=http)
        pbp.close.assert_awaited_once()  # by the "finished" cleanup, not again in finally
        http.aclose.assert_awaited_once()
        sink.close.assert_awaited_once()

    async def test_build_io_failure_propagates_before_any_collector_exists(self):
        with ExitStack() as stack:
            m = _patch_run(
                stack, settings=MagicMock(), sink=None, http=None, scoreboard=_scoreboard()
            )
            m["build_io"].side_effect = OSError("db unreachable")
            with pytest.raises(OSError, match="db unreachable"):
                await run()
        m["ScoreboardCollector"].assert_not_called()

    async def test_loops_exit_immediately_when_shutdown_already_set(self):
        """shutdown already set → both loops exit without polling; run()
        returns normally and still closes scoreboard, sink and http."""
        sink, http = _io()
        scoreboard = _scoreboard()
        mock_event = MagicMock()
        mock_event.is_set.return_value = True

        with ExitStack() as stack:
            _patch_run(stack, settings=MagicMock(), sink=sink, http=http, scoreboard=scoreboard)
            stack.enter_context(patch("src.__main__.asyncio.Event", return_value=mock_event))
            await run()  # returns cleanly, no CancelledError

        scoreboard.poll.assert_not_awaited()
        scoreboard.close.assert_awaited_once()
        sink.close.assert_awaited_once()
        http.aclose.assert_awaited_once()

    async def test_scoreboard_error_is_caught_and_logged(self, capsys):
        """A generic exception from scoreboard.poll() (e.g. a sink flush
        failure) is logged; the loop keeps going rather than crashing run()."""
        sink, http = _io()
        scoreboard = _scoreboard()
        scoreboard.poll = AsyncMock(side_effect=RuntimeError("scoreboard boom"))

        with ExitStack() as stack:
            _patch_run(
                stack,
                settings=MagicMock(),
                sink=sink,
                http=http,
                scoreboard=scoreboard,
                wait_for=_split_wait_for(pbp_cycles=3, scoreboard_cycles=1),
            )
            with pytest.raises(asyncio.CancelledError):
                await run()

        scoreboard.poll.assert_awaited()
        assert "ingestion.scoreboard_error" in capsys.readouterr().out

    async def test_pbp_loop_polls_active_collector_and_closes_it_on_cancel(self):
        """A game that stays live: created once, polled by pbp_loop, and
        closed by the finally block — before the sink, then the http."""
        order: list[str] = []
        sink, http = _io(order)
        scoreboard = _scoreboard([{"game_id": "g1", "status": "live"}])
        scoreboard.close = AsyncMock(side_effect=lambda: order.append("scoreboard.close"))
        pbp = _pbp(new_play_count=3)
        pbp.close = AsyncMock(side_effect=lambda: order.append("pbp.close"))

        with ExitStack() as stack:
            m = _patch_run(
                stack,
                settings=MagicMock(),
                sink=sink,
                http=http,
                scoreboard=scoreboard,
                pbp=pbp,
                wait_for=_split_wait_for(pbp_cycles=4, scoreboard_cycles=3),
            )
            with pytest.raises(asyncio.CancelledError):
                await run()

        pbp.poll.assert_awaited()
        m["PlayByPlayCollector"].assert_called_once()  # not recreated on cycle 2
        assert order == ["pbp.close", "scoreboard.close", "sink.close", "http.aclose"]

    async def test_pbp_loop_error_is_caught_and_logged(self, capsys):
        """Building the cycle's gather raising synchronously is caught by
        pbp_loop's own except block, not left to crash run()."""
        sink, http = _io()
        pbp = _pbp()

        with ExitStack() as stack:
            _patch_run(
                stack,
                settings=MagicMock(),
                sink=sink,
                http=http,
                scoreboard=_scoreboard([{"game_id": "g1", "status": "live"}]),
                pbp=pbp,
                wait_for=_split_wait_for(pbp_cycles=2, scoreboard_cycles=2),
            )
            stack.enter_context(
                patch("src.__main__._bounded", MagicMock(side_effect=TypeError("boom")))
            )
            with pytest.raises(asyncio.CancelledError):
                await run()

        assert "ingestion.pbp_error" in capsys.readouterr().out

    async def test_failed_pbp_poll_is_logged_with_its_game_id(self, capsys):
        """gather(return_exceptions=True) must not swallow a collector's
        failure (e.g. a sink flush error) silently."""
        sink, http = _io()
        pbp = _pbp()
        pbp.poll = AsyncMock(side_effect=RuntimeError("flush failed"))

        with ExitStack() as stack:
            _patch_run(
                stack,
                settings=MagicMock(),
                sink=sink,
                http=http,
                scoreboard=_scoreboard([{"game_id": "g7", "status": "live"}]),
                pbp=pbp,
                wait_for=_split_wait_for(pbp_cycles=2, scoreboard_cycles=2),
            )
            with pytest.raises(asyncio.CancelledError):
                await run()

        out = capsys.readouterr().out
        assert "ingestion.pbp_poll_failed" in out
        assert "g7" in out and "flush failed" in out

    async def test_finished_game_close_failure_still_drops_the_collector(self, capsys):
        """A close() (flush) error for a finished game is logged and the
        collector is still dropped, so it isn't re-closed every cycle."""
        sink, http = _io()
        scoreboard = _scoreboard()
        scoreboard.collect = AsyncMock(
            side_effect=[
                [{"game_id": "g1", "status": "live"}],
                [{"game_id": "g1", "status": "final"}],
                [{"game_id": "g1", "status": "final"}],
            ]
        )
        pbp = _pbp()
        pbp.close = AsyncMock(side_effect=RuntimeError("flush failed"))

        with ExitStack() as stack:
            _patch_run(
                stack,
                settings=MagicMock(),
                sink=sink,
                http=http,
                scoreboard=scoreboard,
                pbp=pbp,
                wait_for=_split_wait_for(pbp_cycles=1, scoreboard_cycles=3),
            )
            with pytest.raises(asyncio.CancelledError):
                await run()

        pbp.close.assert_awaited_once()  # not retried in later cycles or in finally
        out = capsys.readouterr().out
        assert "ingestion.close_failed" in out
        assert "ingestion.scoreboard_error" not in out
        sink.close.assert_awaited_once()
        http.aclose.assert_awaited_once()

    async def test_shutdown_close_failures_never_skip_sink_or_http(self, capsys):
        """Every collector close is attempted even if one fails, and the
        shared sink and http are closed regardless."""
        order: list[str] = []
        sink, http = _io(order)
        pbp = _pbp()
        pbp.close = AsyncMock(side_effect=RuntimeError("pbp flush failed"))
        scoreboard = _scoreboard([{"game_id": "g1", "status": "live"}])
        scoreboard.close = AsyncMock(side_effect=RuntimeError("sb flush failed"))

        with ExitStack() as stack:
            _patch_run(
                stack,
                settings=MagicMock(),
                sink=sink,
                http=http,
                scoreboard=scoreboard,
                pbp=pbp,
                wait_for=_split_wait_for(pbp_cycles=1, scoreboard_cycles=1),
            )
            with pytest.raises(asyncio.CancelledError):
                await run()

        pbp.close.assert_awaited_once()
        scoreboard.close.assert_awaited_once()
        assert order == ["sink.close", "http.aclose"]
        assert capsys.readouterr().out.count("ingestion.close_failed") == 2

    async def test_sink_close_failure_still_closes_http(self):
        sink, http = _io()
        sink.close = AsyncMock(side_effect=RuntimeError("final flush failed"))
        mock_event = MagicMock()
        mock_event.is_set.return_value = True

        with ExitStack() as stack:
            _patch_run(stack, settings=MagicMock(), sink=sink, http=http, scoreboard=_scoreboard())
            stack.enter_context(patch("src.__main__.asyncio.Event", return_value=mock_event))
            with pytest.raises(RuntimeError, match="final flush failed"):
                await run()

        http.aclose.assert_awaited_once()


def test_intervals_are_positive():
    assert PBP_INTERVAL > 0 and SCOREBOARD_INTERVAL > PBP_INTERVAL


@pytest.mark.asyncio
class TestFinishedGameFinalPoll:
    async def test_plays_posted_after_final_reach_the_sink(self):
        """When the scoreboard flips a game to final, its collector is polled
        once more before it is retired, so the last plays ESPN posts are kept."""
        from src.collectors.playbyplay import PlayByPlayCollector

        settings = MagicMock()
        settings.espn_base_url = "https://espn.test"
        sink, http = _io()
        polled_once = asyncio.Event()
        summaries = [
            {
                "plays": [
                    {"id": "a", "sequenceNumber": "1", "type": {"text": "Jump Ball"}, "text": ""}
                ]
            },
            {
                "plays": [
                    {"id": "a", "sequenceNumber": "1", "type": {"text": "Jump Ball"}, "text": ""},
                    {"id": "b", "sequenceNumber": "2", "type": {"text": "End Game"}, "text": ""},
                ]
            },
        ]

        async def fake_get(url, params=None):
            body = summaries[min(http.get.await_count - 1, 1)]
            polled_once.set()
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            resp.json = MagicMock(return_value=body)
            return resp

        http.get = AsyncMock(side_effect=fake_get)

        collects = 0

        async def collect():
            nonlocal collects
            collects += 1
            if collects == 1:
                return [{"game_id": "g1", "status": "live"}]
            await _real_wait_for(polled_once.wait(), timeout=5)  # pbp_loop polled once
            return [{"game_id": "g1", "status": "final"}]

        scoreboard = _scoreboard()
        scoreboard.collect = AsyncMock(side_effect=collect)

        with ExitStack() as stack:
            m = _patch_run(
                stack,
                settings=settings,
                sink=sink,
                http=http,
                scoreboard=scoreboard,
                wait_for=_split_wait_for(pbp_cycles=1, scoreboard_cycles=2),
            )
            stack.enter_context(
                patch("src.__main__.PlayByPlayCollector", wraps=PlayByPlayCollector)
            )
            with pytest.raises(asyncio.CancelledError):
                await run()

        assert m["build_io"].await_count == 1
        assert http.get.await_count == 2  # one live poll + the final poll
        produced = [
            c.kwargs["value"]["sequence_number"]
            for c in sink.produce.call_args_list
            if c.kwargs["topic"] == "raw.plays"
        ]
        assert produced == [1, 2]

    async def test_final_poll_failure_is_logged_and_collector_still_closed(self, capsys):
        sink, http = _io()
        scoreboard = _scoreboard()
        scoreboard.collect = AsyncMock(
            side_effect=[
                [{"game_id": "g1", "status": "live"}],
                [{"game_id": "g1", "status": "final"}],
            ]
        )
        pbp = _pbp()
        pbp.poll = AsyncMock(side_effect=RuntimeError("flush failed"))

        with ExitStack() as stack:
            _patch_run(
                stack,
                settings=MagicMock(),
                sink=sink,
                http=http,
                scoreboard=scoreboard,
                pbp=pbp,
                wait_for=_split_wait_for(pbp_cycles=1, scoreboard_cycles=2),
            )
            with pytest.raises(asyncio.CancelledError):
                await run()

        pbp.close.assert_awaited_once()
        out = capsys.readouterr().out
        assert "ingestion.final_poll_failed" in out
        assert "ingestion.scoreboard_error" not in out


class TestRateLimitedWarning:
    def _make(self, window=60.0):
        from src.__main__ import _RateLimitedWarning

        now = [1000.0]
        return _RateLimitedWarning("ingestion.pbp_poll_failed", window, clock=lambda: now[0]), now

    def test_logs_once_per_key_per_window_and_counts_suppressed(self, capsys):
        warn, now = self._make()
        warn("g1", error="boom")
        now[0] += 10
        warn("g1", error="boom")
        warn("g1", error="boom")
        warn("g2", error="other")  # a different game is not suppressed
        now[0] += 50  # 60s after the first log
        warn("g1", error="boom")
        lines = [ln for ln in capsys.readouterr().out.splitlines() if "pbp_poll_failed" in ln]
        assert len(lines) == 3
        assert "game_id=g1" in lines[0] and "suppressed=0" in lines[0]
        assert "game_id=g2" in lines[1] and "suppressed=0" in lines[1]
        assert "game_id=g1" in lines[2] and "suppressed=2" in lines[2]

    def test_forget_resets_the_window(self, capsys):
        warn, now = self._make()
        warn("g1", error="boom")
        warn.forget("g1")
        warn.forget("never-seen")  # no-op
        warn("g1", error="boom")
        assert capsys.readouterr().out.count("pbp_poll_failed") == 2


@pytest.mark.asyncio
async def test_persistent_pbp_failure_logs_once_per_window(capsys):
    """A game failing every 1s cycle logs pbp_poll_failed once, not per cycle."""
    sink, http = _io()
    pbp = _pbp()
    pbp.poll = AsyncMock(side_effect=RuntimeError("espn parse"))

    with ExitStack() as stack:
        _patch_run(
            stack,
            settings=MagicMock(),
            sink=sink,
            http=http,
            scoreboard=_scoreboard([{"game_id": "g1", "status": "live"}]),
            pbp=pbp,
            wait_for=_split_wait_for(pbp_cycles=5, scoreboard_cycles=1),
        )
        with pytest.raises(asyncio.CancelledError):
            await run()

    assert pbp.poll.await_count >= 3
    assert capsys.readouterr().out.count("ingestion.pbp_poll_failed") == 1


# --- Final fix wave #4: a hanging/flaky game's poll is bounded per game, so it
# never delays the other games' produce within a cycle. ---


def _pbp_per_game(collectors: dict):
    return lambda settings, sink, game_id, http: collectors[game_id]


@pytest.mark.asyncio
async def test_hanging_game_does_not_delay_the_others_within_a_cycle(monkeypatch, capsys):
    import src.__main__ as main_mod

    monkeypatch.setattr(main_mod, "PBP_POLL_TIMEOUT", 0.05)
    sink, http = _io()
    never = asyncio.Event()

    stuck, healthy = _pbp(), _pbp()

    async def hang():
        await never.wait()

    stuck.poll = AsyncMock(side_effect=hang)
    healthy.poll = AsyncMock(side_effect=lambda: sink.produce(topic="raw.plays", key="g2"))

    with ExitStack() as stack:
        _patch_run(
            stack,
            settings=MagicMock(),
            sink=sink,
            http=http,
            scoreboard=_scoreboard(
                [{"game_id": "g1", "status": "live"}, {"game_id": "g2", "status": "live"}]
            ),
            wait_for=_split_wait_for(pbp_cycles=3, scoreboard_cycles=1),
        )
        stack.enter_context(
            patch(
                "src.__main__.PlayByPlayCollector",
                side_effect=_pbp_per_game({"g1": stuck, "g2": healthy}),
            )
        )
        with pytest.raises(asyncio.CancelledError):
            # Unbounded, the stuck game would hold the first cycle forever.
            await _real_wait_for(run(), timeout=3)

    assert healthy.poll.await_count >= 2  # polled every cycle, not stuck behind g1
    assert sink.produce.call_count == healthy.poll.await_count
    out = capsys.readouterr().out
    assert "ingestion.pbp_poll_failed" in out and "game_id=g1" in out


@pytest.mark.asyncio
async def test_hanging_final_poll_is_bounded_and_the_collector_still_closes(monkeypatch, capsys):
    import src.__main__ as main_mod

    monkeypatch.setattr(main_mod, "PBP_POLL_TIMEOUT", 0.05)
    sink, http = _io()
    never = asyncio.Event()
    scoreboard = _scoreboard()
    scoreboard.collect = AsyncMock(
        side_effect=[
            [{"game_id": "g1", "status": "live"}],
            [{"game_id": "g1", "status": "final"}],
        ]
    )
    pbp = _pbp()

    async def hang():
        await never.wait()

    pbp.poll = AsyncMock(side_effect=hang)

    with ExitStack() as stack:
        _patch_run(
            stack,
            settings=MagicMock(),
            sink=sink,
            http=http,
            scoreboard=scoreboard,
            pbp=pbp,
            wait_for=_split_wait_for(pbp_cycles=1, scoreboard_cycles=2),
        )
        with pytest.raises(asyncio.CancelledError):
            await _real_wait_for(run(), timeout=3)

    pbp.close.assert_awaited_once()
    assert "ingestion.final_poll_failed" in capsys.readouterr().out


def test_pbp_poll_timeout_is_short_but_positive():
    from src.__main__ import PBP_POLL_TIMEOUT

    assert 0 < PBP_POLL_TIMEOUT <= 5
