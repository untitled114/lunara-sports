"""Sync Sport-suite prediction picks into the model_picks table.

Reads xl_picks_YYYY-MM-DD.json from the configured predictions directory,
matches picks to PBP games by team+opponent+date, and upserts into model_picks.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import structlog
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Game, ModelPick
from .team_mapping import from_sport_suite_abbrev

logger = structlog.get_logger(__name__)

# Sport-suite field → model_picks column
_FIELD_MAP = {
    "stat_type": "market",
    "side": "prediction",
    "best_line": "line",
    "best_book": "book",
    "filter_tier": "tier",
    "edge_pct": "edge_pct",
    "consensus_line": "consensus_line",
    "model_version": "model_version",
    "p_over": "p_over",
    "edge": "edge",
    "reasoning": "reasoning",
    "confidence": "confidence",
    "line_spread": "line_spread",
}


def find_picks_file(directory: str, pick_date: date) -> Path | None:
    """Locate the picks JSON for a given date in the predictions directory."""
    base = Path(directory)
    if not base.is_dir():
        return None

    # Try both filename patterns
    for fmt in [
        f"xl_picks_{pick_date.isoformat()}.json",
        f"xl_picks_{pick_date.strftime('%Y%m%d')}.json",
    ]:
        path = base / fmt
        if path.exists():
            return path
    return None


def _parse_picks(raw: list[dict], pick_date: date) -> list[dict]:
    """Normalize raw Sport-suite picks into model_picks row dicts."""
    rows = []
    for pick in raw:
        row: dict = {"game_date": pick_date}

        # Map known fields
        for src, dst in _FIELD_MAP.items():
            if src in pick:
                row[dst] = pick[src]

        # Player name
        row["player_name"] = pick.get("player_name", pick.get("player", ""))

        # Opponent + is_home
        opp = pick.get("opponent_team", "")
        row["opponent_team"] = from_sport_suite_abbrev(opp)
        row["is_home"] = pick.get("is_home")

        # Determine player's team from opponent + is_home
        team = pick.get("team", "")
        if team:
            row["team"] = from_sport_suite_abbrev(team)
        else:
            row["team"] = ""

        # Ensure numeric fields are floats
        for fld in ("line", "p_over", "edge", "edge_pct", "consensus_line", "line_spread"):
            if fld in row and row[fld] is not None:
                try:
                    row[fld] = float(row[fld])
                except (ValueError, TypeError):
                    row[fld] = None

        rows.append(row)
    return rows


async def match_picks_to_games(
    session: AsyncSession,
    pick_date: date,
    picks: list[dict],
) -> list[dict]:
    """Match picks to PBP games by team+opponent+date.

    Builds a lookup from today's games, then assigns game_id to each pick.
    Returns only picks that matched a game.
    """
    # Get today's games — convert timezone.utc start_time to Eastern date for matching
    # ESPN stores timezone.utc; a 7 PM ET game on Feb 20 = 2026-02-21 00:00:00+00
    from sqlalchemy import func

    eastern_date = func.date(Game.start_time.op("AT TIME ZONE")("America/New_York"))
    stmt = select(Game).where(eastern_date == pick_date)
    result = await session.execute(stmt)
    games = result.scalars().all()

    if not games:
        logger.warning("pick_sync.no_games", date=pick_date.isoformat())
        return []

    # Build lookup: (home_team, away_team) → game_id  and  (away_team, home_team) → game_id
    game_lookup: dict[tuple[str, str], str] = {}
    for g in games:
        game_lookup[(g.home_team, g.away_team)] = g.id
        game_lookup[(g.away_team, g.home_team)] = g.id

    matched = []
    for pick in picks:
        team = pick.get("team", "")
        opp = pick.get("opponent_team", "")
        is_home = pick.get("is_home")

        game_id = None

        # Try direct team+opponent lookup
        if team and opp:
            game_id = game_lookup.get((team, opp)) or game_lookup.get((opp, team))

        # Fallback: if we know is_home, try constructing the key
        if not game_id and opp and is_home is not None:
            if is_home:
                # Player is home, opponent is away
                game_id = game_lookup.get((team, opp))
            else:
                game_id = game_lookup.get((opp, team))

        # Last resort: find any game involving the opponent
        if not game_id and opp:
            for (t1, t2), gid in game_lookup.items():
                if t1 == opp or t2 == opp:
                    game_id = gid
                    break

        if game_id:
            pick["game_id"] = game_id
            matched.append(pick)
        else:
            logger.debug("pick_sync.no_match", player=pick.get("player_name"), team=team, opp=opp)

    logger.info("pick_sync.matched", total=len(picks), matched=len(matched), games=len(games))
    return matched


async def sync_picks(
    session: AsyncSession,
    predictions_dir: str,
    pick_date: date | None = None,
) -> int:
    """Sync picks from Sport-suite JSON file into model_picks table.

    Returns the number of picks upserted.
    """
    if not predictions_dir:
        return 0

    if pick_date is None:
        pick_date = date.today()

    path = find_picks_file(predictions_dir, pick_date)
    if not path:
        logger.info("pick_sync.no_file", dir=predictions_dir, date=pick_date.isoformat())
        return 0

    with open(path) as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        logger.error("pick_sync.invalid_format", path=str(path))
        return 0

    picks = _parse_picks(raw, pick_date)
    if not picks:
        return 0

    matched = await match_picks_to_games(session, pick_date, picks)
    if not matched:
        return 0

    count = 0
    for pick in matched:
        game_id = pick.pop("game_id")
        values = {
            "game_id": game_id,
            "player_name": pick.get("player_name", ""),
            "team": pick.get("team", ""),
            "market": pick.get("market", ""),
            "line": pick.get("line", 0),
            "prediction": pick.get("prediction", "OVER"),
            "p_over": pick.get("p_over"),
            "edge": pick.get("edge"),
            "book": pick.get("book"),
            "model_version": pick.get("model_version"),
            "tier": pick.get("tier"),
            "edge_pct": pick.get("edge_pct"),
            "consensus_line": pick.get("consensus_line"),
            "opponent_team": pick.get("opponent_team"),
            "reasoning": pick.get("reasoning"),
            "is_home": pick.get("is_home"),
            "confidence": pick.get("confidence"),
            "line_spread": pick.get("line_spread"),
            "game_date": pick.get("game_date"),
        }

        stmt = (
            pg_insert(ModelPick)
            .values(**values)
            .on_conflict_do_update(
                index_elements=["game_id", "player_name", "market", "model_version"],
                set_={
                    "line": values["line"],
                    "prediction": values["prediction"],
                    "p_over": values["p_over"],
                    "edge": values["edge"],
                    "book": values["book"],
                    "tier": values["tier"],
                    "edge_pct": values["edge_pct"],
                    "consensus_line": values["consensus_line"],
                    "reasoning": values["reasoning"],
                    "confidence": values["confidence"],
                    "line_spread": values["line_spread"],
                },
            )
        )
        await session.execute(stmt)
        count += 1

    await session.commit()
    logger.info("pick_sync.upserted", count=count, date=pick_date.isoformat())
    return count
