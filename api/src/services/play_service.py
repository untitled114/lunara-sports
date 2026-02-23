"""Play service — fetch play-by-play events from PostgreSQL."""

from __future__ import annotations

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Play

logger = structlog.get_logger(__name__)


async def get_plays(
    session: AsyncSession,
    game_id: str,
    quarter: int | None = None,
    after_sequence: int | None = None,
    limit: int = 1000,
) -> list[Play]:
    """Return play-by-play events for a game.

    Supports filtering by quarter and cursor-based pagination via
    after_sequence (returns plays with sequence_number > after_sequence).
    """
    stmt = (
        select(Play)
        .where(Play.game_id == game_id)
        .order_by(Play.sequence_number)
        .limit(limit)
    )

    if quarter is not None:
        stmt = stmt.where(Play.quarter == quarter)

    if after_sequence is not None:
        stmt = stmt.where(Play.sequence_number > after_sequence)

    result = await session.execute(stmt)
    plays = result.scalars().all()

    logger.debug("plays.fetched", game_id=game_id, count=len(plays))
    return list(plays)
