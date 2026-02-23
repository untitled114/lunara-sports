"""Stats router — league leaders and team stats."""

from fastapi import APIRouter, Query

from ..services.stats_service import get_stat_leaders, get_team_stats_list
from ..models.schemas import StatLeadersResponse, TeamStatsRow

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/leaders", response_model=StatLeadersResponse)
async def stat_leaders(limit: int = Query(10, ge=1, le=25)):
    """Get NBA stat leaders (PPG, RPG, APG, etc.)."""
    return await get_stat_leaders(limit=limit)


@router.get("/teams", response_model=list[TeamStatsRow])
async def team_stats():
    """Get team stats leaderboard."""
    return await get_team_stats_list()
