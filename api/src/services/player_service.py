"""Player service -- fetch all player rosters from ESPN."""

from __future__ import annotations

import structlog

from . import espn_client
from .team_mapping import ESPN_TEAM_IDS

logger = structlog.get_logger(__name__)


def _parse_athlete(a: dict) -> dict:
    """Parse an ESPN athlete object into a player dict."""
    return {
        "id": a.get("id", ""),
        "name": a.get("displayName", a.get("fullName", "")),
        "jersey": a.get("jersey", ""),
        "position": a.get("position", {}).get("abbreviation", ""),
        "height": a.get("displayHeight", ""),
        "weight": a.get("displayWeight", "").replace(" lbs", ""),
        "headshot_url": (a.get("headshot", {}).get("href", "") if a.get("headshot") else ""),
    }


def _parse_athlete_full(a: dict) -> dict:
    """Parse an ESPN athlete with full bio details."""
    base = _parse_athlete(a)
    base.update(
        {
            "age": a.get("age"),
            "experience": (
                str(a.get("experience", {}).get("years", ""))
                if isinstance(a.get("experience"), dict)
                else str(a.get("experience", ""))
            ),
            "college": (
                a.get("college", {}).get("name", "")
                if isinstance(a.get("college"), dict)
                else str(a.get("college", ""))
            ),
        }
    )
    return base


def _parse_v3_athlete(athlete: dict) -> dict:
    """Parse an ESPN common/v3 athlete object into a full player dict."""
    headshot = athlete.get("headshot", {})
    position = athlete.get("position", {})
    team = athlete.get("team", {})

    return {
        "id": athlete.get("id", ""),
        "name": athlete.get("displayName", athlete.get("fullName", "")),
        "jersey": athlete.get("jersey", athlete.get("displayJersey", "")),
        "position": position.get("abbreviation", ""),
        "height": athlete.get("displayHeight", ""),
        "weight": athlete.get("displayWeight", "").replace(" lbs", ""),
        "headshot_url": headshot.get("href", "") if headshot else "",
        "age": athlete.get("age"),
        "experience": athlete.get("displayExperience", ""),
        "college": "",  # Not available from ESPN APIs
        "draft": athlete.get("displayDraft", ""),
        "birthplace": athlete.get("displayBirthPlace", ""),
        "team": team.get("displayName", ""),
        "team_abbrev": team.get("abbreviation", ""),
    }


async def get_all_players(search: str = "") -> list[dict]:
    """Fetch all team rosters and optionally filter by player name.

    Returns list of {team, abbrev, players: [...]} dicts.
    """
    tasks = []
    for abbrev, espn_id in ESPN_TEAM_IDS.items():
        tasks.append((abbrev, espn_client.get_team_roster(espn_id)))

    results = []
    for abbrev, coro in tasks:
        data = await coro
        if not data:
            continue

        team_data = data.get("team", {})
        team_name = team_data.get("displayName", "")
        athletes = team_data.get("athletes", [])

        players = []
        for a in athletes:
            name = a.get("displayName", a.get("fullName", ""))
            if search and search.lower() not in name.lower():
                continue
            players.append(_parse_athlete(a))

        if players or not search:
            results.append(
                {
                    "team": team_name,
                    "abbrev": abbrev,
                    "players": players[:10] if not search else players,
                }
            )

    results.sort(key=lambda x: x["team"])
    return results


async def get_player_by_id(player_id: str) -> dict | None:
    """Find a specific player by their ESPN ID.

    Tries roster cache first, falls back to ESPN v3 athlete endpoint for richer data.
    """
    # First: try ESPN v3 athlete endpoint (richer data: age, draft, birthplace)
    try:
        data = await espn_client.get_athlete_info(player_id)
        if data:
            athlete = data.get("athlete", data)
            if athlete.get("id") or athlete.get("displayName"):
                return _parse_v3_athlete(athlete)
    except Exception as e:
        logger.warning("player_by_id.v3_failed", player_id=player_id, error=str(e))

    # Fallback: scan rosters
    for abbrev, espn_id in ESPN_TEAM_IDS.items():
        data = await espn_client.get_team_roster(espn_id)
        if not data:
            continue

        team_data = data.get("team", {})
        team_name = team_data.get("displayName", "")
        athletes = team_data.get("athletes", [])

        for a in athletes:
            if a.get("id") == player_id:
                player = _parse_athlete_full(a)
                player["team"] = team_name
                player["team_abbrev"] = abbrev
                return player

    return None
