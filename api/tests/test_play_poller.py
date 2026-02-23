"""Tests for play_poller — WebSocket play broadcasting."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from src.db.models import Play
from src.ws.play_poller import _play_to_dict, get_recent_plays


class TestPlayToDict:
    def test_full_play(self):
        play = Play(
            id=1,
            game_id="g1",
            sequence_number=10,
            quarter=2,
            clock="5:30",
            event_type="jump_shot",
            description="Tatum jumper",
            team="BOS",
            player_name="Jayson Tatum",
            home_score=30,
            away_score=28,
            created_at=datetime(2026, 2, 20, 1, 0, tzinfo=timezone.utc),
        )
        d = _play_to_dict(play)
        assert d["id"] == 1
        assert d["game_id"] == "g1"
        assert d["sequence_number"] == 10
        assert d["quarter"] == 2
        assert d["clock"] == "5:30"
        assert d["event_type"] == "jump_shot"
        assert d["player_name"] == "Jayson Tatum"
        assert d["home_score"] == 30
        assert d["away_score"] == 28
        assert "2026-02-20" in d["created_at"]

    def test_none_created_at(self):
        play = Play(id=2, game_id="g1", sequence_number=1, quarter=1, created_at=None)
        d = _play_to_dict(play)
        assert d["created_at"] is None


@pytest.mark.asyncio
class TestGetRecentPlays:
    async def test_no_factory(self):
        with patch("src.ws.play_poller.get_session_factory", return_value=None):
            result = await get_recent_plays("g1")
            assert result == []

    async def test_returns_plays(self, session_factory):
        # Seed some plays
        async with session_factory() as sess:
            sess.add_all(
                [
                    Play(id=10, game_id="gtest", sequence_number=1, quarter=1),
                    Play(id=11, game_id="gtest", sequence_number=2, quarter=1),
                ]
            )
            await sess.commit()

        with patch("src.ws.play_poller.get_session_factory", return_value=session_factory):
            plays = await get_recent_plays("gtest", limit=10)
            assert len(plays) == 2
            # Should be in ascending order
            assert plays[0]["sequence_number"] <= plays[1]["sequence_number"]
