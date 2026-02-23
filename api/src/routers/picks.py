"""Model picks router — Sport-suite betting predictions for games."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import ModelPick
from ..db.session import get_session
from ..models.schemas import ModelPickResponse

router = APIRouter(tags=["picks"])


@router.get("/games/{game_id}/picks", response_model=list[ModelPickResponse])
async def list_picks(
    game_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Return Sport-suite model picks for players in a game."""
    stmt = (
        select(ModelPick)
        .where(ModelPick.game_id == game_id)
        .order_by(ModelPick.tier, ModelPick.edge.desc())
    )
    result = await session.execute(stmt)
    return result.scalars().all()
