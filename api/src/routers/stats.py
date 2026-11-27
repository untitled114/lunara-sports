"""Stats router - league leaders and team stats."""

from fastapi import APIRouter, HTTPException, Query

from ..models.schemas import (
    CategoryLeadersResponse,
    PlayerTableResponse,
    StatLeadersResponse,
    TeamStatsRow,
)
from ..services.stats_service import (
    get_category_leaders,
    get_player_table,
    get_stat_leaders,
    get_team_stats_list,
)

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/leaders", response_model=StatLeadersResponse)
async def stat_leaders(limit: int = Query(10, ge=1, le=25)):
    """Get NBA stat leaders (PPG, RPG, APG, etc.)."""
    return await get_stat_leaders(limit=limit)


@router.get("/teams", response_model=list[TeamStatsRow])
async def team_stats():
    """Get team stats leaderboard."""
    return await get_team_stats_list()


@router.get("/leaders/{category}", response_model=CategoryLeadersResponse)
async def category_leaders(
    category: str,
    limit: int = Query(10, ge=1, le=50),
    team: str | None = Query(None, max_length=4),
    position: str | None = Query(None, pattern="^[GFCgfc]$"),
    conference: str | None = Query(None, pattern="^(east|west)$"),
):
    """One category's qualified leaders, filtered by team, position or conference."""
    result = await get_category_leaders(
        category, limit=limit, team=team, position=position, conference=conference
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Unknown category")
    return result


@router.get("/players", response_model=PlayerTableResponse)
async def player_table(
    sort: str = Query("pts", max_length=12),
    dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1, le=100),
    per_page: int = Query(25, ge=1, le=50),
    q: str = Query("", max_length=60),
    team: str | None = Query(None, max_length=4),
    position: str | None = Query(None, pattern="^[GFCgfc]$"),
    conference: str | None = Query(None, pattern="^(east|west)$"),
    all: bool = Query(False, description="Show every player, not only those with 70% of games"),
):
    """Every player with stats this season: search, filters, any sort, 25 per page."""
    return await get_player_table(
        sort=sort,
        dir=dir,
        page=page,
        per_page=per_page,
        q=q,
        team=team,
        position=position,
        conference=conference,
        all_players=all,
    )
