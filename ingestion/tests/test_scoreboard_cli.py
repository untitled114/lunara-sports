"""Characterization tests for scoreboard.py's standalone polling-loop CLI.

``_run_polling_loop`` and the ``if __name__ == "__main__":`` guard predate
Task 10's sink-based rewrite of the collector constructors; both are tested
here against TODAY's ``ScoreboardCollector(settings, producer)`` signature,
which is what the code on disk actually uses right now.
"""

from __future__ import annotations

import asyncio
import runpy
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.collectors.scoreboard import _run_polling_loop


@pytest.mark.asyncio
class TestRunPollingLoop:
    async def test_polls_until_shutdown_then_closes_collector(self):
        """One or more poll cycles run, then CancelledError unwinds cleanly
        through the finally block (collector.close() awaited)."""
        mock_settings = MagicMock()
        mock_settings.espn_poll_interval_seconds = 5
        mock_settings.espn_base_url = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"

        mock_producer = MagicMock()
        mock_collector = AsyncMock()
        mock_collector.poll = AsyncMock()
        mock_collector.close = AsyncMock()

        call_count = 0

        async def mock_wait_for(coro, timeout):
            nonlocal call_count
            call_count += 1
            if call_count >= 2:
                raise asyncio.CancelledError()
            raise TimeoutError()

        with (
            patch("src.collectors.scoreboard.Settings", return_value=mock_settings),
            patch("src.collectors.scoreboard.KafkaProducer", return_value=mock_producer),
            patch("src.collectors.scoreboard.ScoreboardCollector", return_value=mock_collector),
            patch("src.collectors.scoreboard.asyncio.wait_for", side_effect=mock_wait_for),
            patch("src.collectors.scoreboard.asyncio.get_running_loop") as mock_loop,
        ):
            mock_loop.return_value.add_signal_handler = MagicMock()
            with pytest.raises(asyncio.CancelledError):
                await _run_polling_loop()

        mock_collector.poll.assert_awaited()
        mock_collector.close.assert_awaited_once()

    async def test_shutdown_already_set_skips_poll_entirely(self):
        """If shutdown is already set on entry, the loop body never runs
        (covers the while-loop's immediate-exit branch) yet close() still
        runs via the finally block."""
        mock_settings = MagicMock()
        mock_settings.espn_poll_interval_seconds = 5
        mock_producer = MagicMock()
        mock_collector = AsyncMock()
        mock_collector.poll = AsyncMock()
        mock_collector.close = AsyncMock()

        mock_event = MagicMock()
        mock_event.is_set.return_value = True
        mock_event.wait = AsyncMock()

        with (
            patch("src.collectors.scoreboard.Settings", return_value=mock_settings),
            patch("src.collectors.scoreboard.KafkaProducer", return_value=mock_producer),
            patch("src.collectors.scoreboard.ScoreboardCollector", return_value=mock_collector),
            patch("src.collectors.scoreboard.asyncio.Event", return_value=mock_event),
            patch("src.collectors.scoreboard.asyncio.get_running_loop") as mock_loop,
        ):
            mock_loop.return_value.add_signal_handler = MagicMock()
            await _run_polling_loop()

        mock_collector.poll.assert_not_awaited()
        mock_collector.close.assert_awaited_once()


def test_module_guard_invokes_asyncio_run_with_polling_loop():
    """`if __name__ == "__main__": asyncio.run(_run_polling_loop())`
    (scoreboard.py:210-211). asyncio.run is mocked so the coroutine is
    never actually driven — the loop's own behavior is characterized above
    by calling it directly; this only characterizes the entry-point wiring.
    """
    with patch("asyncio.run") as mock_run:
        runpy.run_module("src.collectors.scoreboard", run_name="__main__")
    mock_run.assert_called_once()
    (coro,) = mock_run.call_args.args
    assert coro.cr_code.co_name == "_run_polling_loop"
    coro.close()
