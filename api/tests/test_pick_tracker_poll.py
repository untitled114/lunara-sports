"""Tests for _poll_pick_tracker and run_pick_tracker_poller."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.pick_tracker_poller import _poll_pick_tracker, run_pick_tracker_poller


class TestPollPickTracker:
    async def test_no_session_factory(self):
        with patch("src.services.pick_tracker_poller.get_session_factory", return_value=None):
            await _poll_pick_tracker()

    async def test_no_pending_picks(self):
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch(
            "src.services.pick_tracker_poller.get_session_factory", return_value=mock_factory
        ):
            await _poll_pick_tracker()

    async def test_skips_scheduled_games(self):
        mock_pick = MagicMock()
        mock_pick.game_id = "game-1"
        mock_pick.is_hit = None

        mock_game = MagicMock()
        mock_game.id = "game-1"
        mock_game.status = "scheduled"

        mock_session = AsyncMock()

        # First execute returns picks, second returns games
        picks_result = MagicMock()
        picks_result.scalars.return_value.all.return_value = [mock_pick]

        games_result = MagicMock()
        games_result.scalars.return_value.all.return_value = [mock_game]

        mock_session.execute = AsyncMock(side_effect=[picks_result, games_result])

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch(
            "src.services.pick_tracker_poller.get_session_factory", return_value=mock_factory
        ):
            await _poll_pick_tracker()

    async def test_processes_live_games(self):
        mock_pick = MagicMock()
        mock_pick.game_id = "game-1"
        mock_pick.is_hit = None

        mock_game = MagicMock()
        mock_game.id = "game-1"
        mock_game.status = "live"

        mock_session = AsyncMock()

        picks_result = MagicMock()
        picks_result.scalars.return_value.all.return_value = [mock_pick]

        games_result = MagicMock()
        games_result.scalars.return_value.all.return_value = [mock_game]

        mock_session.execute = AsyncMock(side_effect=[picks_result, games_result])

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with (
            patch(
                "src.services.pick_tracker_poller.get_session_factory", return_value=mock_factory
            ),
            patch(
                "src.services.pick_tracker_poller._update_picks_for_game",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            await _poll_pick_tracker()

    async def test_broadcasts_updates(self):
        mock_pick = MagicMock()
        mock_pick.game_id = "game-1"
        mock_pick.is_hit = None

        mock_game = MagicMock()
        mock_game.id = "game-1"
        mock_game.status = "final"

        mock_session = AsyncMock()

        picks_result = MagicMock()
        picks_result.scalars.return_value.all.return_value = [mock_pick]

        games_result = MagicMock()
        games_result.scalars.return_value.all.return_value = [mock_game]

        mock_session.execute = AsyncMock(side_effect=[picks_result, games_result])

        updated_pick = {
            "id": 1,
            "game_id": "game-1",
            "player_name": "Test",
            "market": "POINTS",
            "line": 25.5,
            "prediction": "OVER",
            "actual_value": 30,
            "is_hit": True,
            "tier": "X",
            "model_version": "xl",
            "book": "DK",
        }

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with (
            patch(
                "src.services.pick_tracker_poller.get_session_factory", return_value=mock_factory
            ),
            patch(
                "src.services.pick_tracker_poller._update_picks_for_game",
                new_callable=AsyncMock,
                return_value=[updated_pick],
            ),
            patch("src.services.pick_tracker_poller.manager") as mock_manager,
        ):
            mock_manager.broadcast = AsyncMock()
            await _poll_pick_tracker()
            mock_session.commit.assert_called_once()
            mock_manager.broadcast.assert_called_once()

    async def test_game_not_in_db(self):
        mock_pick = MagicMock()
        mock_pick.game_id = "game-missing"
        mock_pick.is_hit = None

        mock_session = AsyncMock()
        picks_result = MagicMock()
        picks_result.scalars.return_value.all.return_value = [mock_pick]

        games_result = MagicMock()
        games_result.scalars.return_value.all.return_value = []

        mock_session.execute = AsyncMock(side_effect=[picks_result, games_result])

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch(
            "src.services.pick_tracker_poller.get_session_factory", return_value=mock_factory
        ):
            await _poll_pick_tracker()


class TestRunPickTrackerPoller:
    async def test_runs_and_handles_error(self):
        call_count = 0

        async def mock_poll(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("test error")
            raise asyncio.CancelledError()

        with (
            patch("src.services.pick_tracker_poller._poll_pick_tracker", side_effect=mock_poll),
            patch("src.services.pick_tracker_poller.POLL_INTERVAL", 0),
        ):
            with pytest.raises(asyncio.CancelledError):
                await run_pick_tracker_poller(None)

    async def test_uses_settings(self):
        settings = MagicMock()
        settings.sport_suite_api_url = "http://example.com"
        settings.sport_suite_api_key = "key123"

        async def mock_poll(**kwargs):
            assert kwargs.get("api_url") == "http://example.com"
            raise asyncio.CancelledError()

        with (
            patch("src.services.pick_tracker_poller._poll_pick_tracker", side_effect=mock_poll),
            patch("src.services.pick_tracker_poller.POLL_INTERVAL", 0),
        ):
            with pytest.raises(asyncio.CancelledError):
                await run_pick_tracker_poller(settings)
