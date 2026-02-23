"""Tests for pick_sync_poller — background daily sync."""

from __future__ import annotations

import asyncio
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.pick_sync_poller import _eastern_today, run_pick_sync_poller


class TestEasternToday:
    def test_returns_date(self):
        result = _eastern_today()
        assert isinstance(result, date)


@pytest.mark.asyncio
class TestRunPickSyncPoller:
    async def test_disabled_without_predictions_dir(self):
        settings = MagicMock()
        settings.sport_suite_predictions_dir = ""
        # Should return immediately
        await run_pick_sync_poller(settings)

    async def test_syncs_and_sets_last_date(self):
        settings = MagicMock()
        settings.sport_suite_predictions_dir = "/tmp/predictions"

        mock_session = AsyncMock()
        mock_factory = MagicMock(
            return_value=AsyncMock(
                __aenter__=AsyncMock(return_value=mock_session),
                __aexit__=AsyncMock(return_value=False),
            )
        )

        call_count = 0

        async def limited_sleep(seconds):
            nonlocal call_count
            call_count += 1
            if call_count >= 2:
                raise asyncio.CancelledError()

        with (
            patch("src.services.pick_sync_poller.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.pick_sync_poller.sync_picks", new_callable=AsyncMock, return_value=5
            ),
            patch("src.services.pick_sync_poller.asyncio.sleep", side_effect=limited_sleep),
        ):
            with pytest.raises(asyncio.CancelledError):
                await run_pick_sync_poller(settings)

    async def test_continues_on_error(self):
        settings = MagicMock()
        settings.sport_suite_predictions_dir = "/tmp/predictions"

        call_count = 0

        async def limited_sleep(seconds):
            nonlocal call_count
            call_count += 1
            if call_count >= 2:
                raise asyncio.CancelledError()

        with (
            patch(
                "src.services.pick_sync_poller.get_session_factory", side_effect=Exception("boom")
            ),
            patch("src.services.pick_sync_poller.asyncio.sleep", side_effect=limited_sleep),
        ):
            with pytest.raises(asyncio.CancelledError):
                await run_pick_sync_poller(settings)
