"""Extra tests for play_poller — covering uncovered paths."""

from __future__ import annotations

from unittest.mock import patch

from src.ws.play_poller import (
    _play_to_dict_raw,
    _poll_once,
    get_recent_plays,
)


class TestPlayToDictRaw:
    def test_converts_raw_dict(self):
        data = {
            "id": 1,
            "game_id": "g1",
            "sequence_number": 10,
            "quarter": 1,
            "clock": "12:00",
            "event_type": "jump_ball",
            "description": "Tip-off",
            "team": "BOS",
            "player_name": "Tatum",
            "home_score": 0,
            "away_score": 0,
        }
        result = _play_to_dict_raw(data)
        assert result["id"] == 1
        assert result["game_id"] == "g1"
        assert result["created_at"] is None

    def test_handles_missing_keys(self):
        result = _play_to_dict_raw({})
        assert result["id"] is None


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


class TestGetRecentPlaysExtra:
    async def test_no_session_factory(self):
        with patch("src.ws.play_poller.get_session_factory", return_value=None):
            result = await get_recent_plays("game-1")
            assert result == []
