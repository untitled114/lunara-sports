"""Targeted tests to push coverage from 95% to 96%+."""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.olap_poller import run_olap_poller
from src.services.reaction_service import delete_reaction, get_play_game_id

# ── olap_poller — cover startup loop (lines 51-66) ──────────────────


class TestOlapPollerStartup:
    async def test_startup_catchup_and_loop(self):
        settings = MagicMock()
        settings.gcs_olap_bucket = "test-bucket"

        call_count = 0

        async def mock_export(bucket, export_date):
            nonlocal call_count
            call_count += 1

        async def mock_sleep(secs):
            raise asyncio.CancelledError()

        with (
            patch("src.services.olap_poller._export_date", side_effect=mock_export),
            patch("asyncio.sleep", side_effect=mock_sleep),
        ):
            with pytest.raises(asyncio.CancelledError):
                await run_olap_poller(settings)
            assert call_count == 2


# ── reaction_service — cover create/delete (lines 23-33, 75-76) ─────


class TestReactionServiceCoverage:
    async def test_delete_reaction(self, seeded_session):
        from src.db.models import Reaction

        reaction = Reaction(
            id=501,
            user_id=uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
            play_id=2,
            emoji="👀",
        )
        seeded_session.add(reaction)
        await seeded_session.commit()

        result = await delete_reaction(
            seeded_session,
            "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            2,
        )
        assert result is True

    async def test_delete_nonexistent(self, seeded_session):
        result = await delete_reaction(seeded_session, str(uuid.uuid4()), 999)
        assert result is False

    async def test_get_play_game_id(self, seeded_session):
        game_id = await get_play_game_id(seeded_session, 1)
        assert game_id == "401810001"

    async def test_get_play_game_id_not_found(self, seeded_session):
        game_id = await get_play_game_id(seeded_session, 99999)
        assert game_id is None


# ── prediction_service — cover create + resolve (lines 34-42, 70-104) ─


class TestPredictionServiceCoverage:
    async def test_create_prediction(self, seeded_session):
        from src.services.prediction_service import create_prediction

        user_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        pred = await create_prediction(
            seeded_session,
            user_id,
            "401810001",
            "winner",
            "BOS",
        )
        assert pred.game_id == "401810001"

    async def test_resolve_not_found(self, seeded_session):
        from src.services.prediction_service import resolve_prediction

        await resolve_prediction(seeded_session, str(uuid.uuid4()), True, 10)


# ── play_poller — cover run loop (lines 107-113) ─────────────────────


class TestPlayPollerLoopCoverage:
    async def test_run_loop_handles_error(self):
        from src.ws.play_poller import run_play_poller

        call_count = 0

        async def mock_poll():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("test error")
            raise asyncio.CancelledError()

        async def mock_sleep(secs):
            pass

        with (
            patch("src.ws.play_poller._poll_once", side_effect=mock_poll),
            patch("asyncio.sleep", side_effect=mock_sleep),
        ):
            with pytest.raises(asyncio.CancelledError):
                await run_play_poller()

    async def test_poll_broadcasts_plays(self, session_factory):
        from src.db.models import Play
        from src.ws.play_poller import _poll_once, _watermarks

        async with session_factory() as sess:
            sess.add(
                Play(
                    id=200,
                    game_id="poll-game",
                    sequence_number=5,
                    quarter=1,
                    clock="10:00",
                    event_type="shot",
                    description="Test shot",
                    team="BOS",
                    home_score=10,
                    away_score=8,
                )
            )
            await sess.commit()

        _watermarks["poll-game"] = 0

        mock_manager = MagicMock()
        mock_manager.active_games.return_value = ["poll-game"]
        mock_manager.broadcast = AsyncMock()

        with (
            patch("src.ws.play_poller.manager", mock_manager),
            patch("src.ws.play_poller.get_session_factory", return_value=session_factory),
        ):
            await _poll_once()
            mock_manager.broadcast.assert_called()
            assert _watermarks["poll-game"] == 5
