"""Extra tests for play_poller — covering uncovered paths."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from src.ws.play_poller import (
    _poll_once,
    _watermarks,
    get_recent_plays,
    poll_once,
)


class TestPollOnceExtra:
    async def test_no_active_games(self):
        with patch("src.ws.play_poller.manager") as mock_manager:
            mock_manager.active_games.return_value = []
            await _poll_once()

    async def test_no_session_factory(self):
        with (
            patch("src.ws.play_poller.manager") as mock_manager,
            patch("src.ws.play_poller.get_session_factory", return_value=None),
        ):
            mock_manager.active_games.return_value = ["game-1"]
            await _poll_once()

    async def test_no_new_plays_for_active_game_skips_broadcast(self, session_factory):
        """An active game with no plays past its watermark takes the
        `continue` branch (line 88) instead of broadcasting."""
        _watermarks.pop("gtest-empty", None)
        try:
            with (
                patch("src.ws.play_poller.manager") as mock_manager,
                patch("src.ws.play_poller.get_session_factory", return_value=session_factory),
            ):
                mock_manager.active_games.return_value = ["gtest-empty"]
                mock_manager.broadcast = AsyncMock()
                await _poll_once()
                mock_manager.broadcast.assert_not_called()
        finally:
            _watermarks.pop("gtest-empty", None)


class TestPollOnceExplicitFactory:
    async def test_uses_given_factory_not_app_factory(self, session_factory):
        """poll_once(factory) queries the factory it is given; the app-level
        factory is never consulted (the integration test relies on this)."""
        from src.db.models import Play

        async with session_factory() as sess:
            sess.add(Play(id=900, game_id="g-explicit", sequence_number=3, quarter=1))
            await sess.commit()
        _watermarks.pop("g-explicit", None)
        try:
            with (
                patch("src.ws.play_poller.manager") as mock_manager,
                patch("src.ws.play_poller.get_session_factory") as app_factory,
            ):
                mock_manager.active_games.return_value = ["g-explicit"]
                mock_manager.broadcast = AsyncMock()
                await poll_once(session_factory)
                app_factory.assert_not_called()
                mock_manager.broadcast.assert_awaited_once()
                gid, msg = mock_manager.broadcast.await_args.args
                assert gid == "g-explicit"
                assert msg["type"] == "play"
                assert msg["data"]["sequence_number"] == 3
                assert _watermarks["g-explicit"] == 3
        finally:
            _watermarks.pop("g-explicit", None)

    async def test_none_factory_is_a_no_op(self):
        with patch("src.ws.play_poller.manager") as mock_manager:
            mock_manager.active_games.return_value = ["g1"]
            mock_manager.broadcast = AsyncMock()
            await poll_once(None)
            mock_manager.broadcast.assert_not_called()


class TestGetRecentPlaysExtra:
    async def test_no_session_factory(self):
        with patch("src.ws.play_poller.get_session_factory", return_value=None):
            result = await get_recent_plays("game-1")
            assert result == []
