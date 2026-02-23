"""Import games from Sport-suite nba_games database into playbyplay games table.

Maps ~6K historical games from Sport-suite (port 5537) into the playbyplay
PostgreSQL games table, handling abbreviation differences.

Usage:
    python -m src.importers.sport_suite_games
"""

from __future__ import annotations

import argparse
import asyncio
import os
from datetime import datetime, timezone

import asyncpg
import structlog

logger = structlog.get_logger(__name__)

# Map Sport-suite abbreviations to play-by-play abbreviations
ABBREV_MAP = {
    "GSW": "GS",
    "WAS": "WSH",
    "NYK": "NY",
    "NOP": "NO",
    "NOR": "NO",
    "SAS": "SA",
    "PHO": "PHX",
    "UTH": "UTA",
}


def normalize_abbrev(abbrev: str) -> str:
    return ABBREV_MAP.get(abbrev, abbrev)


async def import_games(
    ss_host: str = "localhost",
    ss_port: int = 5537,
    ss_user: str = "",
    ss_password: str = "",
    pbp_dsn: str = "postgresql://playbyplay:dev_password@localhost:5432/playbyplay",
) -> int:
    """Import games from Sport-suite into playbyplay database.

    Returns the number of games imported.
    """
    # Connect to Sport-suite nba_games database
    ss_pool = await asyncpg.create_pool(
        host=ss_host,
        port=ss_port,
        user=ss_user,
        password=ss_password,
        database="nba_games",
        min_size=1,
        max_size=3,
    )

    # Connect to playbyplay database
    pbp_pool = await asyncpg.create_pool(dsn=pbp_dsn, min_size=1, max_size=3)

    imported = 0
    skipped = 0

    try:
        async with ss_pool.acquire() as ss_conn:
            # Fetch all games from Sport-suite
            rows = await ss_conn.fetch("""
                SELECT game_id, home_team, away_team, game_date,
                       home_score, away_score, game_status
                FROM games
                ORDER BY game_date
            """)
            logger.info("sport_suite.fetched_games", count=len(rows))

        async with pbp_pool.acquire() as pbp_conn:
            for row in rows:
                game_id = str(row["game_id"])
                home_team = normalize_abbrev(row["home_team"])
                away_team = normalize_abbrev(row["away_team"])
                game_date = row["game_date"]
                home_score = row.get("home_score") or 0
                away_score = row.get("away_score") or 0
                status = row.get("game_status") or "final"

                # Map Sport-suite status to PBP status
                if status in ("Final", "final", "FINAL"):
                    status = "final"
                elif status in ("Scheduled", "scheduled"):
                    status = "scheduled"
                else:
                    status = "final"

                # Use game_date as start_time (noon timezone.utc as placeholder)
                if isinstance(game_date, datetime):
                    start_time = game_date.replace(tzinfo=timezone.utc)
                else:
                    start_time = datetime.combine(game_date, datetime.min.time()).replace(
                        hour=19,
                        tzinfo=timezone.utc,  # Default to 7pm timezone.utc (2pm ET)
                    )

                try:
                    await pbp_conn.execute(
                        """
                        INSERT INTO games (id, home_team, away_team, status,
                                          home_score, away_score, start_time, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                        ON CONFLICT (id) DO UPDATE SET
                            home_score = EXCLUDED.home_score,
                            away_score = EXCLUDED.away_score,
                            status = EXCLUDED.status
                        WHERE games.status != 'final' OR games.home_score = 0
                    """,
                        game_id,
                        home_team,
                        away_team,
                        status,
                        home_score,
                        away_score,
                        start_time,
                    )
                    imported += 1
                except asyncpg.ForeignKeyViolationError:
                    # Team abbreviation not in teams table
                    skipped += 1
                    if skipped <= 5:
                        logger.warning(
                            "sport_suite.fk_violation",
                            game_id=game_id,
                            home=home_team,
                            away=away_team,
                        )
                except Exception as e:
                    skipped += 1
                    if skipped <= 5:
                        logger.warning("sport_suite.insert_error", game_id=game_id, error=str(e))

    finally:
        await ss_pool.close()
        await pbp_pool.close()

    logger.info("sport_suite.import_complete", imported=imported, skipped=skipped)
    return imported


async def main() -> None:
    parser = argparse.ArgumentParser(description="Import games from Sport-suite")
    parser.add_argument("--ss-host", default="localhost", help="Sport-suite DB host")
    parser.add_argument("--ss-port", type=int, default=5537, help="Sport-suite games DB port")
    parser.add_argument(
        "--pbp-dsn", default="postgresql://playbyplay:dev_password@localhost:5432/playbyplay"
    )
    args = parser.parse_args()

    ss_user = os.environ.get("DB_USER", "")
    ss_password = os.environ.get("DB_PASSWORD", "")

    if not ss_user or not ss_password:
        logger.error("Missing DB_USER or DB_PASSWORD env vars")
        return

    count = await import_games(
        ss_host=args.ss_host,
        ss_port=args.ss_port,
        ss_user=ss_user,
        ss_password=ss_password,
        pbp_dsn=args.pbp_dsn,
    )
    logger.info("done", games_imported=count)


if __name__ == "__main__":
    asyncio.run(main())
