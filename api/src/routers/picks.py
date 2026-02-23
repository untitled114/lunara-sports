"""Model picks router — Sport-suite betting predictions for games."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings
from ..db.models import ModelPick, UserTail
from ..db.session import get_session
from ..models.schemas import ModelPickResponse
from ..services.auth_deps import get_current_user, get_current_user_optional
from ..services.pick_sync_service import sync_picks

router = APIRouter(tags=["picks"])

_settings: Settings | None = None


def _get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def _eastern_today() -> date:
    utc_now = datetime.now(timezone.utc)
    et_now = utc_now - timedelta(hours=5)
    return et_now.date()


def _gate_pick(pick: ModelPick, is_premium: bool) -> dict:
    """Convert a ModelPick to a response dict, gating fields for free users."""
    data = {
        "id": pick.id,
        "game_id": pick.game_id,
        "player_name": pick.player_name,
        "team": pick.team,
        "market": pick.market,
        "prediction": pick.prediction,
        "model_version": pick.model_version,
        "tier": pick.tier,
        "actual_value": float(pick.actual_value) if pick.actual_value is not None else None,
        "is_hit": pick.is_hit,
        "opponent_team": pick.opponent_team,
        "is_home": pick.is_home,
        "created_at": pick.created_at,
        "is_gated": False,
    }

    if is_premium:
        data.update(
            {
                "line": float(pick.line) if pick.line is not None else 0,
                "p_over": float(pick.p_over) if pick.p_over is not None else None,
                "edge": float(pick.edge) if pick.edge is not None else None,
                "book": pick.book,
                "edge_pct": float(pick.edge_pct) if pick.edge_pct is not None else None,
                "consensus_line": float(pick.consensus_line)
                if pick.consensus_line is not None
                else None,
                "reasoning": pick.reasoning,
                "confidence": pick.confidence,
                "line_spread": float(pick.line_spread) if pick.line_spread is not None else None,
            }
        )
    else:
        data.update(
            {
                "line": 0,
                "p_over": None,
                "edge": None,
                "book": None,
                "edge_pct": None,
                "consensus_line": None,
                "reasoning": None,
                "confidence": None,
                "line_spread": None,
                "is_gated": True,
            }
        )

    return data


@router.get("/games/{game_id}/picks", response_model=list[ModelPickResponse])
async def list_picks(
    game_id: str,
    session: AsyncSession = Depends(get_session),
    user=Depends(get_current_user_optional),
):
    """Return Sport-suite model picks for players in a game."""
    stmt = (
        select(ModelPick)
        .where(ModelPick.game_id == game_id)
        .order_by(ModelPick.tier, ModelPick.edge.desc())
    )
    result = await session.execute(stmt)
    picks = result.scalars().all()

    is_premium = user is not None and getattr(user, "membership_tier", "free") == "premium"
    return [_gate_pick(p, is_premium) for p in picks]


@router.get("/picks/today", response_model=list[ModelPickResponse])
async def today_picks(
    session: AsyncSession = Depends(get_session),
    user=Depends(get_current_user_optional),
):
    """Return all picks for today, sorted by tier + edge."""
    today = _eastern_today()
    stmt = (
        select(ModelPick)
        .where(ModelPick.game_date == today)
        .order_by(ModelPick.tier, ModelPick.edge.desc())
    )
    result = await session.execute(stmt)
    picks = result.scalars().all()

    is_premium = user is not None and getattr(user, "membership_tier", "free") == "premium"
    return [_gate_pick(p, is_premium) for p in picks]


@router.post("/picks/sync")
async def trigger_sync(
    pick_date: str = Query(default="", description="YYYY-MM-DD date to sync, defaults to today"),
    session: AsyncSession = Depends(get_session),
):
    """Manually trigger a pick sync from Sport-suite predictions directory."""
    settings = _get_settings()
    if not settings.sport_suite_predictions_dir:
        raise HTTPException(status_code=400, detail="sport_suite_predictions_dir not configured")

    d = date.fromisoformat(pick_date) if pick_date else _eastern_today()
    count = await sync_picks(session, settings.sport_suite_predictions_dir, d)
    return {"synced": count, "date": d.isoformat()}


@router.post("/picks/{pick_id}/tail")
async def tail_pick(
    pick_id: int,
    session: AsyncSession = Depends(get_session),
    user=Depends(get_current_user),
):
    """Tail (track) a pick. Requires authentication."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    # Verify pick exists
    pick = await session.get(ModelPick, pick_id)
    if not pick:
        raise HTTPException(status_code=404, detail="Pick not found")

    stmt = (
        pg_insert(UserTail)
        .values(user_id=user.id, pick_id=pick_id)
        .on_conflict_do_nothing(constraint="uq_user_tails_user_pick")
    )
    await session.execute(stmt)
    await session.commit()
    return {"status": "tailed", "pick_id": pick_id}


@router.delete("/picks/{pick_id}/tail")
async def untail_pick(
    pick_id: int,
    session: AsyncSession = Depends(get_session),
    user=Depends(get_current_user),
):
    """Remove a tail from a pick."""
    stmt = delete(UserTail).where(UserTail.user_id == user.id, UserTail.pick_id == pick_id)
    await session.execute(stmt)
    await session.commit()
    return {"status": "untailed", "pick_id": pick_id}


@router.get("/picks/tailed", response_model=list[ModelPickResponse])
async def list_tailed_picks(
    session: AsyncSession = Depends(get_session),
    user=Depends(get_current_user),
):
    """List all picks the user has tailed."""
    stmt = (
        select(ModelPick)
        .join(UserTail, UserTail.pick_id == ModelPick.id)
        .where(UserTail.user_id == user.id)
        .order_by(ModelPick.game_date.desc(), ModelPick.tier)
    )
    result = await session.execute(stmt)
    picks = result.scalars().all()

    is_premium = getattr(user, "membership_tier", "free") == "premium"
    return [_gate_pick(p, is_premium) for p in picks]
