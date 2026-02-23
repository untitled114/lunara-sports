"""Tests for __main__ — ingestion orchestrator."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.__main__ import LIVE_STATUSES, run


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
