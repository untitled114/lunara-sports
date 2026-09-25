"""Tests for prediction_service — create, get, resolve, leaderboard."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from src.db.models import Leaderboard
from src.services.prediction_service import (
    create_prediction,
    get_user_predictions,
    resolve_prediction,
)


class TestCreatePrediction:
    async def test_creates_prediction(self, seeded_session):
        user_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        pred = await create_prediction(
            seeded_session,
            user_id=user_id,
            game_id="401810001",
            prediction_type="winner",
            prediction_value="BOS",
        )
        assert pred.game_id == "401810001"
        assert pred.prediction_type == "winner"
        assert pred.prediction_value == "BOS"
        assert pred.user_id == uuid.UUID(user_id)


class TestGetUserPredictions:
    async def test_returns_predictions(self, seeded_session):
        user_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        # Create a prediction first
        await create_prediction(
            seeded_session,
            user_id=user_id,
            game_id="401810001",
            prediction_type="winner",
            prediction_value="BOS",
        )
        preds = await get_user_predictions(seeded_session, user_id)
        assert len(preds) >= 1

    async def test_empty_for_unknown_user(self, seeded_session):
        preds = await get_user_predictions(seeded_session, str(uuid.uuid4()))
        assert preds == []


class TestResolvePrediction:
    async def test_resolves_correctly(self, seeded_session):
        """Resolving a correct prediction updates it and upserts the leaderboard."""
        user_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        pred = await create_prediction(
            seeded_session,
            user_id=user_id,
            game_id="401810001",
            prediction_type="total",
            prediction_value="OVER",
        )
        await resolve_prediction(seeded_session, str(pred.id), is_correct=True, points_awarded=10)
        await seeded_session.refresh(pred)
        assert pred.is_correct is True
        assert pred.points_awarded == 10
        assert pred.resolved_at is not None

        season = f"{pred.resolved_at.year}-{pred.resolved_at.year + 1}"
        rows = (
            (
                await seeded_session.execute(
                    select(Leaderboard).where(
                        Leaderboard.user_id == uuid.UUID(user_id),
                        Leaderboard.season == season,
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(rows) == 1
        assert rows[0].total_points == 10
        assert rows[0].correct_predictions == 1
        assert rows[0].streak == 1

    async def test_resolve_incorrect_does_not_increment_streak(self, seeded_session):
        user_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        pred = await create_prediction(
            seeded_session,
            user_id=user_id,
            game_id="401810001",
            prediction_type="total",
            prediction_value="UNDER",
        )
        await resolve_prediction(seeded_session, str(pred.id), is_correct=False, points_awarded=0)
        await seeded_session.refresh(pred)
        assert pred.is_correct is False
        assert pred.points_awarded == 0

        season = f"{pred.resolved_at.year}-{pred.resolved_at.year + 1}"
        row = (
            await seeded_session.execute(
                select(Leaderboard).where(
                    Leaderboard.user_id == uuid.UUID(user_id),
                    Leaderboard.season == season,
                )
            )
        ).scalar_one()
        assert row.correct_predictions == 0
        assert row.streak == 0

    async def test_resolving_a_second_prediction_upserts_existing_leaderboard_row(
        self, seeded_session
    ):
        """A second resolved prediction in the same season adds onto the row
        created by the first, rather than inserting a duplicate."""
        user_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        pred1 = await create_prediction(
            seeded_session,
            user_id=user_id,
            game_id="401810001",
            prediction_type="total",
            prediction_value="OVER",
        )
        pred2 = await create_prediction(
            seeded_session,
            user_id=user_id,
            game_id="401810001",
            prediction_type="winner",
            prediction_value="BOS",
        )
        await resolve_prediction(seeded_session, str(pred1.id), is_correct=True, points_awarded=10)
        await resolve_prediction(seeded_session, str(pred2.id), is_correct=True, points_awarded=5)

        await seeded_session.refresh(pred2)
        season = f"{pred2.resolved_at.year}-{pred2.resolved_at.year + 1}"
        rows = (
            (
                await seeded_session.execute(
                    select(Leaderboard).where(
                        Leaderboard.user_id == uuid.UUID(user_id),
                        Leaderboard.season == season,
                    )
                )
            )
            .scalars()
            .all()
        )
        # Upserted onto the same (user_id, season) row, not duplicated — note
        # conftest's seeded_session already has one pre-existing Leaderboard
        # row for this user in a different ("2025-26") season.
        assert len(rows) == 1
        assert rows[0].total_points == 15
        assert rows[0].correct_predictions == 2
        assert rows[0].total_predictions == 2
        assert rows[0].streak == 2

    async def test_resolve_not_found(self, seeded_session):
        fake_id = str(uuid.uuid4())
        # Should not raise, just log warning
        await resolve_prediction(seeded_session, fake_id, is_correct=True, points_awarded=10)
