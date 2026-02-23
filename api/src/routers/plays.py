"""Plays router — play-by-play events for a game."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..models.schemas import PlayResponse
from ..services.play_service import get_plays

router = APIRouter(tags=["plays"])


@router.get("/games/{game_id}/plays", response_model=list[PlayResponse])
async def list_plays(
    game_id: str,
    quarter: int | None = Query(default=None, ge=1, le=6, description="Filter by quarter"),
    after_sequence: int | None = Query(
        default=None,
        ge=0,
        description="Return plays after this sequence number (for pagination/polling)",
    ),
    session: AsyncSession = Depends(get_session),
):
    """Return play-by-play events for a game.

    Supports filtering by quarter and cursor-based pagination via
    ``after_sequence``.
    """
    return await get_plays(session, game_id, quarter=quarter, after_sequence=after_sequence)
