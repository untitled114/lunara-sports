"""Prediction service — create predictions and query leaderboard."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Leaderboard, Prediction, User

logger = structlog.get_logger(__name__)


async def create_prediction(
    session: AsyncSession,
    user_id: str,
    game_id: str,
    prediction_type: str,
    prediction_value: str,
) -> Prediction:
    """Insert a new prediction. Raises on duplicate (user, game, type)."""
    prediction = Prediction(
        user_id=uuid.UUID(user_id),
        game_id=game_id,
        prediction_type=prediction_type,
        prediction_value=prediction_value,
    )
    session.add(prediction)
    await session.commit()
    await session.refresh(prediction)

    logger.info(
        "prediction.created",
        prediction_id=str(prediction.id),
        user_id=user_id,
        game_id=game_id,
    )
    return prediction


async def get_user_predictions(
    session: AsyncSession,
    user_id: str,
    limit: int = 50,
) -> list[Prediction]:
    """Return recent predictions for a user."""
    stmt = (
        select(Prediction)
        .where(Prediction.user_id == uuid.UUID(user_id))
        .order_by(Prediction.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def resolve_prediction(
    session: AsyncSession,
    prediction_id: str,
    is_correct: bool,
    points_awarded: int = 0,
) -> None:
    """Mark a prediction as resolved and upsert the leaderboard."""
    stmt = select(Prediction).where(Prediction.id == uuid.UUID(prediction_id))
    result = await session.execute(stmt)
    prediction = result.scalar_one_or_none()
    if prediction is None:
        logger.warning("prediction.resolve_not_found", prediction_id=prediction_id)
        return

    prediction.is_correct = is_correct
    prediction.points_awarded = points_awarded
    prediction.resolved_at = datetime.now(timezone.utc)

    # Upsert leaderboard row for current season
    season = f"{prediction.resolved_at.year}-{prediction.resolved_at.year + 1}"
    lb_stmt = pg_insert(Leaderboard).values(
        user_id=prediction.user_id,
        season=season,
        total_points=points_awarded,
        correct_predictions=1 if is_correct else 0,
        total_predictions=1,
        streak=1 if is_correct else 0,
    ).on_conflict_do_update(
        index_elements=["user_id", "season"],
        set_={
            "total_points": Leaderboard.total_points + points_awarded,
            "correct_predictions": Leaderboard.correct_predictions + (1 if is_correct else 0),
            "total_predictions": Leaderboard.total_predictions + 1,
            "streak": (Leaderboard.streak + 1) if is_correct else 0,
        },
    )
    await session.execute(lb_stmt)
    await session.commit()

    logger.info(
        "prediction.resolved",
        prediction_id=prediction_id,
        is_correct=is_correct,
        points=points_awarded,
    )


async def get_leaderboard(
    session: AsyncSession,
    season: str,
    limit: int = 25,
) -> list[dict]:
    """Return top N users on the leaderboard for a season.

    Joins with users table to include username.
    """
    stmt = (
        select(
            Leaderboard.user_id,
            User.username,
            Leaderboard.total_points,
            Leaderboard.correct_predictions,
            Leaderboard.total_predictions,
            Leaderboard.streak,
            Leaderboard.rank,
        )
        .join(User, Leaderboard.user_id == User.id)
        .where(Leaderboard.season == season)
        .order_by(Leaderboard.total_points.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    rows = result.all()

    return [
        {
            "user_id": str(row.user_id),
            "username": row.username,
            "total_points": row.total_points,
            "correct_predictions": row.correct_predictions,
            "total_predictions": row.total_predictions,
            "streak": row.streak,
            "rank": row.rank,
        }
        for row in rows
    ]
