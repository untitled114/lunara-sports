"""Tests for scoreboard.py's standalone polling CLI (post-Task 10, R24).

``main()`` builds the shared IO with ``build_io(Settings())`` — one
PostgresSink and one EspnHttp — polls a ``ScoreboardCollector(settings, sink,
http)`` until shutdown, and always closes both the sink and the http client
in its ``finally`` block.
"""

from __future__ import annotations

import asyncio
import runpy
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.collectors.scoreboard import main


def _fakes():
    settings = MagicMock()
    settings.espn_poll_interval_seconds = 5
    settings.espn_base_url = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
    sink = MagicMock()
    sink.flush = AsyncMock()
    sink.close = AsyncMock()
    http = AsyncMock()
    collector = AsyncMock()
    return settings, sink, http, collector


@pytest.mark.asyncio
class TestMain:
    async def test_builds_io_from_settings_polls_until_shutdown_then_closes_both(self):
        settings, sink, http, collector = _fakes()
        calls = 0

        async def fake_wait_for(coro, timeout):
            nonlocal calls
            coro.close()
            calls += 1
            assert timeout == settings.espn_poll_interval_seconds
            if calls >= 2:
                raise asyncio.CancelledError()
            raise TimeoutError()

        with (
            patch("src.collectors.scoreboard.Settings", return_value=settings),
            patch(
                "src.__main__.build_io", new_callable=AsyncMock, return_value=(sink, http)
            ) as mock_build_io,
            patch(
                "src.collectors.scoreboard.ScoreboardCollector", return_value=collector
            ) as collector_cls,
            patch("src.collectors.scoreboard.asyncio.wait_for", side_effect=fake_wait_for),
            patch("src.collectors.scoreboard.asyncio.get_running_loop") as mock_loop,
            pytest.raises(asyncio.CancelledError),
        ):
            await main()

        mock_build_io.assert_awaited_once_with(settings)
        collector_cls.assert_called_once_with(settings, sink, http)
        assert collector.poll.await_count == 2
        assert mock_loop.return_value.add_signal_handler.call_count == 2
        sink.close.assert_awaited_once()
        http.aclose.assert_awaited_once()

    async def test_shutdown_already_set_skips_poll_but_still_closes_both(self):
        settings, sink, http, collector = _fakes()
        mock_event = MagicMock()
        mock_event.is_set.return_value = True

        with (
            patch("src.collectors.scoreboard.Settings", return_value=settings),
            patch("src.__main__.build_io", new_callable=AsyncMock, return_value=(sink, http)),
            patch("src.collectors.scoreboard.ScoreboardCollector", return_value=collector),
            patch("src.collectors.scoreboard.asyncio.Event", return_value=mock_event),
            patch("src.collectors.scoreboard.asyncio.get_running_loop"),
        ):
            await main()

        collector.poll.assert_not_awaited()
        sink.close.assert_awaited_once()
        http.aclose.assert_awaited_once()

    async def test_poll_failure_still_closes_sink_and_http(self):
        settings, sink, http, collector = _fakes()
        collector.poll.side_effect = RuntimeError("db down")

        with (
            patch("src.collectors.scoreboard.Settings", return_value=settings),
            patch("src.__main__.build_io", new_callable=AsyncMock, return_value=(sink, http)),
            patch("src.collectors.scoreboard.ScoreboardCollector", return_value=collector),
            patch("src.collectors.scoreboard.asyncio.get_running_loop"),
            pytest.raises(RuntimeError, match="db down"),
        ):
            await main()

        sink.close.assert_awaited_once()
        http.aclose.assert_awaited_once()

    async def test_sink_close_failure_still_closes_http(self):
        settings, sink, http, collector = _fakes()
        sink.close.side_effect = RuntimeError("flush failed")
        mock_event = MagicMock()
        mock_event.is_set.return_value = True

        with (
            patch("src.collectors.scoreboard.Settings", return_value=settings),
            patch("src.__main__.build_io", new_callable=AsyncMock, return_value=(sink, http)),
            patch("src.collectors.scoreboard.ScoreboardCollector", return_value=collector),
            patch("src.collectors.scoreboard.asyncio.Event", return_value=mock_event),
            patch("src.collectors.scoreboard.asyncio.get_running_loop"),
            pytest.raises(RuntimeError, match="flush failed"),
        ):
            await main()

        http.aclose.assert_awaited_once()


def test_module_guard_invokes_asyncio_run_with_main():
    """`if __name__ == "__main__": asyncio.run(main())`. asyncio.run is
    mocked so the coroutine is never driven — main() itself is covered
    above; this only characterizes the entry-point wiring."""
    with patch("asyncio.run") as mock_run:
        runpy.run_module("src.collectors.scoreboard", run_name="__main__")
    mock_run.assert_called_once()
    (coro,) = mock_run.call_args.args
    assert coro.cr_code.co_name == "main"
    coro.close()
