"""Standings router — NBA conference standings."""

from fastapi import APIRouter

from ..services.standings_service import get_standings
from ..models.schemas import StandingsResponse

router = APIRouter(tags=["standings"])


@router.get("/standings", response_model=StandingsResponse)
async def standings():
    """Get current NBA standings by conference."""
    return await get_standings()
