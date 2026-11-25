"""Leaderboard router - ranked list of top users."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..eastern import eastern_today, nba_season
from ..models.schemas import LeaderboardEntry
from ..services.prediction_service import get_leaderboard

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("/", response_model=list[LeaderboardEntry])
async def leaderboard(
    season: str | None = Query(
        default=None, description='Season, e.g. "2026-27"; the current NBA season when omitted'
    ),
    limit: int = Query(default=25, ge=1, le=100, description="Number of entries to return"),
    session: AsyncSession = Depends(get_session),
):
    """Return the top N users on the leaderboard for a given season."""
    return await get_leaderboard(session, season or nba_season(eastern_today()), limit)
