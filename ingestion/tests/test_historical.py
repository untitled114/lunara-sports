"""Tests for historical loader and backfill."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.collectors.historical import HistoricalLoader


@pytest.fixture
def mock_settings():
    s = MagicMock()
    s.espn_date = None
    s.kafka_bootstrap_servers = "localhost:9092"
    s.schema_registry_url = "http://localhost:8081"
    return s


@pytest.fixture
def mock_producer():
    p = MagicMock()
    p.produce = MagicMock()
    p.flush = MagicMock()
    return p


class TestHistoricalLoader:
    def test_init(self, mock_settings, mock_producer):
        loader = HistoricalLoader(mock_settings, mock_producer)
        assert loader.settings is mock_settings
        assert loader.producer is mock_producer

    @pytest.mark.asyncio
    async def test_load_game(self, mock_settings, mock_producer):
        loader = HistoricalLoader(mock_settings, mock_producer)
        with patch.object(loader, "_load_single_game_pbp", new_callable=AsyncMock, return_value=25):
            await loader.load_game("401810001")

    @pytest.mark.asyncio
    async def test_load_single_game_pbp(self, mock_settings, mock_producer):
        loader = HistoricalLoader(mock_settings, mock_producer)
        mock_collector = AsyncMock()
        mock_collector.new_play_count = 10
        mock_collector.poll = AsyncMock()
        mock_collector.close = AsyncMock()
        with patch("src.collectors.historical.PlayByPlayCollector", return_value=mock_collector):
            count = await loader._load_single_game_pbp("401810001")
            assert count == 10
            mock_collector.poll.assert_called_once()
            mock_collector.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_load_date_range(self, mock_settings, mock_producer):
        loader = HistoricalLoader(mock_settings, mock_producer)
        mock_scoreboard = AsyncMock()
        mock_scoreboard.collect = AsyncMock(
            return_value=[
                {"game_id": "g1", "status": "final"},
            ]
        )
        mock_scoreboard.close = AsyncMock()

        with (
            patch("src.collectors.historical.ScoreboardCollector", return_value=mock_scoreboard),
            patch.object(loader, "_load_single_game_pbp", new_callable=AsyncMock, return_value=5),
            patch("src.collectors.historical.asyncio.sleep", new_callable=AsyncMock),
        ):
            await loader.load_date_range(date(2026, 2, 20), date(2026, 2, 20))
            mock_producer.flush.assert_called()

    @pytest.mark.asyncio
    async def test_load_date_range_skips_non_final(self, mock_settings, mock_producer):
        loader = HistoricalLoader(mock_settings, mock_producer)
        mock_scoreboard = AsyncMock()
        mock_scoreboard.collect = AsyncMock(
            return_value=[
                {"game_id": "g1", "status": "scheduled"},
            ]
        )
        mock_scoreboard.close = AsyncMock()

        with (
            patch("src.collectors.historical.ScoreboardCollector", return_value=mock_scoreboard),
            patch.object(loader, "_load_single_game_pbp", new_callable=AsyncMock) as mock_pbp,
            patch("src.collectors.historical.asyncio.sleep", new_callable=AsyncMock),
        ):
            await loader.load_date_range(date(2026, 2, 20), date(2026, 2, 20))
            mock_pbp.assert_not_called()

    @pytest.mark.asyncio
    async def test_load_date_range_handles_scoreboard_error(self, mock_settings, mock_producer):
        loader = HistoricalLoader(mock_settings, mock_producer)
        mock_scoreboard = AsyncMock()
        mock_scoreboard.collect = AsyncMock(side_effect=Exception("API error"))
        mock_scoreboard.close = AsyncMock()

        with (
            patch("src.collectors.historical.ScoreboardCollector", return_value=mock_scoreboard),
            patch("src.collectors.historical.asyncio.sleep", new_callable=AsyncMock),
        ):
            await loader.load_date_range(date(2026, 2, 20), date(2026, 2, 20))

    @pytest.mark.asyncio
    async def test_load_date_range_handles_pbp_error(self, mock_settings, mock_producer):
        loader = HistoricalLoader(mock_settings, mock_producer)
        mock_scoreboard = AsyncMock()
        mock_scoreboard.collect = AsyncMock(
            return_value=[
                {"game_id": "g1", "status": "final"},
            ]
        )
        mock_scoreboard.close = AsyncMock()

        with (
            patch("src.collectors.historical.ScoreboardCollector", return_value=mock_scoreboard),
            patch.object(
                loader,
                "_load_single_game_pbp",
                new_callable=AsyncMock,
                side_effect=Exception("PBP fail"),
            ),
            patch("src.collectors.historical.asyncio.sleep", new_callable=AsyncMock),
        ):
            await loader.load_date_range(date(2026, 2, 20), date(2026, 2, 20))
