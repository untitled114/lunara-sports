"""Leaderboard router — ranked list of top users."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..models.schemas import LeaderboardEntry
from ..services.prediction_service import get_leaderboard

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("/", response_model=list[LeaderboardEntry])
async def leaderboard(
    season: str = Query(default="2025-26", description="Season identifier"),
    limit: int = Query(default=25, ge=1, le=100, description="Number of entries to return"),
    session: AsyncSession = Depends(get_session),
):
    """Return the top N users on the leaderboard for a given season."""
    return await get_leaderboard(session, season, limit)
