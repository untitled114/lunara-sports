"""Background poller that tracks live stats for pending picks.

Every 30 seconds:
1. Queries pending picks (is_hit IS NULL) for today
2. Fetches box scores for their games
3. Updates actual_value from box score player stats
4. Marks is_hit when the game is final
5. Broadcasts pick updates via WebSocket
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Game, ModelPick
from ..db.session import get_session_factory
from ..ws.live_feed import manager
from .boxscore_service import get_boxscore

logger = structlog.get_logger(__name__)

POLL_INTERVAL = 30  # seconds

# Market → box score stat field
MARKET_STAT_MAP = {
    "POINTS": "points",
    "REBOUNDS": "rebounds",
    "ASSISTS": "assists",
    "STEALS": "steals",
    "BLOCKS": "blocks",
    "THREES": "three_pt",  # needs special parsing
}


def _eastern_today() -> date:
    utc_now = datetime.now(timezone.utc)
    et_now = utc_now - timedelta(hours=5)
    return et_now.date()


def _name_match(pick_name: str, box_name: str) -> bool:
    """Match player names case-insensitively, with last-name fallback."""
    pn = pick_name.strip().lower()
    bn = box_name.strip().lower()

    if pn == bn:
        return True

    # Last name match
    p_last = pn.split()[-1] if pn else ""
    b_last = bn.split()[-1] if bn else ""
    return bool(p_last and p_last == b_last and len(p_last) > 2)


def _get_stat_value(player, market: str) -> float | None:
    """Extract the stat value from a BoxScorePlayer for the given market."""
    stat_field = MARKET_STAT_MAP.get(market)
    if not stat_field:
        return None

    if market == "THREES":
        # three_pt is "3-7" format — we want made (first number)
        raw = getattr(player, "three_pt", "0-0")
        try:
            return float(raw.split("-")[0])
        except (ValueError, IndexError):
            return 0.0

    val = getattr(player, stat_field, None)
    if val is not None:
        return float(val)
    return None


async def _update_picks_for_game(
    session: AsyncSession,
    game_id: str,
    game_status: str,
    picks: list[ModelPick],
) -> list[dict]:
    """Fetch box score and update picks for a single game.

    Returns list of updated pick dicts for WebSocket broadcast.
    """
    boxscore = await get_boxscore(game_id)
    if not boxscore:
        return []

    # Build player name → stats lookup from both teams
    all_players = []
    if boxscore.home:
        all_players.extend(boxscore.home.players)
    if boxscore.away:
        all_players.extend(boxscore.away.players)

    updated = []
    is_final = game_status == "final"

    for pick in picks:
        # Find matching player in box score
        matched_player = None
        for bp in all_players:
            if _name_match(pick.player_name, bp.name):
                matched_player = bp
                break

        if not matched_player:
            continue

        stat_val = _get_stat_value(matched_player, pick.market)
        if stat_val is None:
            continue

        # Update actual_value if changed
        current_actual = float(pick.actual_value) if pick.actual_value is not None else None
        if current_actual == stat_val and not (is_final and pick.is_hit is None):
            continue

        updates = {"actual_value": stat_val}

        # If game final, determine hit/miss
        if is_final:
            line_val = float(pick.line) if pick.line is not None else 0
            if pick.prediction.upper() == "OVER":
                updates["is_hit"] = stat_val > line_val
            else:
                updates["is_hit"] = stat_val < line_val

        stmt = update(ModelPick).where(ModelPick.id == pick.id).values(**updates)
        await session.execute(stmt)

        updated.append(
            {
                "id": pick.id,
                "game_id": game_id,
                "player_name": pick.player_name,
                "market": pick.market,
                "line": float(pick.line) if pick.line is not None else None,
                "prediction": pick.prediction,
                "actual_value": stat_val,
                "is_hit": updates.get("is_hit", pick.is_hit),
                "tier": pick.tier,
                "model_version": pick.model_version,
            }
        )

    return updated


async def _poll_pick_tracker() -> None:
    """Single poll iteration: update all pending picks for today."""
    today = _eastern_today()
    factory = get_session_factory()
    if factory is None:
        return

    async with factory() as session:
        # Get pending picks for today
        stmt = (
            select(ModelPick).where(ModelPick.game_date == today).where(ModelPick.is_hit.is_(None))
        )
        result = await session.execute(stmt)
        pending_picks = result.scalars().all()

        if not pending_picks:
            return

        # Group by game_id
        picks_by_game: dict[str, list[ModelPick]] = {}
        for pick in pending_picks:
            picks_by_game.setdefault(pick.game_id, []).append(pick)

        # Get game statuses
        game_ids = list(picks_by_game.keys())
        game_stmt = select(Game).where(Game.id.in_(game_ids))
        game_result = await session.execute(game_stmt)
        games = {g.id: g for g in game_result.scalars().all()}

        all_updates = []
        for game_id, game_picks in picks_by_game.items():
            game = games.get(game_id)
            if not game:
                continue

            # Only process live or final games
            if game.status not in ("live", "halftime", "final"):
                continue

            updates = await _update_picks_for_game(session, game_id, game.status, game_picks)
            all_updates.extend(updates)

        if all_updates:
            await session.commit()

            # Broadcast via WebSocket (group by game_id)
            updates_by_game: dict[str, list[dict]] = {}
            for u in all_updates:
                updates_by_game.setdefault(u["game_id"], []).append(u)

            for gid, picks in updates_by_game.items():
                await manager.broadcast(
                    gid,
                    {
                        "type": "pick_update",
                        "data": {"picks": picks},
                    },
                )

            logger.info("pick_tracker.updated", picks=len(all_updates))


async def run_pick_tracker_poller() -> None:
    """Run the pick tracker poller loop indefinitely."""
    logger.info("pick_tracker_poller.started", interval=POLL_INTERVAL)

    while True:
        try:
            await _poll_pick_tracker()
        except Exception:
            logger.exception("pick_tracker_poller.error")

        await asyncio.sleep(POLL_INTERVAL)
