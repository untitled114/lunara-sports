"""Team service - team details, roster, schedule, stats."""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Game, Team
from ..models.schemas import (
    RosterPlayer,
    TeamDetailResponse,
    TeamListItem,
    TeamPlayerStats,
    TeamScheduleGame,
)
from . import espn_client
from .player_service import headshot_url
from .team_mapping import espn_id_for, from_espn_abbrev

logger = structlog.get_logger(__name__)


async def get_teams(session: AsyncSession) -> list[dict]:
    """Get all teams grouped by conference/division with last game result."""
    stmt = select(Team).order_by(Team.conference, Team.division, Team.name)
    result = await session.execute(stmt)
    # The DB may carry alias rows (e.g. "UTAH" alongside "UTA") seeded so raw
    # ingestion FKs never failed before normalization existed - exclude any row
    # whose abbrev maps to a *different* canonical abbrev, so each team lists once.
    # Relies on from_espn_abbrev being idempotent for already-canonical codes
    # (from_espn_abbrev("UTA") == "UTA"), or this filter would drop everything.
    teams = [t for t in result.scalars().all() if from_espn_abbrev(t.abbrev) == t.abbrev]

    items = []
    for t in teams:
        # Try to get last game result
        last_game = ""
        try:
            game_stmt = (
                select(Game)
                .where((Game.home_team == t.abbrev) | (Game.away_team == t.abbrev))
                .where(Game.status == "final")
                .order_by(Game.start_time.desc())
                .limit(1)
            )
            res = await session.execute(game_stmt)
            g = res.scalar_one_or_none()
            if g:
                is_home = g.home_team == t.abbrev
                won = (is_home and g.home_score > g.away_score) or (
                    not is_home and g.away_score > g.home_score
                )
                opp = g.away_team if is_home else g.home_team
                prefix = "W" if won else "L"
                score = f"{max(g.home_score, g.away_score)}-{min(g.home_score, g.away_score)}"
                loc = "vs" if is_home else "@"
                last_game = f"{prefix} {score} {loc} {opp}"
        except Exception:
            pass

        items.append(
            TeamListItem(
                name=t.name,
                abbrev=t.abbrev,
                conference=t.conference,
                division=t.division,
                logo_url=t.logo_url or "",
                last_game=last_game,
            ).model_dump()
        )

    return items


async def get_team_detail(abbrev: str, session: AsyncSession) -> TeamDetailResponse | None:
    """Get team detail info, enriched with ESPN data."""
    stmt = select(Team).where(Team.abbrev == abbrev)
    result = await session.execute(stmt)
    team = result.scalar_one_or_none()

    if not team:
        return None

    # Try ESPN for record and extra info
    espn_id = espn_id_for(abbrev)
    record = ""
    city = ""
    venue = ""
    color = "#3b82f6"
    logo_url = team.logo_url or ""

    if espn_id:
        data = await espn_client.get_team_roster(espn_id)
        if data:
            t = data.get("team", {})
            record = (
                t.get("record", {}).get("items", [{}])[0].get("summary", "")
                if t.get("record")
                else ""
            )
            city = t.get("location", "")
            venue_info = t.get("franchise", {}).get("venue", {})
            venue = venue_info.get("fullName", "") if venue_info else ""
            color = f"#{t.get('color', '3b82f6')}"
            if t.get("logos"):
                logo_url = t["logos"][0].get("href", logo_url)

    return TeamDetailResponse(
        name=team.name,
        abbrev=team.abbrev,
        city=city,
        venue=venue,
        record=record,
        conference=team.conference or "",
        division=team.division or "",
        color=color,
        logo_url=logo_url,
    )


def _experience(athlete: dict) -> str:
    """Seasons in the NBA before this one: "R" for a rookie (0 years), "-" when ESPN gives none."""
    years = (athlete.get("experience") or {}).get("years")
    if years is None:
        return "-"
    return "R" if years == 0 else str(years)


async def get_team_roster(abbrev: str) -> list[RosterPlayer]:
    """Get team roster from ESPN's roster endpoint."""
    espn_id = espn_id_for(abbrev)
    if not espn_id:
        return []

    data = await espn_client.get_roster(espn_id)
    if not data:
        return []

    players = []
    athletes = data.get("athletes", [])

    for athlete in athletes:
        players.append(
            RosterPlayer(
                id=athlete.get("id", ""),
                jersey=athlete.get("jersey", ""),
                name=athlete.get("displayName", athlete.get("fullName", "")),
                position=athlete.get("position", {}).get("abbreviation", ""),
                height=athlete.get("displayHeight", ""),
                weight=athlete.get("displayWeight", "").replace(" lbs", ""),
                age=athlete.get("age"),
                experience=_experience(athlete),
                college=athlete.get("college", {}).get("name", "")
                if athlete.get("college")
                else "",
                headshot_url=headshot_url(athlete.get("headshot")),
            )
        )

    return players


_ET = ZoneInfo("America/New_York")
_STATUS_WORDS = {"scheduled": "Scheduled", "live": "Live", "halftime": "Halftime", "final": "Final"}


def _eastern(start: datetime) -> datetime:
    """A stored tip time in Eastern time (a naive value from the database is UTC)."""
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return start.astimezone(_ET)


async def get_team_schedule(abbrev: str, session: AsyncSession) -> list[TeamScheduleGame]:
    """A team's whole schedule from the games table, soonest first, in Eastern time."""
    stmt = (
        select(Game)
        .where((Game.home_team == abbrev) | (Game.away_team == abbrev))
        .order_by(Game.start_time.asc())
    )
    result = await session.execute(stmt)
    games = result.scalars().all()

    schedule = []
    for g in games:
        is_home = g.home_team == abbrev
        opp = g.away_team if is_home else g.home_team
        home_away = "vs" if is_home else "@"

        result_str = ""
        score = ""
        if g.status == "final":
            won = (is_home and g.home_score > g.away_score) or (
                not is_home and g.away_score > g.home_score
            )
            result_str = "W" if won else "L"
            score = (
                f"{g.home_score}-{g.away_score}" if is_home else f"{g.away_score}-{g.home_score}"
            )

        tip = _eastern(g.start_time) if g.start_time else None
        day = f"{tip:%a}, {tip:%b} {tip.day}" if tip else ""
        schedule.append(
            TeamScheduleGame(
                game_id=g.id,
                date=day,
                opponent=f"{home_away} {opp}",
                home_away=home_away,
                result=f"{result_str} {score}" if result_str else "",
                status=_STATUS_WORDS.get(g.status, g.status.capitalize()),
                score=score,
                start=tip.isoformat() if tip else "",
                day=day,
                tip=tip.strftime("%-I:%M %p") if tip else "",
            )
        )

    return schedule


async def get_team_stats(abbrev: str) -> list[TeamPlayerStats]:
    """Per-team player stats: no data source is connected, so it always returns empty."""
    return []
