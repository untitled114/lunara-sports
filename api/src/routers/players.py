"""Players router — search and browse NBA players."""

from fastapi import APIRouter, HTTPException, Query

from ..services.player_service import get_all_players, get_player_by_id
from ..services.stats_service import get_player_game_log, get_player_season_stats

router = APIRouter(tags=["players"])


@router.get("/players")
async def list_players(search: str = Query("", description="Filter by player name")):
    """List all NBA players grouped by team, with optional name search."""
    return await get_all_players(search=search)


@router.get("/players/{player_id}")
async def player_detail(player_id: str):
    """Get detailed information for a specific player."""
    player = await get_player_by_id(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@router.get("/players/{player_id}/stats")
async def player_stats(player_id: str):
    """Get aggregated season stats for a specific player."""
    stats = await get_player_season_stats(player_id)
    if not stats:
        # Instead of 404, return empty stats to avoid frontend crashes
        from ..models.schemas import PlayerSeasonStats

        return PlayerSeasonStats()
    return stats


@router.get("/players/{player_id}/log")
async def player_log(player_id: str):
    """Get recent game logs for a specific player."""
    return await get_player_game_log(player_id)
