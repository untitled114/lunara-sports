"""Tests for backfill CLI entry point."""

from __future__ import annotations

import runpy
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.backfill import main


@pytest.mark.asyncio
class TestBackfillMain:
    async def test_no_args_prints_help(self):
        with patch("src.backfill.argparse.ArgumentParser") as MockParser:
            parser_instance = MagicMock()
            parser_instance.parse_args.return_value = MagicMock(game=None, start=None, end=None)
            MockParser.return_value = parser_instance
            with (
                patch("src.backfill.KafkaProducer") as MockProducer,
                patch("src.backfill.HistoricalLoader") as MockLoader,
            ):
                MockProducer.return_value = MagicMock()
                MockLoader.return_value = MagicMock()
                await main()
                parser_instance.print_help.assert_called()

    async def test_single_game(self):
        with patch("src.backfill.argparse.ArgumentParser") as MockParser:
            parser_instance = MagicMock()
            parser_instance.parse_args.return_value = MagicMock(
                game="401810001", start=None, end=None
            )
            MockParser.return_value = parser_instance

            mock_loader = AsyncMock()
            with (
                patch("src.backfill.KafkaProducer") as MockProducer,
                patch("src.backfill.HistoricalLoader", return_value=mock_loader),
            ):
                mock_producer = MagicMock()
                MockProducer.return_value = mock_producer
                await main()
                mock_loader.load_game.assert_called_once_with("401810001")
                mock_producer.flush.assert_called()

    async def test_date_range(self):
        with patch("src.backfill.argparse.ArgumentParser") as MockParser:
            parser_instance = MagicMock()
            parser_instance.parse_args.return_value = MagicMock(
                game=None, start="2026-02-01", end="2026-02-02"
            )
            MockParser.return_value = parser_instance

            mock_loader = AsyncMock()
            with (
                patch("src.backfill.KafkaProducer") as MockProducer,
                patch("src.backfill.HistoricalLoader", return_value=mock_loader),
            ):
                mock_producer = MagicMock()
                MockProducer.return_value = mock_producer
                await main()
                mock_loader.load_date_range.assert_called_once()
                mock_producer.flush.assert_called()


def test_module_guard_invokes_asyncio_run_with_main():
    """`if __name__ == "__main__": asyncio.run(main())` (backfill.py:51).

    asyncio.run is mocked so the coroutine it receives is never actually
    driven — main()'s own behavior is already fully characterized above by
    calling it directly. This test only characterizes the module-level
    entry-point wiring itself.
    """
    with patch("asyncio.run") as mock_run:
        runpy.run_module("src.backfill", run_name="__main__")
    mock_run.assert_called_once()
    (coro,) = mock_run.call_args.args
    assert coro.cr_code.co_name == "main"
    coro.close()  # avoid "coroutine was never awaited" leaking into other tests
