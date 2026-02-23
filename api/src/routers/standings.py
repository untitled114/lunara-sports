"""Standings router — NBA conference standings."""

from fastapi import APIRouter

from ..models.schemas import StandingsResponse
from ..services.standings_service import get_standings

router = APIRouter(tags=["standings"])


@router.get("/standings", response_model=StandingsResponse)
async def standings():
    """Get current NBA standings by conference."""
    return await get_standings()
