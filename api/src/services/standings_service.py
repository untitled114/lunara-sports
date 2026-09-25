"""Standings service — parse ESPN standings into structured response."""

from __future__ import annotations

from dataclasses import dataclass, field

import structlog

from ..models.schemas import StandingsResponse, StandingsTeam
from . import espn_client
from .team_mapping import ABBREV_BY_ESPN_ID, from_espn_abbrev

logger = structlog.get_logger(__name__)


def _parse_record(entry: dict, record_type: str) -> str:
    """Extract a specific record string from ESPN standings entry."""
    for item in entry.get("stats", []):
        if item.get("abbreviation") == record_type or item.get("name") == record_type:
            return item.get("displayValue", "")
    return ""


def _get_stat(entry: dict, name: str) -> str:
    """Get a stat value by name from ESPN standings entry."""
    for item in entry.get("stats", []):
        if item.get("name") == name or item.get("abbreviation") == name:
            return item.get("displayValue", "")
    return ""


def _parse_conference(conf_data: dict) -> list[StandingsTeam]:
    """Parse a conference's standings entries into StandingsTeam list."""
    teams = []
    entries = conf_data.get("standings", {}).get("entries", [])

    for _i, entry in enumerate(entries):
        team_info = entry.get("team", {})
        espn_id = int(team_info.get("id", 0))
        abbrev = team_info.get("abbreviation", ABBREV_BY_ESPN_ID.get(espn_id, "???"))

        # Same ESPN-abbreviation normalization games use (e.g. "UTAH" -> "UTA"),
        # so standings and games agree on team abbreviations.
        abbrev = from_espn_abbrev(abbrev)

        wins = int(_get_stat(entry, "wins") or _get_stat(entry, "W") or 0)
        losses = int(_get_stat(entry, "losses") or _get_stat(entry, "L") or 0)
        total = wins + losses
        pct = f".{int(wins / total * 1000):03d}" if total > 0 else ".000"
        gb = _get_stat(entry, "gamesBehind") or _get_stat(entry, "GB") or "-"
        streak = _get_stat(entry, "streak") or ""

        seed_raw = _get_stat(entry, "playoffSeed")
        seed = int(seed_raw) if seed_raw.isdigit() and int(seed_raw) > 0 else None

        # Try to get record breakdowns
        conf_record = ""
        home_record = ""
        road_record = ""
        l10_record = ""
        for rec in entry.get("stats", []):
            n = rec.get("name", "")
            if n == "clinpiRecord" or n == "vsConf" or "conference" in n.lower():
                conf_record = rec.get("displayValue", "")
            elif n == "Home" or n == "home":
                home_record = rec.get("displayValue", "")
            elif n == "Road" or n == "road" or n == "Away":
                road_record = rec.get("displayValue", "")
            elif "L10" in n or "last ten" in n.lower() or "last10" in n.lower():
                l10_record = rec.get("displayValue", "")

        logo_url = team_info.get("logos", [{}])[0].get("href", "") if team_info.get("logos") else ""

        teams.append(
            StandingsTeam(
                rank=0,  # assigned after sorting
                name=team_info.get("displayName", team_info.get("name", "")),
                abbrev=abbrev,
                w=wins,
                l=losses,
                pct=pct,
                gb=gb if gb != "0" else "-",
                conf=conf_record,
                home=home_record,
                road=road_record,
                l10=l10_record,
                strk=streak,
                logo_url=logo_url,
                seed=seed,
            )
        )

    # Sort by winning percentage descending (best teams first)
    teams.sort(key=lambda t: t.w / (t.w + t.l) if (t.w + t.l) > 0 else 0, reverse=True)
    for i, team in enumerate(teams):
        team.rank = i + 1

    return teams


def _season_years(data: dict, index: int) -> tuple[int | None, str]:
    """Return (end-year, display years) for the season at `index` in ESPN's seasons[] list."""
    seasons = data.get("seasons") or []
    if len(seasons) <= index:
        return None, ""
    s = seasons[index]
    return s.get("year"), (s.get("seasonYears") or s.get("displayName") or "")


def _label(years: str, final: bool) -> str:
    """Render a season-years string (e.g. "2025-26") as a display label."""
    if not years:
        return ""  # ESPN sent no season name: no label rather than " final"
    pretty = years.replace("-", "–")
    return f"{pretty} final" if final else pretty


def _parse(data: dict) -> tuple[list[StandingsTeam], list[StandingsTeam]]:
    """Parse ESPN standings payload children[] into (eastern, western) team lists."""
    eastern: list[StandingsTeam] = []
    western: list[StandingsTeam] = []
    for child in data.get("children", []):
        name = child.get("name", "").lower()
        if "east" in name:
            eastern = _parse_conference(child)
        elif "west" in name:
            western = _parse_conference(child)
    return eastern, western


@dataclass
class SeasonChoice:
    """Which regular season to show, decided once for standings and stat leaders.

    `year` is ESPN's end-year for that season (2026 = 2025-26), `years` its display
    years ("2025-26"), `is_previous` whether it is last season's (the current one has
    no regular-season games yet). `eastern`/`western` are that season's parsed
    standings.
    """

    year: int | None
    years: str
    is_previous: bool
    eastern: list[StandingsTeam] = field(default_factory=list)
    western: list[StandingsTeam] = field(default_factory=list)


async def choose_regular_season() -> SeasonChoice | None:
    """The current regular season once any regular-season game is played; before that,
    the previous completed regular season. None when ESPN has no standings at all.

    ESPN's default standings are the regular season (seasonType 2), so preseason games
    never count. If the previous season can't be loaded (or has no conferences), the
    current season is used.
    """
    data = await espn_client.get_standings(season=None)
    if not data:
        return None

    eastern, western = _parse(data)
    cur_year, cur_years = _season_years(data, 0)
    current = SeasonChoice(cur_year, cur_years, False, eastern, western)
    if any(t.w + t.l for t in eastern + western):
        return current

    prev_year, prev_years = _season_years(data, 1)
    prev = await espn_client.get_standings(season=prev_year) if prev_year else None
    if not prev:
        return current
    p_east, p_west = _parse(prev)
    if not (p_east or p_west):
        # A previous-season payload with no conferences is no fallback at all.
        return current
    return SeasonChoice(prev_year, prev_years, True, p_east, p_west)


async def get_standings() -> StandingsResponse:
    """Current standings; before the regular season starts, last season's final standings."""
    choice = await choose_regular_season()
    if choice is None:
        return StandingsResponse(eastern=[], western=[])
    return StandingsResponse(
        eastern=choice.eastern,
        western=choice.western,
        season=choice.years,
        season_label=_label(choice.years, final=choice.is_previous),
        is_previous_season=choice.is_previous,
    )
