"""Tests for backfill CLI entry point."""

from __future__ import annotations

import runpy
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.backfill import main


def _args(**kw):
    base = {"game": None, "start": None, "end": None}
    base.update(kw)
    return MagicMock(**base)


def _io():
    sink = MagicMock()
    sink.flush = AsyncMock()
    sink.close = AsyncMock()
    http = AsyncMock()
    return sink, http


@pytest.mark.asyncio
class TestBackfillMain:
    async def test_no_args_prints_help_without_opening_io(self):
        with patch("src.backfill.argparse.ArgumentParser") as MockParser:
            parser_instance = MagicMock()
            parser_instance.parse_args.return_value = _args()
            MockParser.return_value = parser_instance
            with (
                patch("src.backfill.build_io", new_callable=AsyncMock) as mock_build_io,
                patch("src.backfill.HistoricalLoader") as MockLoader,
            ):
                await main()
        parser_instance.print_help.assert_called()
        mock_build_io.assert_not_awaited()  # no DB pool / HTTP clients for --help
        MockLoader.assert_not_called()

    async def test_single_game(self):
        sink, http = _io()
        with patch("src.backfill.argparse.ArgumentParser") as MockParser:
            parser_instance = MagicMock()
            parser_instance.parse_args.return_value = _args(game="401810001")
            MockParser.return_value = parser_instance

            mock_loader = AsyncMock()
            with (
                patch("src.backfill.Settings") as MockSettings,
                patch("src.backfill.build_io", new_callable=AsyncMock, return_value=(sink, http)),
                patch("src.backfill.HistoricalLoader", return_value=mock_loader) as MockLoader,
            ):
                await main()
        MockLoader.assert_called_once_with(MockSettings.return_value, sink, http)
        mock_loader.load_game.assert_awaited_once_with("401810001")
        sink.close.assert_awaited_once()
        http.aclose.assert_awaited_once()

    async def test_date_range(self):
        sink, http = _io()
        with patch("src.backfill.argparse.ArgumentParser") as MockParser:
            parser_instance = MagicMock()
            parser_instance.parse_args.return_value = _args(start="2026-02-01", end="2026-02-02")
            MockParser.return_value = parser_instance

            mock_loader = AsyncMock()
            with (
                patch("src.backfill.Settings"),
                patch("src.backfill.build_io", new_callable=AsyncMock, return_value=(sink, http)),
                patch("src.backfill.HistoricalLoader", return_value=mock_loader),
            ):
                await main()
        mock_loader.load_date_range.assert_awaited_once_with(date(2026, 2, 1), date(2026, 2, 2))
        sink.close.assert_awaited_once()
        http.aclose.assert_awaited_once()

    async def test_loader_failure_still_closes_sink_and_http(self):
        sink, http = _io()
        with patch("src.backfill.argparse.ArgumentParser") as MockParser:
            parser_instance = MagicMock()
            parser_instance.parse_args.return_value = _args(game="401810001")
            MockParser.return_value = parser_instance

            mock_loader = AsyncMock()
            mock_loader.load_game.side_effect = RuntimeError("espn down")
            with (
                patch("src.backfill.Settings"),
                patch("src.backfill.build_io", new_callable=AsyncMock, return_value=(sink, http)),
                patch("src.backfill.HistoricalLoader", return_value=mock_loader),
                pytest.raises(RuntimeError, match="espn down"),
            ):
                await main()
        sink.close.assert_awaited_once()
        http.aclose.assert_awaited_once()

    async def test_sink_close_failure_still_closes_http(self):
        sink, http = _io()
        sink.close.side_effect = RuntimeError("db down")
        with patch("src.backfill.argparse.ArgumentParser") as MockParser:
            parser_instance = MagicMock()
            parser_instance.parse_args.return_value = _args(game="401810001")
            MockParser.return_value = parser_instance
            with (
                patch("src.backfill.Settings"),
                patch("src.backfill.build_io", new_callable=AsyncMock, return_value=(sink, http)),
                patch("src.backfill.HistoricalLoader", return_value=AsyncMock()),
                pytest.raises(RuntimeError, match="db down"),
            ):
                await main()
        http.aclose.assert_awaited_once()


def test_module_guard_invokes_asyncio_run_with_main():
    """`if __name__ == "__main__": asyncio.run(main())`.

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
