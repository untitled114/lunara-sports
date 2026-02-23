"""Comment service — create and list game comments."""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Comment

logger = structlog.get_logger(__name__)


async def create_comment(
    session: AsyncSession,
    user_id: str,
    game_id: str,
    body: str,
    play_id: int | None = None,
) -> Comment:
    """Insert a new comment on a game (optionally tied to a play)."""
    comment = Comment(
        user_id=uuid.UUID(user_id),
        game_id=game_id,
        play_id=play_id,
        body=body,
    )
    session.add(comment)
    await session.commit()
    await session.refresh(comment)

    logger.info("comment.created", comment_id=comment.id, game_id=game_id)
    return comment


async def get_game_comments(
    session: AsyncSession,
    game_id: str,
    limit: int = 50,
) -> list[Comment]:
    """Return recent comments for a game, newest first."""
    stmt = (
        select(Comment)
        .where(Comment.game_id == game_id)
        .order_by(Comment.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
