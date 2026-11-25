"""Reconcile finished games' stored plays with ESPN's final play list.

ESPN renumbers and corrects plays during a game. Once a game is final, its stored plays are
made to match ESPN's list exactly (see ``PostgresSink.reconcile``). Ingestion does this when
it retires a finished game; this CLI does it for games already stored:

    python -m src.reconcile --game 401909953 [--game ...]
    python -m src.reconcile --since 2026-10-21       # every final game from that ET date
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

import structlog

from src.collectors.playbyplay import PlayByPlayCollector
from src.config import Settings
from src.http.espn import EspnHttp
from src.sinks.postgres import PostgresSink

logger = structlog.get_logger(__name__)
ET = ZoneInfo("America/New_York")

FINAL_GAMES_SQL = """
SELECT id FROM games WHERE status = 'final' AND start_time >= $1 ORDER BY start_time, id
"""


def is_final(summary: dict) -> bool:
    """True when ESPN's summary says the game is completed."""
    competitions = summary.get("header", {}).get("competitions") or [{}]
    return bool(competitions[0].get("status", {}).get("type", {}).get("completed"))


async def reconcile_game(
    settings: Settings, sink: PostgresSink, http: EspnHttp, game_id: str
) -> dict[str, int] | None:
    """Reconcile one game; ``None`` (nothing changed) unless ESPN says it is final."""
    collector = PlayByPlayCollector(settings, sink, game_id, http)
    summary = await collector._fetch()
    if not is_final(summary):
        logger.info("reconcile.skipped_not_final", game_id=game_id)
        return None
    return await sink.reconcile(game_id, collector.changed_plays(summary))


async def final_game_ids(sink: PostgresSink, since: date) -> list[str]:
    start = datetime.combine(since, time.min, tzinfo=ET)
    async with sink._pool.acquire(timeout=10) as conn:
        return [r["id"] for r in await conn.fetch(FINAL_GAMES_SQL, start)]


async def run(argv: list[str] | None = None) -> list[tuple[str, dict[str, int] | None]]:
    parser = argparse.ArgumentParser(description="Reconcile stored plays with ESPN")
    parser.add_argument("--game", action="append", default=[], help="ESPN game id")
    parser.add_argument("--since", type=date.fromisoformat, help="every final game from this date")
    args = parser.parse_args(argv)
    if not args.game and not args.since:
        parser.error("give --game or --since")

    from src.__main__ import build_io

    settings = Settings()
    sink, http = await build_io(settings)
    done = []
    try:
        games = list(args.game) or await final_game_ids(sink, args.since)
        for game_id in games:
            try:
                result = await reconcile_game(settings, sink, http, game_id)
            except Exception as exc:
                logger.warning("reconcile.failed", game_id=game_id, error=repr(exc))
                result = None
            done.append((game_id, result))
    finally:
        await sink.close()
        await http.aclose()
    logger.info("reconcile.done", games=len(done), reconciled=sum(1 for _, r in done if r))
    return done


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(run())
