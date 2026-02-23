"""Final coverage push — prediction_service, session, and remaining service gaps."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.db.models import Game, Leaderboard, Team, User
from src.db.session import close_db, init_db
from src.services.prediction_service import (
    create_prediction,
    get_leaderboard,
    get_user_predictions,
)


@pytest.fixture
async def pred_session(session):
    """Session with user, team, game for prediction tests."""
    uid = uuid.UUID("aaaaaaaa-1111-2222-3333-444444444444")
    session.add_all(
        [
            Team(abbrev="BOS", name="Boston Celtics"),
            Team(abbrev="LAL", name="Los Angeles Lakers"),
        ]
    )
    await session.flush()
    session.add(
        Game(
            id="pred_g",
            home_team="BOS",
            away_team="LAL",
            status="live",
            start_time=datetime(2026, 2, 20, 0, 0, tzinfo=timezone.utc),
        )
    )
    await session.flush()
    session.add(User(id=uid, username="predictor", display_name="Predictor"))
    await session.flush()
    session.add(
        Leaderboard(
            user_id=uid,
            season="2025-2026",
            total_points=100,
            correct_predictions=20,
            total_predictions=40,
            streak=3,
            rank=1,
        )
    )
    await session.commit()
    return session


# ── Prediction Service ────────────────────────────────────────────────


@pytest.mark.asyncio
class TestPredictionService:
    async def test_create_prediction(self, pred_session):
        uid = "aaaaaaaa-1111-2222-3333-444444444444"
        pred = await create_prediction(pred_session, uid, "pred_g", "winner", "BOS")
        assert pred.id is not None
        assert pred.prediction_value == "BOS"
        assert pred.game_id == "pred_g"

    async def test_get_user_predictions(self, pred_session):
        uid = "aaaaaaaa-1111-2222-3333-444444444444"
        await create_prediction(pred_session, uid, "pred_g", "winner", "BOS")
        preds = await get_user_predictions(pred_session, uid)
        assert len(preds) >= 1

    async def test_get_leaderboard(self, pred_session):
        lb = await get_leaderboard(pred_session, "2025-2026")
        assert len(lb) == 1
        assert lb[0]["username"] == "predictor"
        assert lb[0]["total_points"] == 100


# ── DB Session init/close ─────────────────────────────────────────────


class TestDbInitClose:
    def test_init_db_creates_engine(self):
        import src.db.session as sess_mod

        old_engine = sess_mod._engine
        old_factory = sess_mod._session_factory
        try:
            # Mock create_async_engine to avoid actual connection
            mock_engine = MagicMock()
            with patch("src.db.session.create_async_engine", return_value=mock_engine):
                settings = MagicMock()
                settings.database_url = "postgresql+asyncpg://test@localhost/test"
                init_db(settings)
                assert sess_mod._engine is mock_engine
                assert sess_mod._session_factory is not None
        finally:
            sess_mod._engine = old_engine
            sess_mod._session_factory = old_factory

    @pytest.mark.asyncio
    async def test_close_db_disposes(self):
        import src.db.session as sess_mod

        mock_engine = AsyncMock()
        sess_mod._engine = mock_engine
        sess_mod._session_factory = MagicMock()
        await close_db()
        mock_engine.dispose.assert_called_once()
        assert sess_mod._engine is None
        assert sess_mod._session_factory is None
