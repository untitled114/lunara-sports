"""Ingestion service entry point.

Orchestrates the scoreboard collector and per-game play-by-play collectors.
Flow:
  1. Poll ESPN scoreboard to discover games
  2. Spin up PlayByPlayCollector for each live game
  3. Remove collectors for games that reach final
  4. Repeat on the configured interval
"""

from __future__ import annotations

import asyncio
import signal

import structlog

from src.collectors.playbyplay import PlayByPlayCollector
from src.collectors.scoreboard import ScoreboardCollector
from src.config import Settings
from src.producers.kafka_producer import KafkaProducer

logger = structlog.get_logger(__name__)

LIVE_STATUSES = {"live", "halftime"}


async def run() -> None:
    settings = Settings()
    producer = KafkaProducer(settings)
    scoreboard = ScoreboardCollector(settings, producer)

    # game_id → PlayByPlayCollector for active games
    pbp_collectors: dict[str, PlayByPlayCollector] = {}

    shutdown = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, shutdown.set)

    logger.info(
        "ingestion.starting",
        interval=settings.espn_poll_interval_seconds,
    )

    try:
        while not shutdown.is_set():
            # 1. Poll scoreboard
            await scoreboard.poll()

            # 2. Get current game states from the last collect
            games = await scoreboard.collect()

            # 3. Manage play-by-play collectors
            active_game_ids: set[str] = set()
            for game in games:
                gid = game["game_id"]
                status = game["status"]

                if status in LIVE_STATUSES:
                    active_game_ids.add(gid)
                    if gid not in pbp_collectors:
                        logger.info("ingestion.pbp_start", game_id=gid, status=status)
                        pbp_collectors[gid] = PlayByPlayCollector(
                            settings, producer, gid
                        )

            # 4. Poll all active play-by-play collectors concurrently
            if pbp_collectors:
                active = {
                    gid: c
                    for gid, c in pbp_collectors.items()
                    if gid in active_game_ids
                }
                if active:
                    await asyncio.gather(
                        *(c.poll() for c in active.values()),
                        return_exceptions=True,
                    )

            # 5. Clean up collectors for finished games
            finished = set(pbp_collectors.keys()) - active_game_ids
            for gid in finished:
                logger.info(
                    "ingestion.pbp_stop",
                    game_id=gid,
                    plays_collected=pbp_collectors[gid].new_play_count,
                )
                await pbp_collectors[gid].close()
                del pbp_collectors[gid]

            logger.info(
                "ingestion.cycle_complete",
                games=len(games),
                live_games=len(active_game_ids),
                pbp_collectors=len(pbp_collectors),
            )

            # 6. Sleep until next cycle
            try:
                await asyncio.wait_for(
                    shutdown.wait(),
                    timeout=settings.espn_poll_interval_seconds,
                )
            except (TimeoutError, asyncio.TimeoutError):
                pass

    finally:
        logger.info("ingestion.shutting_down")
        for c in pbp_collectors.values():
            await c.close()
        await scoreboard.close()


if __name__ == "__main__":
    asyncio.run(run())
