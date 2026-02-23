"""Box score router — detailed player stats for a game."""

from fastapi import APIRouter, HTTPException

from ..models.schemas import BoxScoreResponse
from ..services.boxscore_service import get_boxscore

router = APIRouter(tags=["boxscore"])


@router.get("/games/{game_id}/boxscore", response_model=BoxScoreResponse)
async def game_boxscore(game_id: str):
    """Get detailed box score for a game from ESPN."""
    result = await get_boxscore(game_id)
    if not result:
        raise HTTPException(404, "Box score not available")
    return result
