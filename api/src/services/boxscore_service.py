"""Box score service — fetch detailed box score from ESPN game summary."""

from __future__ import annotations

import structlog

from . import espn_client
from ..models.schemas import BoxScorePlayer, BoxScoreResponse, BoxScoreTeam

logger = structlog.get_logger(__name__)


def _safe_int(val: str) -> int:
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0


def _parse_player_stats(player_data: dict, labels: list[str]) -> BoxScorePlayer:
    """Parse a single player's box score stats using label-based indexing."""
    athlete = player_data.get("athlete", {})
    stats = player_data.get("stats", [])

    # Build a label→value map so we don't rely on hardcoded indices
    stat_map: dict[str, str] = {}
    for i, label in enumerate(labels):
        if i < len(stats):
            stat_map[label.upper()] = stats[i]

    # Extract headshot URL
    headshot = athlete.get("headshot", {})
    headshot_url = headshot.get("href", "") if headshot else ""
    if not headshot_url:
        # Fallback: construct from athlete ID
        aid = athlete.get("id", "")
        if aid:
            headshot_url = f"https://a.espncdn.com/i/headshots/nba/players/full/{aid}.png"

    return BoxScorePlayer(
        name=athlete.get("displayName", ""),
        position=athlete.get("position", {}).get("abbreviation", "") if athlete.get("position") else "",
        starter=player_data.get("starter", False),
        headshot_url=headshot_url,
        jersey=athlete.get("jersey", ""),
        minutes=stat_map.get("MIN", "0"),
        fg=stat_map.get("FG", "0-0"),
        three_pt=stat_map.get("3PT", "0-0"),
        ft=stat_map.get("FT", "0-0"),
        rebounds=_safe_int(stat_map.get("REB", "0")),
        assists=_safe_int(stat_map.get("AST", "0")),
        fouls=_safe_int(stat_map.get("PF", "0")),
        steals=_safe_int(stat_map.get("STL", "0")),
        blocks=_safe_int(stat_map.get("BLK", "0")),
        turnovers=_safe_int(stat_map.get("TO", "0")),
        plus_minus=stat_map.get("+/-", "0"),
        points=_safe_int(stat_map.get("PTS", "0")),
    )


def _parse_team_boxscore(team_data: dict) -> BoxScoreTeam:
    """Parse a team's box score from ESPN summary."""
    team_info = team_data.get("team", {})
    abbrev = team_info.get("abbreviation", "")
    # Normalize
    norm = {"GSW": "GS", "WAS": "WSH", "NYK": "NY", "NOP": "NO", "SAS": "SA"}
    abbrev = norm.get(abbrev, abbrev)

    players = []
    for stat_group in team_data.get("statistics", []):
        if stat_group.get("name") == "basketball" or not stat_group.get("name"):
            labels = stat_group.get("labels", [])
            for athlete_data in stat_group.get("athletes", []):
                players.append(_parse_player_stats(athlete_data, labels))

    # Parse totals
    totals = {}
    for stat_group in team_data.get("statistics", []):
        totals_list = stat_group.get("totals", [])
        if totals_list:
            labels = stat_group.get("labels", [])
            for label, val in zip(labels, totals_list):
                totals[label] = val

    return BoxScoreTeam(
        team=team_info.get("displayName", ""),
        abbrev=abbrev,
        players=players,
        totals=totals,
    )


async def get_boxscore(game_id: str) -> BoxScoreResponse | None:
    """Fetch box score for a game from ESPN summary endpoint."""
    data = await espn_client.get_game_summary(game_id)
    if not data:
        return None

    boxscore = data.get("boxscore", {})
    team_data = boxscore.get("players", [])

    if len(team_data) < 2:
        return None

    away_team = _parse_team_boxscore(team_data[0])
    home_team = _parse_team_boxscore(team_data[1])

    return BoxScoreResponse(
        home=home_team,
        away=away_team,
        game_id=game_id,
    )
