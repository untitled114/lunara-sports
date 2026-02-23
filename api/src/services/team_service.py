"""Team service — team details, roster, schedule, stats."""

from __future__ import annotations

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Game, Team
from ..db.sport_suite import get_players_pool
from ..models.schemas import (
    RosterPlayer,
    TeamDetailResponse,
    TeamListItem,
    TeamPlayerStats,
    TeamScheduleGame,
)
from . import espn_client
from .team_mapping import espn_id_for

logger = structlog.get_logger(__name__)


async def get_teams(session: AsyncSession) -> list[dict]:
    """Get all teams grouped by conference/division with last game result."""
    stmt = select(Team).order_by(Team.conference, Team.division, Team.name)
    result = await session.execute(stmt)
    teams = result.scalars().all()

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


async def get_team_roster(abbrev: str) -> list[RosterPlayer]:
    """Get team roster from ESPN."""
    espn_id = espn_id_for(abbrev)
    if not espn_id:
        return []

    data = await espn_client.get_team_roster(espn_id)
    if not data:
        return []

    players = []
    team_data = data.get("team", {})
    athletes = team_data.get("athletes", [])

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
                experience=str(athlete.get("experience", {}).get("years", "R"))
                if athlete.get("experience")
                else "R",
                college=athlete.get("college", {}).get("name", "")
                if athlete.get("college")
                else "",
                headshot_url=athlete.get("headshot", {}).get("href", "")
                if athlete.get("headshot")
                else "",
            )
        )

    return players


async def get_team_schedule(abbrev: str, session: AsyncSession) -> list[TeamScheduleGame]:
    """Get team schedule from local games table."""
    stmt = (
        select(Game)
        .where((Game.home_team == abbrev) | (Game.away_team == abbrev))
        .order_by(Game.start_time.desc())
        .limit(20)
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

        schedule.append(
            TeamScheduleGame(
                game_id=g.id,
                date=g.start_time.strftime("%b %d") if g.start_time else "",
                opponent=f"{home_away} {opp}",
                home_away=home_away,
                result=f"{result_str} {score}" if result_str else "",
                status=g.status if g.status != "final" else "Final",
                score=score,
            )
        )

    return schedule


async def get_team_stats(abbrev: str) -> list[TeamPlayerStats]:
    """Get player stats for a team from Sport-suite DB, fallback to empty."""
    pool = get_players_pool()
    if not pool:
        return []

    # Map to Sport-suite abbreviation format if needed
    from .team_mapping import PBP_TO_SPORT_SUITE

    ss_abbrev = PBP_TO_SPORT_SUITE.get(abbrev, abbrev)

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    pp.full_name,
                    COUNT(*) as gp,
                    ROUND(AVG(pgl.minutes_played)::numeric, 1) as mpg,
                    ROUND(AVG(pgl.points)::numeric, 1) as ppg,
                    ROUND(AVG(pgl.rebounds)::numeric, 1) as rpg,
                    ROUND(AVG(pgl.assists)::numeric, 1) as apg,
                    ROUND(AVG(pgl.steals)::numeric, 1) as spg,
                    ROUND(AVG(pgl.blocks)::numeric, 1) as bpg,
                    CASE WHEN SUM(pgl.fg_attempted) > 0
                        THEN ROUND((SUM(pgl.fg_made)::numeric / SUM(pgl.fg_attempted) * 100), 1)
                        ELSE 0 END as fg_pct,
                    CASE WHEN SUM(pgl.three_pt_attempted) > 0
                        THEN ROUND((SUM(pgl.three_pointers_made)::numeric / SUM(pgl.three_pt_attempted) * 100), 1)
                        ELSE 0 END as three_pct
                FROM player_game_logs pgl
                JOIN player_profile pp ON pp.player_id = pgl.player_id
                WHERE pgl.team_abbrev = $1
                  AND pgl.game_date >= '2025-10-01'
                GROUP BY pp.full_name
                HAVING COUNT(*) >= 5
                ORDER BY AVG(pgl.points) DESC
                LIMIT 15
            """,
                ss_abbrev,
            )

            return [
                TeamPlayerStats(
                    player=r["full_name"],
                    gp=r["gp"],
                    mpg=float(r["mpg"]),
                    ppg=float(r["ppg"]),
                    rpg=float(r["rpg"]),
                    apg=float(r["apg"]),
                    spg=float(r["spg"]),
                    bpg=float(r["bpg"]),
                    fg_pct=f"{r['fg_pct']}%",
                    three_pct=f"{r['three_pct']}%",
                )
                for r in rows
            ]
    except Exception as e:
        logger.warning("team_stats.sport_suite_failed", abbrev=abbrev, error=str(e))
        return []
