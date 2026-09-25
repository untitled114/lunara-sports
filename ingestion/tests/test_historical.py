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
    return s


@pytest.fixture
def mock_sink():
    sink = MagicMock()
    sink.produce = MagicMock()
    sink.flush = AsyncMock()
    sink.close = AsyncMock()
    return sink


@pytest.fixture
def mock_http():
    return AsyncMock()


class TestHistoricalLoader:
    def test_init(self, mock_settings, mock_sink, mock_http):
        loader = HistoricalLoader(mock_settings, mock_sink, mock_http)
        assert loader.settings is mock_settings
        assert loader.sink is mock_sink
        assert loader.http is mock_http

    @pytest.mark.asyncio
    async def test_load_game(self, mock_settings, mock_sink, mock_http):
        loader = HistoricalLoader(mock_settings, mock_sink, mock_http)
        with patch.object(loader, "_load_single_game_pbp", new_callable=AsyncMock, return_value=25):
            await loader.load_game("401810001")

    @pytest.mark.asyncio
    async def test_load_single_game_pbp(self, mock_settings, mock_sink, mock_http):
        loader = HistoricalLoader(mock_settings, mock_sink, mock_http)
        mock_collector = AsyncMock()
        mock_collector.new_play_count = 10
        mock_collector.poll = AsyncMock()
        mock_collector.close = AsyncMock()
        with patch(
            "src.collectors.historical.PlayByPlayCollector", return_value=mock_collector
        ) as pbp_cls:
            count = await loader._load_single_game_pbp("401810001")
        assert count == 10
        pbp_cls.assert_called_once_with(
            mock_settings, mock_sink, game_id="401810001", http=mock_http
        )
        mock_collector.poll.assert_awaited_once()
        mock_collector.close.assert_awaited_once()
        mock_http.aclose.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_load_date_range(self, mock_settings, mock_sink, mock_http):
        loader = HistoricalLoader(mock_settings, mock_sink, mock_http)
        mock_scoreboard = AsyncMock()
        mock_scoreboard.collect = AsyncMock(
            return_value=[
                {"game_id": "g1", "status": "final"},
            ]
        )
        mock_scoreboard.close = AsyncMock()

        with (
            patch(
                "src.collectors.historical.ScoreboardCollector", return_value=mock_scoreboard
            ) as sb_cls,
            patch.object(
                loader, "_load_single_game_pbp", new_callable=AsyncMock, return_value=5
            ) as pbp,
            patch("src.collectors.historical.asyncio.sleep", new_callable=AsyncMock),
        ):
            await loader.load_date_range(date(2026, 2, 20), date(2026, 2, 20))
        sb_cls.assert_called_once_with(mock_settings, mock_sink, mock_http)
        mock_sink.produce.assert_called_once_with(
            topic="raw.scoreboard", key="g1", value={"game_id": "g1", "status": "final"}
        )
        mock_sink.flush.assert_awaited_once()
        mock_scoreboard.close.assert_awaited_once()
        pbp.assert_awaited_once_with("g1")
        mock_http.aclose.assert_not_awaited()
        assert mock_settings.espn_date is None  # override restored

    @pytest.mark.asyncio
    async def test_load_date_range_queries_each_date_in_turn(
        self, mock_settings, mock_sink, mock_http
    ):
        loader = HistoricalLoader(mock_settings, mock_sink, mock_http)
        seen: list[str] = []
        mock_scoreboard = AsyncMock()

        async def collect():
            seen.append(mock_settings.espn_date)
            return []

        mock_scoreboard.collect = AsyncMock(side_effect=collect)
        with (
            patch("src.collectors.historical.ScoreboardCollector", return_value=mock_scoreboard),
            patch("src.collectors.historical.asyncio.sleep", new_callable=AsyncMock),
        ):
            await loader.load_date_range(date(2026, 2, 28), date(2026, 3, 1))
        assert seen == ["20260228", "20260301"]
        assert mock_settings.espn_date is None

    @pytest.mark.asyncio
    async def test_load_date_range_skips_non_final(self, mock_settings, mock_sink, mock_http):
        loader = HistoricalLoader(mock_settings, mock_sink, mock_http)
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
    async def test_load_date_range_handles_scoreboard_error(
        self, mock_settings, mock_sink, mock_http
    ):
        loader = HistoricalLoader(mock_settings, mock_sink, mock_http)
        mock_scoreboard = AsyncMock()
        mock_scoreboard.collect = AsyncMock(side_effect=Exception("API error"))
        mock_scoreboard.close = AsyncMock()

        with (
            patch("src.collectors.historical.ScoreboardCollector", return_value=mock_scoreboard),
            patch("src.collectors.historical.asyncio.sleep", new_callable=AsyncMock),
        ):
            await loader.load_date_range(date(2026, 2, 20), date(2026, 2, 20))
        mock_sink.produce.assert_not_called()
        mock_scoreboard.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_load_date_range_handles_flush_error(self, mock_settings, mock_sink, mock_http):
        """A sink flush failure is logged like any scoreboard error; the
        date's games are then treated as empty (no PBP attempted)."""
        loader = HistoricalLoader(mock_settings, mock_sink, mock_http)
        mock_sink.flush.side_effect = RuntimeError("db down")
        mock_scoreboard = AsyncMock()
        mock_scoreboard.collect = AsyncMock(return_value=[{"game_id": "g1", "status": "final"}])
        with (
            patch("src.collectors.historical.ScoreboardCollector", return_value=mock_scoreboard),
            patch.object(loader, "_load_single_game_pbp", new_callable=AsyncMock) as pbp,
            patch("src.collectors.historical.asyncio.sleep", new_callable=AsyncMock),
        ):
            await loader.load_date_range(date(2026, 2, 20), date(2026, 2, 20))
        pbp.assert_not_awaited()
        mock_scoreboard.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_load_date_range_handles_pbp_error(self, mock_settings, mock_sink, mock_http):
        loader = HistoricalLoader(mock_settings, mock_sink, mock_http)
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
