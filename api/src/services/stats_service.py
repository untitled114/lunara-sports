"""Stats service — league leaders and team stats from Sport-suite databases."""

from __future__ import annotations

import structlog

from ..db.sport_suite import get_players_pool, get_teams_pool
from ..models.schemas import StatLeader, StatLeadersResponse, TeamStatsRow, PlayerSeasonStats
from .team_mapping import from_sport_suite_abbrev
from . import espn_client

logger = structlog.get_logger(__name__)


# ── ESPN stat-label indices (Regular Season Averages) ─────────────
# Labels: GP, GS, MIN, FG, FG%, 3PT, 3P%, FT, FT%, OR, DR, REB, AST, BLK, STL, PF, TO, PTS
_STAT_IDX = {
    "gp": 0, "min": 2, "fg_pct": 4, "three_pct": 6, "ft_pct": 8,
    "reb": 11, "ast": 12, "blk": 13, "stl": 14, "pts": 17,
}


def _safe_float(val: str, default: str = "0.0") -> str:
    """Safely convert stat string, handling 'X-Y' format (e.g. '4.2-9.8')."""
    try:
        float(val)
        return val
    except (ValueError, TypeError):
        return default


async def get_player_season_stats(player_id: str) -> PlayerSeasonStats | None:
    """Fetch season stats — tries Sport-suite first, falls back to ESPN athlete stats."""
    # Try Sport-suite DB first
    pool = get_players_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT
                        COUNT(*) as gp,
                        ROUND(AVG(points)::numeric, 1) as ppg,
                        ROUND(AVG(rebounds)::numeric, 1) as rpg,
                        ROUND(AVG(assists)::numeric, 1) as apg,
                        ROUND(AVG(steals)::numeric, 1) as spg,
                        ROUND(AVG(blocks)::numeric, 1) as bpg,
                        CASE WHEN SUM(fg_attempted) > 0
                            THEN ROUND((SUM(fg_made)::numeric / SUM(fg_attempted) * 100), 1)
                            ELSE 0 END as fg_pct,
                        CASE WHEN SUM(three_pt_attempted) > 0
                            THEN ROUND((SUM(three_pointers_made)::numeric / SUM(three_pt_attempted) * 100), 1)
                            ELSE 0 END as three_pct,
                        CASE WHEN SUM(ft_attempted) > 0
                            THEN ROUND((SUM(ft_made)::numeric / SUM(ft_attempted) * 100), 1)
                            ELSE 0 END as ft_pct
                    FROM player_game_logs
                    WHERE player_id = $1::integer
                      AND game_date >= '2024-10-01'
                """, int(player_id) if player_id.isdigit() else 0)

                if row and row["gp"] > 0:
                    return PlayerSeasonStats(
                        gp=row["gp"],
                        ppg=str(row["ppg"]),
                        rpg=str(row["rpg"]),
                        apg=str(row["apg"]),
                        spg=str(row["spg"]),
                        bpg=str(row["bpg"]),
                        fg_pct=f"{row['fg_pct']}%",
                        three_pct=f"{row['three_pct']}%",
                        ft_pct=f"{row['ft_pct']}%",
                    )
        except Exception as e:
            logger.warning("player_season_stats.sport_suite_failed", player_id=player_id, error=str(e))

    # Fallback: ESPN athlete stats endpoint
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
    """Fetch recent game logs — tries Sport-suite first, falls back to ESPN gamelog."""
    # Try Sport-suite DB first
    pool = get_players_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT
                        game_date as date,
                        team_abbrev as team,
                        opponent_abbrev as opponent,
                        is_home,
                        points,
                        rebounds,
                        assists,
                        steals,
                        blocks,
                        fg_made,
                        fg_attempted,
                        three_pointers_made as tpm,
                        three_pt_attempted as tpa
                    FROM player_game_logs
                    WHERE player_id = $1::integer
                    ORDER BY game_date DESC
                    LIMIT 10
                """, int(player_id) if player_id.isdigit() else 0)

                if rows:
                    return [
                        {
                            "date": r["date"].strftime("%Y-%m-%d"),
                            "team": from_sport_suite_abbrev(r["team"]),
                            "opponent": from_sport_suite_abbrev(r["opponent"]),
                            "home_away": "vs" if r["is_home"] else "@",
                            "pts": r["points"],
                            "reb": r["rebounds"],
                            "ast": r["assists"],
                            "stl": r["steals"],
                            "blk": r["blocks"],
                            "fg": f"{r['fg_made']}-{r['fg_attempted']}",
                            "three": f"{r['tpm']}-{r['tpa']}"
                        }
                        for r in rows
                    ]
        except Exception as e:
            logger.warning("player_game_log.sport_suite_failed", player_id=player_id, error=str(e))

    # Fallback: ESPN gamelog endpoint
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

            result.append({
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
            })

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


# Stat categories to query from player_game_logs
_LEADER_CATEGORIES = {
    "pts": {"col": "points", "label": "Points Per Game", "espn_id": "points"},
    "reb": {"col": "rebounds", "label": "Rebounds Per Game", "espn_id": "rebounds"},
    "ast": {"col": "assists", "label": "Assists Per Game", "espn_id": "assists"},
    "stl": {"col": "steals", "label": "Steals Per Game", "espn_id": "steals"},
    "blk": {"col": "blocks", "label": "Blocks Per Game", "espn_id": "blocks"},
    "threes": {"col": "three_pointers_made", "label": "3PM Per Game", "espn_id": "threePointFieldGoalsMade"},
}


async def get_stat_leaders(limit: int = 10) -> StatLeadersResponse:
    """Get league stat leaders from Sport-suite player_game_logs with ESPN fallback."""
    pool = get_players_pool()
    categories = {}

    if pool:
        try:
            async with pool.acquire() as conn:
                for key, cfg in _LEADER_CATEGORIES.items():
                    col = cfg["col"]
                    try:
                        rows = await conn.fetch(f"""
                            SELECT
                                pp.full_name,
                                pp.player_id,
                                pp.headshot_url,
                                pgl.team_abbrev,
                                COUNT(*) as gp,
                                ROUND(AVG(pgl.{col})::numeric, 1) as avg_val
                            FROM player_game_logs pgl
                            JOIN player_profile pp ON pp.player_id = pgl.player_id
                            WHERE pgl.game_date >= '2025-01-01'
                            GROUP BY pp.full_name, pp.player_id, pp.headshot_url, pgl.team_abbrev
                            HAVING COUNT(*) >= 1
                            ORDER BY AVG(pgl.{col}) DESC
                            LIMIT $1
                        """, limit)

                        leaders = []
                        for i, r in enumerate(rows):
                            abbrev = from_sport_suite_abbrev(r["team_abbrev"])
                            leaders.append(StatLeader(
                                rank=i + 1,
                                player=r["full_name"],
                                player_id=str(r["player_id"]),
                                team=abbrev,
                                value=str(r["avg_val"]),
                                headshot_url=r["headshot_url"] or "",
                            ))

                        if leaders:
                            categories[key] = leaders
                    except Exception as cat_e:
                        logger.warning("stat_leaders.category_failed", category=key, error=str(cat_e))
        except Exception as e:
            logger.warning("stat_leaders.query_failed", error=str(e))

    # Fallback to ESPN core API if no categories from Sport-suite
    if not categories:
        try:
            espn_data = await espn_client.get_stat_leaders(limit=limit)
            if espn_data:
                # Build athlete lookup from cached rosters
                athlete_map = await _build_athlete_lookup()

                key_map = {
                    "pointsPerGame": "pts",
                    "reboundsPerGame": "reb",
                    "assistsPerGame": "ast",
                    "stealsPerGame": "stl",
                    "blocksPerGame": "blk",
                    "3PointsMadePerGame": "threes",
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
                        leaders.append(StatLeader(
                            rank=i + 1,
                            player=info.get("name", f"Player {aid}"),
                            player_id=aid,
                            team=info.get("abbrev", ""),
                            value=str(leader.get("displayValue", "0.0")),
                            headshot_url=f"https://a.espncdn.com/i/headshots/nba/players/full/{aid}.png" if aid else "",
                        ))
                    if leaders:
                        categories[key] = leaders[:limit]
        except Exception as espn_e:
            logger.warning("stat_leaders.espn_failed", error=str(espn_e))

    return StatLeadersResponse(categories=categories)


async def get_team_stats_list() -> list[TeamStatsRow]:
    """Get team stats from Sport-suite team_season_stats."""
    pool = get_teams_pool()
    if not pool:
        return []

    _SQL_CURRENT = (
        "SELECT team_abbrev, wins, losses,"
        " ROUND(pace::numeric, 1) as pace,"
        " ROUND(offensive_rating::numeric, 1) as ortg,"
        " ROUND(defensive_rating::numeric, 1) as drtg,"
        " ROUND(net_rating::numeric, 1) as net_rtg,"
        " ROUND(true_shooting_pct::numeric * 100, 1) as ts_pct,"
        " ROUND(rebounding_pct::numeric * 100, 1) as reb_pct"
        " FROM team_season_stats WHERE season = 2026"
        " ORDER BY net_rating DESC"
    )
    _SQL_FALLBACK = (
        "SELECT team_abbrev, wins, losses,"
        " ROUND(pace::numeric, 1) as pace,"
        " ROUND(offensive_rating::numeric, 1) as ortg,"
        " ROUND(defensive_rating::numeric, 1) as drtg,"
        " ROUND(net_rating::numeric, 1) as net_rtg,"
        " ROUND(true_shooting_pct::numeric * 100, 1) as ts_pct,"
        " ROUND(rebounding_pct::numeric * 100, 1) as reb_pct"
        " FROM team_season_stats"
        " WHERE season = (SELECT MAX(season) FROM team_season_stats)"
        " ORDER BY net_rating DESC"
    )
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(_SQL_CURRENT)

            if not rows:
                rows = await conn.fetch(_SQL_FALLBACK)

            return [
                TeamStatsRow(
                    rank=i + 1,
                    team=r["team_abbrev"],
                    abbrev=from_sport_suite_abbrev(r["team_abbrev"]),
                    record=f"{r['wins']}-{r['losses']}",
                    ortg=str(r["ortg"]),
                    drtg=str(r["drtg"]),
                    net_rtg=str(r["net_rtg"]),
                    pace=str(r["pace"]),
                    ts_pct=f"{r['ts_pct']}%",
                )
                for i, r in enumerate(rows)
            ]
    except Exception as e:
        logger.warning("team_stats_list.sport_suite_failed", error=str(e))
        return []
