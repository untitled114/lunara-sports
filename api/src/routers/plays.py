"""Plays router - play-by-play events for a game."""

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
    after_order: int | None = Query(
        default=None,
        ge=-1,
        description="Return plays after this position in ESPN's play list (for polling)",
    ),
    after_sequence: int | None = Query(
        default=None,
        ge=0,
        description="Return plays after this sequence number (rows without an ESPN position)",
    ),
    session: AsyncSession = Depends(get_session),
):
    """Return play-by-play events for a game, in ESPN's time order.

    ``after_order`` returns the plays after a position in ESPN's list. A play ESPN inserts
    late takes a position before the cursor, so a poller can miss it; the WebSocket feed
    (one row id at a time) delivers every new play. ``after_sequence`` serves rows written
    before plays had an ESPN position.
    """
    return await get_plays(
        session, game_id, quarter=quarter, after_order=after_order, after_sequence=after_sequence
    )
