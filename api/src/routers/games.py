"""Games router — list and retrieve NBA games."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..models.schemas import GameResponse, NextGameResponse
from ..services.game_service import get_game, get_games, next_game_date

router = APIRouter(prefix="/games", tags=["games"])


@router.get("/", response_model=list[GameResponse])
async def list_games(
    game_date: date | None = Query(default=None, description="Filter by date (YYYY-MM-DD)"),
    session: AsyncSession = Depends(get_session),
):
    """Return today's games (or games on a specific date)."""
    return await get_games(session, game_date)


@router.get("/next", response_model=NextGameResponse)
async def next_game(after: date, session: AsyncSession = Depends(get_session)):
    """Return the first date strictly after `after` that has games."""
    return NextGameResponse(date=await next_game_date(session, after))


@router.get("/{game_id}", response_model=GameResponse)
async def game_detail(
    game_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Return detail for a single game."""
    game = await get_game(session, game_id)
    if game is None:
        raise HTTPException(status_code=404, detail=f"Game {game_id} not found")
    return game
