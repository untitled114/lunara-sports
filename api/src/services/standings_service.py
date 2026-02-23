"""Standings service — parse ESPN standings into structured response."""

from __future__ import annotations

import structlog

from ..models.schemas import StandingsResponse, StandingsTeam
from . import espn_client
from .team_mapping import ABBREV_BY_ESPN_ID

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

        # Map ESPN abbreviations to our local ones
        abbrev_map = {
            "GS": "GS",
            "GSW": "GS",
            "WSH": "WSH",
            "WAS": "WSH",
            "NY": "NY",
            "NYK": "NY",
            "NO": "NO",
            "NOP": "NO",
            "SA": "SA",
            "SAS": "SA",
        }
        abbrev = abbrev_map.get(abbrev, abbrev)

        wins = int(_get_stat(entry, "wins") or _get_stat(entry, "W") or 0)
        losses = int(_get_stat(entry, "losses") or _get_stat(entry, "L") or 0)
        total = wins + losses
        pct = f".{int(wins / total * 1000):03d}" if total > 0 else ".000"
        gb = _get_stat(entry, "gamesBehind") or _get_stat(entry, "GB") or "-"
        streak = _get_stat(entry, "streak") or ""

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
            )
        )

    # Sort by winning percentage descending (best teams first)
    teams.sort(key=lambda t: t.w / (t.w + t.l) if (t.w + t.l) > 0 else 0, reverse=True)
    for i, team in enumerate(teams):
        team.rank = i + 1

    return teams


async def get_standings() -> StandingsResponse:
    """Fetch and parse NBA standings from ESPN."""
    data = await espn_client.get_standings()
    if not data:
        return StandingsResponse(eastern=[], western=[])

    eastern = []
    western = []

    # ESPN structure: children[] contains conference groups
    children = data.get("children", [])
    for child in children:
        conf_name = child.get("name", "").lower()
        if "east" in conf_name:
            eastern = _parse_conference(child)
        elif "west" in conf_name:
            western = _parse_conference(child)

    season = data.get("seasons", [{}])[0].get("displayName", "") if data.get("seasons") else ""

    return StandingsResponse(eastern=eastern, western=western, season=season)
