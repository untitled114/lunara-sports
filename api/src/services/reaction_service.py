"""Reaction service — create/delete reactions and aggregate emoji counts."""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Play, Reaction

logger = structlog.get_logger(__name__)


async def create_reaction(
    session: AsyncSession,
    user_id: str,
    play_id: int,
    emoji: str,
) -> Reaction:
    """Insert a reaction. Raises IntegrityError on duplicate (user_id, play_id)."""
    reaction = Reaction(
        user_id=uuid.UUID(user_id),
        play_id=play_id,
        emoji=emoji,
    )
    session.add(reaction)
    await session.commit()
    await session.refresh(reaction)

    logger.info("reaction.created", user_id=user_id, play_id=play_id, emoji=emoji)
    return reaction


async def delete_reaction(
    session: AsyncSession,
    user_id: str,
    play_id: int,
) -> bool:
    """Delete a user's reaction on a play. Returns True if a row was removed."""
    stmt = delete(Reaction).where(
        Reaction.user_id == uuid.UUID(user_id), Reaction.play_id == play_id
    )
    result = await session.execute(stmt)
    await session.commit()
    removed = result.rowcount > 0
    if removed:
        logger.info("reaction.deleted", user_id=user_id, play_id=play_id)
    return removed


async def get_reaction_counts(
    session: AsyncSession,
    play_id: int,
) -> list[dict]:
    """Return emoji counts for a play: [{"emoji": "🔥", "count": 5}, ...]."""
    stmt = (
        select(Reaction.emoji, func.count().label("count"))
        .where(Reaction.play_id == play_id)
        .group_by(Reaction.emoji)
        .order_by(func.count().desc())
    )
    result = await session.execute(stmt)
    return [{"emoji": row.emoji, "count": row.count} for row in result.all()]


async def get_play_game_id(
    session: AsyncSession,
    play_id: int,
) -> str | None:
    """Look up the game_id for a play (used for WS broadcast key)."""
    stmt = select(Play.game_id).where(Play.id == play_id)
    result = await session.execute(stmt)
    row = result.scalar_one_or_none()
    return row
