"""Stats service: league leaders and team statistics from ESPN."""

from __future__ import annotations

import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

import structlog

from ..models.schemas import (
    CategoryLeadersResponse,
    PlayerSeasonStats,
    PlayerTableResponse,
    PlayerTableRow,
    StatLeader,
    StatLeadersResponse,
    TeamStatsRow,
)
from . import espn_client
from .standings_service import choose_regular_season
from .team_mapping import ESPN_TEAM_IDS, from_espn_abbrev

logger = structlog.get_logger(__name__)


# ESPN stat-label indices (Regular Season Averages)
# Labels: GP, GS, MIN, FG, FG%, 3PT, 3P%, FT, FT%, OR, DR, REB, AST, BLK, STL, PF, TO, PTS
def _safe_float(val: str, default: str = "0.0") -> str:
    """Safely convert stat string, handling 'X-Y' format (e.g. '4.2-9.8')."""
    try:
        float(val)
        return val
    except (ValueError, TypeError):
        return default


def _int_or_none(value: str | None) -> int | None:
    try:
        return int(float(value)) if value not in (None, "") else None
    except ValueError:
        return None


def _season_row(data: dict, category: str, season: str) -> dict[str, str]:
    """label -> value for one category's row of the given season ({} when absent)."""
    for cat in data.get("categories", []):
        if cat.get("name") != category:
            continue
        labels = cat.get("labels", [])
        for row in cat.get("statistics", []):
            if (row.get("season") or {}).get("displayName") == season:
                return dict(zip(labels, row.get("stats", []), strict=False))
    return {}


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

            # Build label->value map
            stat_map = {}
            for i, label in enumerate(labels):
                if i < len(vals):
                    stat_map[label] = vals[i]

            gp = int(float(stat_map.get("GP", "0")))
            if gp == 0:
                continue

            season = (current.get("season") or {}).get("displayName", "")
            misc = _season_row(data, "miscellaneous", season)

            return PlayerSeasonStats(
                season=season,
                gs=_int_or_none(stat_map.get("GS")),
                mpg=stat_map.get("MIN", ""),
                fg=stat_map.get("FG", ""),
                three=stat_map.get("3PT", ""),
                ft=stat_map.get("FT", ""),
                orpg=stat_map.get("OR", ""),
                drpg=stat_map.get("DR", ""),
                tovpg=stat_map.get("TO", ""),
                pfpg=stat_map.get("PF", ""),
                double_doubles=_int_or_none(misc.get("DD2")),
                triple_doubles=_int_or_none(misc.get("TD3")),
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


_ET = ZoneInfo("America/New_York")


def _eastern_date(game_date: str) -> str:
    """ESPN's UTC gameDate as the Eastern calendar day (an evening tip is 00:30 UTC the
    next day); a value that does not parse is cut to its date part as before."""
    try:
        return (
            datetime.fromisoformat(game_date.replace("Z", "+00:00"))
            .astimezone(_ET)
            .date()
            .isoformat()
        )
    except ValueError:
        return game_date[:10]


def _team_first(score: str, result: str) -> str:
    """ESPN's winner-first score with the player's team first (a loss "121-102" -> "102-121")."""
    try:
        a, b = (int(x) for x in score.split("-"))
    except ValueError:
        return score
    hi, lo = max(a, b), min(a, b)
    return f"{hi}-{lo}" if result == "W" else f"{lo}-{hi}" if result == "L" else score


async def get_player_game_log(player_id: str) -> list[dict]:
    """Fetch recent game logs from the ESPN gamelog endpoint."""
    try:
        data = await espn_client.get_athlete_gamelog(player_id)
        if not data:
            return []

        labels = data.get("labels", [])
        events_meta = data.get("events", {})

        # Build label->index map
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
            game_date = _eastern_date(meta.get("gameDate", ""))

            def _get(label, default="0"):
                idx = label_idx.get(label)
                if idx is not None and idx < len(stats):
                    return stats[idx]
                return default

            result.append(
                {
                    "event_id": eid,
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
                    "score": _team_first(meta.get("score", ""), meta.get("gameResult", "")),
                }
            )

        return result
    except Exception as e:
        logger.warning("player_game_log.espn_failed", player_id=player_id, error=str(e))
        return []


# Each leaders category and the ESPN stat it ranks by (statistics/byathlete sort keys).
LEADER_SORTS = {
    "pts": "offensive.avgPoints",
    "reb": "general.avgRebounds",
    "ast": "offensive.avgAssists",
    "threes": "offensive.avgThreePointFieldGoalsMade",
    "stl": "defensive.avgSteals",
    "blk": "defensive.avgBlocks",
    "fg_pct": "offensive.fieldGoalPct",
    "three_pct": "offensive.threePointFieldGoalPct",
    "ft_pct": "offensive.freeThrowPct",
}


def _leader_rows(data: dict, sort: str, limit: int) -> list[StatLeader]:
    """A qualified list's athletes, best first, with the value of the stat it is sorted by."""
    names = {c.get("name"): c.get("names") or [] for c in data.get("categories") or []}
    cat, stat = sort.split(".")
    idx = names.get(cat, []).index(stat) if stat in names.get(cat, []) else None
    general = names.get("general", [])
    gp_idx = general.index("gamesPlayed") if "gamesPlayed" in general else None
    rows: list[StatLeader] = []
    for row in data.get("athletes") or []:
        athlete = row.get("athlete") or {}
        by_cat = {c.get("name"): c.get("values") or [] for c in row.get("categories") or []}
        values = by_cat.get(cat, [])
        if idx is None or idx >= len(values) or not athlete.get("id"):
            continue
        gp_values = by_cat.get("general", [])
        gp = gp_values[gp_idx] if gp_idx is not None and gp_idx < len(gp_values) else None
        aid = athlete["id"]
        rows.append(
            StatLeader(
                rank=len(rows) + 1,
                player=athlete.get("displayName", ""),
                player_id=aid,
                team=from_espn_abbrev(athlete.get("teamShortName", "")),
                position=(athlete.get("position") or {}).get("abbreviation"),
                value=f"{values[idx]:.1f}",
                gp=int(gp) if gp is not None else None,
                headshot_url=f"https://a.espncdn.com/i/headshots/nba/players/full/{aid}.png",
            )
        )
    return rows[:limit]


# Every qualified player of a category in one request (319 qualified for points on
# 2026-11-26), so the Stats page's filters see the whole list.
CATEGORY_FETCH = 500


async def get_category_leaders(
    category: str,
    limit: int = 10,
    team: str | None = None,
    position: str | None = None,
    conference: str | None = None,
) -> CategoryLeadersResponse | None:
    """One category's qualified leaders, filtered by team, position (G, F, C) or conference
    (east, west), best first and ranked within the filter. None for an unknown category."""
    sort = LEADER_SORTS.get(category)
    if sort is None:
        return None
    choice = await choose_regular_season()
    if not choice or not choice.year:
        return CategoryLeadersResponse(category=category)
    data = await espn_client.get_qualified_leaders(choice.year, sort, CATEGORY_FETCH) or {}
    rows = _leader_rows(data, sort, CATEGORY_FETCH)
    qualified = (data.get("pagination") or {}).get("count") or len(rows)
    shown = rows
    if team:
        shown = [r for r in shown if r.team == team.upper()]
    if position:
        shown = [r for r in shown if (r.position or "").upper() == position.upper()]
    if conference in ("east", "west"):
        members = {t.abbrev for t in (choice.eastern if conference == "east" else choice.western)}
        shown = [r for r in shown if r.team in members]
    filtered = bool(team or position or conference in ("east", "west"))
    return CategoryLeadersResponse(
        category=category,
        season_label=f"{choice.years} regular season",
        is_previous_season=bool(choice.is_previous),
        qualified=qualified,
        matching=len(shown) if filtered else qualified,
        rows=[r.model_copy(update={"rank": i + 1}) for i, r in enumerate(shown[:limit])],
    )


async def _qualified(season: int, limit: int) -> tuple[dict[str, list[StatLeader]], str]:
    """Every category's qualified leaders for one season, and the season's name ("2026-27")."""
    payloads = await asyncio.gather(
        *(espn_client.get_qualified_leaders(season, sort, limit) for sort in LEADER_SORTS.values())
    )
    categories: dict[str, list[StatLeader]] = {}
    years = ""
    for (key, sort), data in zip(LEADER_SORTS.items(), payloads, strict=True):
        if not data:
            continue
        rows = _leader_rows(data, sort, limit)
        if rows:
            categories[key] = rows
            years = years or ((data.get("requestedSeason") or {}).get("displayName") or "")
    return categories, years


async def get_stat_leaders(limit: int = 10) -> StatLeadersResponse:
    """League leaders under the NBA's qualifying rules for the regular season the standings
    show: last season's until this season's first regular-season game, then this season's."""
    categories: dict[str, list[StatLeader]] = {}
    years = ""
    is_previous = False
    count = None
    try:
        choice = await choose_regular_season()
        if choice and choice.year:
            season = choice.year
            categories, years = await _qualified(season, limit)
            is_previous = bool(choice.is_previous)
            if not categories and not choice.is_previous:
                # A new season can have standings before ESPN ranks anyone: keep last season's.
                season -= 1
                categories, years = await _qualified(season, limit)
                is_previous = True
            if categories:
                count = await espn_client.get_player_count(season)
    except Exception as espn_e:
        logger.warning("stat_leaders.espn_failed", error=str(espn_e))
        categories = {}

    return StatLeadersResponse(
        categories=categories,
        season_label=f"{years} regular season" if categories and years else "",
        is_previous_season=is_previous if categories else False,
        player_count=count if categories else None,
    )


def _team_stat_rows(data: dict, records: dict[str, str]) -> list[TeamStatsRow]:
    """Rows from ESPN's statistics/byteam payload.

    Each team lists every category twice: its own numbers, then its opponents'. A
    category's stat names are on the payload's top-level ``categories`` entry at the
    same position (the opponents' entry repeats the names of the team's).
    """
    headers = data.get("categories") or []
    rows = []
    for entry in data.get("teams") or []:
        own: dict[str, float] = {}
        opp: dict[str, float] = {}
        names_by_category: dict[str, list[str]] = {}
        for i, category in enumerate(entry.get("categories") or []):
            name = category.get("name", "")
            header = headers[i] if i < len(headers) else {}
            names = header.get("names") or names_by_category.get(name, [])
            target = opp if name in names_by_category else own
            names_by_category.setdefault(name, names)
            for stat, value in zip(names, category.get("values") or [], strict=False):
                target.setdefault(f"{name}.{stat}", value)
        team = entry.get("team") or {}
        abbrev = from_espn_abbrev(team.get("abbreviation", ""))

        def one(source: dict, key: str) -> str:
            value = source.get(key)
            return "" if value is None else f"{value:.1f}"

        rows.append(
            TeamStatsRow(
                rank=0,
                team=team.get("displayName", abbrev),
                abbrev=abbrev,
                record=records.get(abbrev, ""),
                games=int(own.get("general.gamesPlayed", 0)),
                ppg=one(own, "offensive.avgPoints"),
                opp_ppg=one(opp, "offensive.avgPoints"),
                diff=one(own, "differential.avgPointsDifferential"),
                fg_pct=one(own, "offensive.fieldGoalPct"),
                three_pct=one(own, "offensive.threePointFieldGoalPct"),
                ft_pct=one(own, "offensive.freeThrowPct"),
                rpg=one(own, "general.avgRebounds"),
                apg=one(own, "offensive.avgAssists"),
                spg=one(own, "defensive.avgSteals"),
                bpg=one(own, "defensive.avgBlocks"),
                tov=one(own, "offensive.avgTurnovers"),
            )
        )
    rows.sort(key=lambda r: float(r.diff) if r.diff else float("-inf"), reverse=True)
    return [r.model_copy(update={"rank": i}) for i, r in enumerate(rows, start=1)]


async def get_team_stats_list() -> list[TeamStatsRow]:
    """Every team's per-game numbers for the regular season the standings show (last
    season's until this season's first game), best point differential first."""
    try:
        choice = await choose_regular_season()
        if not choice or not choice.year:
            return []
        data = await espn_client.get_team_stats(choice.year)
    except Exception as e:
        logger.warning("stats.team_stats_failed", error=str(e))
        return []
    if not data:
        return []
    records = {t.abbrev: f"{t.w}-{t.l}" for t in [*choice.eastern, *choice.western]}
    return _team_stat_rows(data, records)


# The Players table's stat columns: (ESPN category, stat name).
PLAYER_STATS = {
    "gp": ("general", "gamesPlayed"),
    "min": ("general", "avgMinutes"),
    "pts": ("offensive", "avgPoints"),
    "reb": ("general", "avgRebounds"),
    "ast": ("offensive", "avgAssists"),
    "threes": ("offensive", "avgThreePointFieldGoalsMade"),
    "stl": ("defensive", "avgSteals"),
    "blk": ("defensive", "avgBlocks"),
    "fg_pct": ("offensive", "fieldGoalPct"),
    "three_pct": ("offensive", "threePointFieldGoalPct"),
    "ft_pct": ("offensive", "freeThrowPct"),
}
PLAYER_SORTS = {"player", "team", "position", "age", *PLAYER_STATS}
# The games rule: a player qualifies after playing 70% of their team's games so far.
GAMES_SHARE = 0.7


async def _jerseys() -> dict[str, str]:
    """Every rostered player's jersey number by ESPN id (rosters are cached for a day)."""
    rosters = await asyncio.gather(
        *(espn_client.get_roster(espn_id) for espn_id in ESPN_TEAM_IDS.values()),
        return_exceptions=True,
    )
    out: dict[str, str] = {}
    for data in rosters:
        if isinstance(data, dict):
            for a in data.get("athletes") or []:
                if a.get("id") and a.get("jersey"):
                    out[str(a["id"])] = str(a["jersey"])
    return out


def _player_rows(data: dict, jerseys: dict[str, str]) -> list[tuple[PlayerTableRow, dict]]:
    """ESPN's all-players list as table rows, each with its raw numbers for sorting."""
    names = {c.get("name"): c.get("names") or [] for c in data.get("categories") or []}
    rows = []
    for item in data.get("athletes") or []:
        ath = item.get("athlete") or {}
        if not ath.get("id"):
            continue
        by_cat = {c.get("name"): c.get("values") or [] for c in item.get("categories") or []}
        raw: dict[str, float | None] = {}
        for key, (cat, stat) in PLAYER_STATS.items():
            idx = names.get(cat, []).index(stat) if stat in names.get(cat, []) else None
            vals = by_cat.get(cat, [])
            raw[key] = vals[idx] if idx is not None and idx < len(vals) else None
        fmt = {k: (f"{v:.1f}" if v is not None else "") for k, v in raw.items() if k != "gp"}
        aid = str(ath["id"])
        row = PlayerTableRow(
            player_id=aid,
            player=ath.get("displayName", ""),
            team=from_espn_abbrev(ath.get("teamShortName", "")),
            team_name=ath.get("teamName", "") or "",
            position=(ath.get("position") or {}).get("abbreviation"),
            age=ath.get("age"),
            jersey=jerseys.get(aid),
            gp=int(raw["gp"]) if raw["gp"] is not None else None,
            headshot_url=f"https://a.espncdn.com/i/headshots/nba/players/full/{aid}.png",
            **fmt,
        )
        rows.append((row, raw))
    return rows


def _matches(row: PlayerTableRow, tokens: list[str]) -> bool:
    """Every search word matches the name, the team (abbreviation or nickname) or the number."""
    for tok in tokens:
        if tok.isdigit():
            if row.jersey != tok:
                return False
        elif not (
            tok in row.player.lower() or tok == row.team.lower() or tok in row.team_name.lower()
        ):
            return False
    return True


async def get_player_table(
    sort: str = "pts",
    dir: str = "desc",
    page: int = 1,
    per_page: int = 25,
    q: str = "",
    team: str | None = None,
    position: str | None = None,
    conference: str | None = None,
    all_players: bool = False,
) -> PlayerTableResponse:
    """One page of every player with stats this season, after the search, the filters and
    the games rule (off with ``all_players``), sorted by any column."""
    sort = sort if sort in PLAYER_SORTS else "pts"
    dir = "asc" if dir == "asc" else "desc"
    choice = await choose_regular_season()
    if not choice or not choice.year:
        return PlayerTableResponse(sort=sort, dir=dir)
    data, jerseys = await asyncio.gather(espn_client.get_all_player_stats(choice.year), _jerseys())
    rows = _player_rows(data or {}, jerseys)

    team_games = {t.abbrev: t.w + t.l for t in choice.eastern + choice.western}
    if not all_players:
        rows = [
            (r, raw)
            for r, raw in rows
            if team_games.get(r.team) and (r.gp or 0) / team_games[r.team] >= GAMES_SHARE
        ]
    if team:
        rows = [(r, raw) for r, raw in rows if r.team == team.upper()]
    if position:
        rows = [(r, raw) for r, raw in rows if (r.position or "").upper() == position.upper()]
    if conference in ("east", "west"):
        members = {t.abbrev for t in (choice.eastern if conference == "east" else choice.western)}
        rows = [(r, raw) for r, raw in rows if r.team in members]
    tokens = q.lower().split()
    if tokens:
        rows = [(r, raw) for r, raw in rows if _matches(r, tokens)]

    if sort in PLAYER_STATS:
        rows.sort(key=lambda x: (x[1][sort] is None, x[1][sort] or 0), reverse=False)
        if dir == "desc":
            present = [x for x in rows if x[1][sort] is not None]
            missing = [x for x in rows if x[1][sort] is None]
            rows = present[::-1] + missing
    else:
        rows.sort(
            key=lambda x: (getattr(x[0], sort) is None, getattr(x[0], sort) or ""),
            reverse=dir == "desc",
        )

    page = max(1, page)
    start = (page - 1) * per_page
    return PlayerTableResponse(
        season_label=f"{choice.years} regular season",
        total=len(rows),
        page=page,
        per_page=per_page,
        sort=sort,
        dir=dir,
        rows=[r for r, _ in rows[start : start + per_page]],
    )
