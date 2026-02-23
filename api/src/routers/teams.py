"""Teams router — team listing, detail, roster, schedule, stats."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..services.team_service import (
    get_team_detail,
    get_team_roster,
    get_team_schedule,
    get_team_stats,
    get_teams,
)
from ..models.schemas import (
    RosterPlayer,
    TeamDetailResponse,
    TeamPlayerStats,
    TeamScheduleGame,
)

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("")
async def list_teams(session: AsyncSession = Depends(get_session)):
    """List all NBA teams grouped by conference/division."""
    return await get_teams(session)


@router.get("/{abbrev}", response_model=TeamDetailResponse)
async def team_detail(abbrev: str, session: AsyncSession = Depends(get_session)):
    """Get detail for a specific team."""
    team = await get_team_detail(abbrev.upper(), session)
    if not team:
        raise HTTPException(404, "Team not found")
    return team


@router.get("/{abbrev}/roster", response_model=list[RosterPlayer])
async def team_roster(abbrev: str):
    """Get team roster from ESPN."""
    return await get_team_roster(abbrev.upper())


@router.get("/{abbrev}/schedule", response_model=list[TeamScheduleGame])
async def team_schedule(abbrev: str, session: AsyncSession = Depends(get_session)):
    """Get team schedule from local database."""
    return await get_team_schedule(abbrev.upper(), session)


@router.get("/{abbrev}/stats", response_model=list[TeamPlayerStats])
async def team_stats(abbrev: str):
    """Get player stats for a team."""
    return await get_team_stats(abbrev.upper())
