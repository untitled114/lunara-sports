"""Tests for __main__ — ingestion orchestrator."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.__main__ import LIVE_STATUSES, PBP_INTERVAL, SCOREBOARD_INTERVAL, run


class TestLiveStatuses:
    def test_contains_live(self):
        assert "live" in LIVE_STATUSES

    def test_contains_halftime(self):
        assert "halftime" in LIVE_STATUSES

    def test_does_not_contain_final(self):
        assert "final" not in LIVE_STATUSES

    def test_does_not_contain_scheduled(self):
        assert "scheduled" not in LIVE_STATUSES


@pytest.mark.asyncio
class TestRun:
    async def test_shutdown_immediately(self):
        """Test that run() can start and stop cleanly."""
        mock_settings = MagicMock()
        mock_settings.espn_poll_interval_seconds = 0.1
        mock_settings.kafka_bootstrap_servers = "localhost:9092"
        mock_settings.schema_registry_url = "http://localhost:8081"
        mock_settings.pubsub_project = ""  # use Kafka path

        mock_producer = MagicMock()
        mock_producer.produce = MagicMock()
        mock_producer.flush = MagicMock()

        mock_scoreboard = AsyncMock()
        mock_scoreboard.poll = AsyncMock()
        mock_scoreboard.collect = AsyncMock(return_value=[])
        mock_scoreboard.close = AsyncMock()

        call_count = 0

        async def mock_wait_for(coro, timeout):
            nonlocal call_count
            call_count += 1
            if call_count >= 1:
                raise asyncio.CancelledError()
            raise TimeoutError()

        with (
            patch("src.__main__.Settings", return_value=mock_settings),
            patch("src.__main__.KafkaProducer", return_value=mock_producer),
            patch("src.__main__.ScoreboardCollector", return_value=mock_scoreboard),
            patch("src.__main__.asyncio.wait_for", side_effect=mock_wait_for),
            patch("src.__main__.asyncio.get_running_loop") as mock_loop,
        ):
            mock_loop.return_value.add_signal_handler = MagicMock()
            with pytest.raises(asyncio.CancelledError):
                await run()
            mock_scoreboard.poll.assert_called()
            mock_scoreboard.close.assert_called()

    async def test_manages_pbp_collectors(self):
        """Test that run() creates and removes PBP collectors for live games."""
        mock_settings = MagicMock()
        mock_settings.espn_poll_interval_seconds = 0.1
        mock_settings.pubsub_project = ""  # use Kafka path

        mock_producer = MagicMock()
        mock_scoreboard = AsyncMock()
        mock_scoreboard.poll = AsyncMock()
        mock_scoreboard.close = AsyncMock()

        call_count = 0

        # First call: return a live game; second: return it as final
        async def collect_side_effect():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [{"game_id": "g1", "status": "live"}]
            return [{"game_id": "g1", "status": "final"}]

        mock_scoreboard.collect = AsyncMock(side_effect=collect_side_effect)

        mock_pbp = AsyncMock()
        mock_pbp.poll = AsyncMock()
        mock_pbp.close = AsyncMock()
        mock_pbp.new_play_count = 42

        iteration = 0

        async def mock_wait_for(coro, timeout):
            nonlocal iteration
            iteration += 1
            if iteration >= 2:
                raise asyncio.CancelledError()
            raise TimeoutError()

        with (
            patch("src.__main__.Settings", return_value=mock_settings),
            patch("src.__main__.KafkaProducer", return_value=mock_producer),
            patch("src.__main__.ScoreboardCollector", return_value=mock_scoreboard),
            patch("src.__main__.PlayByPlayCollector", return_value=mock_pbp),
            patch("src.__main__.asyncio.wait_for", side_effect=mock_wait_for),
            patch("src.__main__.asyncio.get_running_loop") as mock_loop,
        ):
            mock_loop.return_value.add_signal_handler = MagicMock()
            with pytest.raises(asyncio.CancelledError):
                await run()

    async def test_uses_pubsub_producer_when_pubsub_project_set(self):
        """settings.pubsub_project truthy → lazy-imports and builds a
        PubSubProducer instead of KafkaProducer (lines 34-37)."""
        mock_settings = MagicMock()
        mock_settings.pubsub_project = "my-gcp-project"

        mock_pubsub_producer = MagicMock()
        mock_scoreboard = AsyncMock()
        mock_scoreboard.poll = AsyncMock()
        mock_scoreboard.collect = AsyncMock(return_value=[])
        mock_scoreboard.close = AsyncMock()

        async def mock_wait_for(coro, timeout):
            raise asyncio.CancelledError()

        with (
            patch("src.__main__.Settings", return_value=mock_settings),
            patch(
                "src.producers.pubsub_producer.PubSubProducer",
                return_value=mock_pubsub_producer,
            ) as mock_pubsub_cls,
            patch("src.__main__.KafkaProducer") as mock_kafka_cls,
            patch("src.__main__.ScoreboardCollector", return_value=mock_scoreboard),
            patch("src.__main__.asyncio.wait_for", side_effect=mock_wait_for),
            patch("src.__main__.asyncio.get_running_loop") as mock_loop,
        ):
            mock_loop.return_value.add_signal_handler = MagicMock()
            with pytest.raises(asyncio.CancelledError):
                await run()
            mock_pubsub_cls.assert_called_once()
            mock_kafka_cls.assert_not_called()

    async def test_loops_exit_immediately_when_shutdown_already_set(self):
        """shutdown.is_set() already True on first check → both while loops
        (61->exit, 107->exit) exit without ever polling; run() returns
        normally via the finally block instead of raising."""
        mock_settings = MagicMock()
        mock_settings.pubsub_project = ""

        mock_producer = MagicMock()
        mock_scoreboard = AsyncMock()
        mock_scoreboard.poll = AsyncMock()
        mock_scoreboard.collect = AsyncMock(return_value=[])
        mock_scoreboard.close = AsyncMock()

        mock_event = MagicMock()
        mock_event.is_set.return_value = True
        mock_event.wait = AsyncMock()

        with (
            patch("src.__main__.Settings", return_value=mock_settings),
            patch("src.__main__.KafkaProducer", return_value=mock_producer),
            patch("src.__main__.ScoreboardCollector", return_value=mock_scoreboard),
            patch("src.__main__.asyncio.Event", return_value=mock_event),
            patch("src.__main__.asyncio.get_running_loop") as mock_loop,
        ):
            mock_loop.return_value.add_signal_handler = MagicMock()
            await run()  # returns cleanly, no CancelledError

        mock_scoreboard.poll.assert_not_awaited()
        mock_scoreboard.close.assert_awaited_once()

    async def test_scoreboard_error_is_caught_and_logged(self):
        """A generic exception from scoreboard.poll() is caught and logged
        (lines 97-98); the loop keeps going rather than crashing run()."""
        mock_settings = MagicMock()
        mock_settings.pubsub_project = ""

        mock_producer = MagicMock()
        mock_scoreboard = AsyncMock()
        mock_scoreboard.poll = AsyncMock(side_effect=RuntimeError("scoreboard boom"))
        mock_scoreboard.collect = AsyncMock(return_value=[])
        mock_scoreboard.close = AsyncMock()

        pbp_calls = 0

        async def mock_wait_for(coro, timeout):
            nonlocal pbp_calls
            if timeout == SCOREBOARD_INTERVAL:
                raise asyncio.CancelledError()
            # pbp_loop's own wait_for: give it a couple of harmless cycles
            # (proving the scoreboard exception didn't wedge it), then end
            # it too so its task actually finishes and gather can resolve.
            pbp_calls += 1
            if pbp_calls >= 3:
                raise asyncio.CancelledError()
            raise TimeoutError()

        with (
            patch("src.__main__.Settings", return_value=mock_settings),
            patch("src.__main__.KafkaProducer", return_value=mock_producer),
            patch("src.__main__.ScoreboardCollector", return_value=mock_scoreboard),
            patch("src.__main__.asyncio.wait_for", side_effect=mock_wait_for),
            patch("src.__main__.asyncio.get_running_loop") as mock_loop,
        ):
            mock_loop.return_value.add_signal_handler = MagicMock()
            with pytest.raises(asyncio.CancelledError):
                await run()

        mock_scoreboard.poll.assert_awaited()

    async def test_pbp_loop_polls_active_collector_and_closes_it_on_cancel(self):
        """A game that stays live across scoreboard cycles: created once
        (74->68 skip-recreate branch), polled by pbp_loop while active
        (113-120), and — since it is still in pbp_collectors when
        CancelledError unwinds run() — closed by the finally block's
        cleanup loop (127, 138)."""
        mock_settings = MagicMock()
        mock_settings.pubsub_project = ""

        mock_producer = MagicMock()
        mock_scoreboard = AsyncMock()
        mock_scoreboard.poll = AsyncMock()
        mock_scoreboard.collect = AsyncMock(return_value=[{"game_id": "g1", "status": "live"}])
        mock_scoreboard.close = AsyncMock()

        mock_pbp = AsyncMock()
        mock_pbp.poll = AsyncMock()
        mock_pbp.close = AsyncMock()
        mock_pbp.new_play_count = 3

        pbp_calls = 0
        scoreboard_calls = 0

        async def mock_wait_for(coro, timeout):
            nonlocal pbp_calls, scoreboard_calls
            if timeout == PBP_INTERVAL:
                # Let several pbp cycles run — each one polling the active
                # collector — before this side is cancelled too.
                pbp_calls += 1
                if pbp_calls >= 4:
                    raise asyncio.CancelledError()
                raise TimeoutError()
            # scoreboard_loop's own wait_for: one cycle creates the
            # collector, a second proves it isn't recreated, then cancel.
            scoreboard_calls += 1
            if scoreboard_calls >= 3:
                raise asyncio.CancelledError()
            raise TimeoutError()

        with (
            patch("src.__main__.Settings", return_value=mock_settings),
            patch("src.__main__.KafkaProducer", return_value=mock_producer),
            patch("src.__main__.ScoreboardCollector", return_value=mock_scoreboard),
            patch("src.__main__.PlayByPlayCollector", return_value=mock_pbp) as mock_pbp_cls,
            patch("src.__main__.asyncio.wait_for", side_effect=mock_wait_for),
            patch("src.__main__.asyncio.get_running_loop") as mock_loop,
        ):
            mock_loop.return_value.add_signal_handler = MagicMock()
            with pytest.raises(asyncio.CancelledError):
                await run()

        mock_pbp.poll.assert_awaited()
        mock_pbp.close.assert_awaited_once()
        # Constructed exactly once even though the game stayed "live" across
        # 2 scoreboard cycles — the second cycle took the `gid in
        # pbp_collectors` branch and skipped re-creation (line 74->68).
        mock_pbp_cls.assert_called_once()

    async def test_pbp_loop_error_is_caught_and_logged(self, capsys):
        """asyncio.gather(*(c.poll() ...)) raising synchronously (here: a
        collector whose .poll() returns a non-awaitable) is caught by
        pbp_loop's own except block (121-122), not left to crash run()."""
        mock_settings = MagicMock()
        mock_settings.pubsub_project = ""

        mock_producer = MagicMock()
        mock_scoreboard = AsyncMock()
        mock_scoreboard.poll = AsyncMock()
        mock_scoreboard.collect = AsyncMock(return_value=[{"game_id": "g1", "status": "live"}])
        mock_scoreboard.close = AsyncMock()

        mock_pbp = AsyncMock()
        mock_pbp.poll = MagicMock(return_value=42)  # not awaitable -> gather() raises TypeError
        mock_pbp.close = AsyncMock()
        mock_pbp.new_play_count = 0

        pbp_calls = 0
        scoreboard_calls = 0

        async def mock_wait_for(coro, timeout):
            nonlocal pbp_calls, scoreboard_calls
            if timeout == PBP_INTERVAL:
                pbp_calls += 1
                if pbp_calls >= 2:
                    raise asyncio.CancelledError()
                raise TimeoutError()
            scoreboard_calls += 1
            if scoreboard_calls >= 2:
                raise asyncio.CancelledError()
            raise TimeoutError()

        with (
            patch("src.__main__.Settings", return_value=mock_settings),
            patch("src.__main__.KafkaProducer", return_value=mock_producer),
            patch("src.__main__.ScoreboardCollector", return_value=mock_scoreboard),
            patch("src.__main__.PlayByPlayCollector", return_value=mock_pbp),
            patch("src.__main__.asyncio.wait_for", side_effect=mock_wait_for),
            patch("src.__main__.asyncio.get_running_loop") as mock_loop,
        ):
            mock_loop.return_value.add_signal_handler = MagicMock()
            with pytest.raises(asyncio.CancelledError):
                await run()

        assert "ingestion.pbp_error" in capsys.readouterr().out
