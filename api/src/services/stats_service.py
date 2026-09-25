"""Stats service — league leaders from ESPN; team stats leaderboard retired."""

from __future__ import annotations

import re

import structlog

from ..models.schemas import PlayerSeasonStats, StatLeader, StatLeadersResponse, TeamStatsRow
from . import espn_client
from .standings_service import choose_regular_season

logger = structlog.get_logger(__name__)


# ── ESPN stat-label indices (Regular Season Averages) ─────────────
# Labels: GP, GS, MIN, FG, FG%, 3PT, 3P%, FT, FT%, OR, DR, REB, AST, BLK, STL, PF, TO, PTS
_STAT_IDX = {
    "gp": 0,
    "min": 2,
    "fg_pct": 4,
    "three_pct": 6,
    "ft_pct": 8,
    "reb": 11,
    "ast": 12,
    "blk": 13,
    "stl": 14,
    "pts": 17,
}


def _safe_float(val: str, default: str = "0.0") -> str:
    """Safely convert stat string, handling 'X-Y' format (e.g. '4.2-9.8')."""
    try:
        float(val)
        return val
    except (ValueError, TypeError):
        return default


async def get_player_season_stats(player_id: str) -> PlayerSeasonStats | None:
    """Fetch season stats from the ESPN athlete stats endpoint."""
    try:
        data = await espn_client.get_athlete_stats(player_id)
        if not data:
            return None

        # Find "Regular Season Averages" category
        for cat in data.get("categories", []):
            cat_name = cat.get("displayName", cat.get("name", ""))
            if "average" not in cat_name.lower():
                continue

            labels = cat.get("labels", [])
            stats_list = cat.get("statistics", [])
            if not stats_list:
                continue

            # Get the most recent season (last entry before totals)
            current = stats_list[-1]
            vals = current.get("stats", [])
            if not vals:
                continue

            # Build label→value map
            stat_map = {}
            for i, label in enumerate(labels):
                if i < len(vals):
                    stat_map[label] = vals[i]

            gp = int(float(stat_map.get("GP", "0")))
            if gp == 0:
                continue

            return PlayerSeasonStats(
                gp=gp,
                ppg=_safe_float(stat_map.get("PTS", "0.0")),
                rpg=_safe_float(stat_map.get("REB", "0.0")),
                apg=_safe_float(stat_map.get("AST", "0.0")),
                spg=_safe_float(stat_map.get("STL", "0.0")),
                bpg=_safe_float(stat_map.get("BLK", "0.0")),
                fg_pct=f"{_safe_float(stat_map.get('FG%', '0.0'))}%",
                three_pct=f"{_safe_float(stat_map.get('3P%', '0.0'))}%",
                ft_pct=f"{_safe_float(stat_map.get('FT%', '0.0'))}%",
            )
    except Exception as e:
        logger.warning("player_season_stats.espn_failed", player_id=player_id, error=str(e))

    return None


async def get_player_game_log(player_id: str) -> list[dict]:
    """Fetch recent game logs from the ESPN gamelog endpoint."""
    try:
        data = await espn_client.get_athlete_gamelog(player_id)
        if not data:
            return []

        labels = data.get("labels", [])
        events_meta = data.get("events", {})

        # Build label→index map
        # Labels: MIN, FG, FG%, 3PT, 3P%, FT, FT%, REB, AST, BLK, STL, PF, TO, PTS
        label_idx = {lbl: i for i, lbl in enumerate(labels)}

        # Collect all game events from seasonTypes
        all_events = []
        for st in data.get("seasonTypes", []):
            for cat in st.get("categories", []):
                for ev in cat.get("events", []):
                    all_events.append(ev)

        # Sort by game date (most recent first) and limit to 10
        def _event_date(ev):
            meta = events_meta.get(ev.get("eventId", ""), {})
            return meta.get("gameDate", "")

        all_events.sort(key=_event_date, reverse=True)

        result = []
        for ev in all_events[:10]:
            eid = ev.get("eventId", "")
            stats = ev.get("stats", [])
            meta = events_meta.get(eid, {})
            if not meta:
                continue

            opp = meta.get("opponent", {})
            team_info = meta.get("team", {})
            game_date = meta.get("gameDate", "")[:10]  # "2026-01-24T02:30:00..." → "2026-01-24"

            def _get(label, default="0"):
                idx = label_idx.get(label)
                if idx is not None and idx < len(stats):
                    return stats[idx]
                return default

            result.append(
                {
                    "date": game_date,
                    "team": team_info.get("abbreviation", ""),
                    "opponent": opp.get("abbreviation", ""),
                    "home_away": meta.get("atVs", "vs"),
                    "pts": int(float(_get("PTS", "0"))),
                    "reb": int(float(_get("REB", "0"))),
                    "ast": int(float(_get("AST", "0"))),
                    "stl": int(float(_get("STL", "0"))),
                    "blk": int(float(_get("BLK", "0"))),
                    "fg": _get("FG", "0-0"),
                    "three": _get("3PT", "0-0"),
                    "min": _get("MIN", "0"),
                    "result": meta.get("gameResult", ""),
                    "score": meta.get("score", ""),
                }
            )

        return result
    except Exception as e:
        logger.warning("player_game_log.espn_failed", player_id=player_id, error=str(e))
        return []


async def _build_athlete_lookup() -> dict[str, dict]:
    """Build {espn_id: {name, abbrev}} from cached roster data."""
    from .team_mapping import ESPN_TEAM_IDS

    lookup: dict[str, dict] = {}
    try:
        for abbrev, espn_id in ESPN_TEAM_IDS.items():
            data = await espn_client.get_team_roster(espn_id)
            if not data:
                continue
            team_data = data.get("team", {})
            for a in team_data.get("athletes", []):
                aid = a.get("id", "")
                if aid:
                    lookup[aid] = {
                        "name": a.get("displayName", a.get("fullName", "")),
                        "abbrev": abbrev,
                    }
    except Exception:
        pass
    return lookup


async def _resolve_athlete(aid: str, athlete_map: dict) -> dict:
    """Resolve athlete name + team from map, falling back to ESPN v3 athlete endpoint."""
    info = athlete_map.get(aid)
    if info and info.get("name"):
        return info

    # Fallback: fetch individual athlete info from ESPN
    try:
        data = await espn_client.get_athlete_info(aid)
        if data:
            athlete = data.get("athlete", data)
            name = athlete.get("displayName", athlete.get("fullName", ""))
            team = athlete.get("team", {})
            abbrev = team.get("abbreviation", "")
            if name:
                result = {"name": name, "abbrev": abbrev}
                athlete_map[aid] = result  # cache for future lookups
                return result
    except Exception:
        pass

    return {"name": f"Player {aid}", "abbrev": ""}


_SEASON_REF = re.compile(r"/seasons/(\d{4})/types/(\d+)/")
_SEASON_TYPES = {1: "preseason", 2: "regular season", 3: "postseason"}


def _leaders_season_label(ref: str) -> str:
    """The season an ESPN leaders payload is for, from its own $ref URL.

    ESPN names a season by the year it ends in: .../seasons/2025/types/2/ is the
    2024–25 regular season. "" when the URL doesn't say.
    """
    m = _SEASON_REF.search(ref or "")
    if not m:
        return ""
    end = int(m.group(1))
    years = f"{end - 1}–{end % 100:02d}"
    kind = _SEASON_TYPES.get(int(m.group(2)))
    return f"{years} {kind}" if kind else years


_PCT_KEYS = {"fg_pct", "ft_pct", "three_pct"}


def _leader_value(key: str, leader: dict) -> str:
    """The leader's display value. ESPN gives FG% and FT% as percentages ("68.2") but 3P%
    as a fraction (value 0.4776, displayValue "0.5"), so percentages are formatted from the
    raw value on one scale."""
    if key in _PCT_KEYS and isinstance(leader.get("value"), int | float):
        v = float(leader["value"])
        return f"{v * 100 if v <= 1 else v:.1f}"
    return str(leader.get("displayValue", "0.0"))


async def get_stat_leaders(limit: int = 10) -> StatLeadersResponse:
    """League stat leaders for the regular season the standings show: last season's
    until this season's first regular-season game, then this season's."""
    categories = {}
    season_label = ""
    is_previous = False

    try:
        choice = await choose_regular_season()
        espn_data = (
            await espn_client.get_stat_leaders(season=choice.year, limit=limit)
            if choice and choice.year
            else None
        )
        if not (espn_data and espn_data.get("categories")) and choice and not choice.is_previous:
            # Just after the switchover ESPN can have standings for the new season but no
            # leaders yet (season 2027 answered 404 on 2026-09-25): keep last season's.
            espn_data = await espn_client.get_stat_leaders(season=choice.year - 1, limit=limit)
            is_previous = True
        else:
            is_previous = bool(choice and choice.is_previous)
        if espn_data:
            season_label = _leaders_season_label(espn_data.get("$ref", ""))
            # Build athlete lookup from cached rosters
            athlete_map = await _build_athlete_lookup()

            key_map = {
                "pointsPerGame": "pts",
                "reboundsPerGame": "reb",
                "assistsPerGame": "ast",
                "stealsPerGame": "stl",
                "blocksPerGame": "blk",
                "3PointsMadePerGame": "threes",
                # ESPN's real names for these three (verified against the 2026 capture).
                "fieldGoalPercentage": "fg_pct",
                "FreeThrowPct": "ft_pct",
                "3PointPct": "three_pct",
            }
            for cat in espn_data.get("categories", []):
                cat_name = cat.get("name")
                key = key_map.get(cat_name)
                if not key:
                    continue
                leaders = []
                for i, leader in enumerate(cat.get("leaders", [])):
                    # Extract athlete ID from $ref URL
                    ref = leader.get("athlete", {}).get("$ref", "")
                    aid = ref.split("/athletes/")[-1].split("?")[0] if "/athletes/" in ref else ""
                    # Resolve athlete name (with fallback to v3 endpoint)
                    info = await _resolve_athlete(aid, athlete_map)
                    leaders.append(
                        StatLeader(
                            rank=i + 1,
                            player=info.get("name", f"Player {aid}"),
                            player_id=aid,
                            team=info.get("abbrev", ""),
                            value=_leader_value(key, leader),
                            headshot_url=f"https://a.espncdn.com/i/headshots/nba/players/full/{aid}.png"
                            if aid
                            else "",
                        )
                    )
                if leaders:
                    categories[key] = leaders[:limit]
    except Exception as espn_e:
        logger.warning("stat_leaders.espn_failed", error=str(espn_e))

    # No leaders means nothing to label.
    return StatLeadersResponse(
        categories=categories,
        season_label=season_label if categories else "",
        is_previous_season=is_previous if categories else False,
    )


async def get_team_stats_list() -> list[TeamStatsRow]:
    """Team stats leaderboard — no data source since the Sport-suite DB pools were
    retired (owner-approved); always returns empty pending a replacement source."""
    return []
