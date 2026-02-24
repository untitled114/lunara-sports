"""Ingestion service entry point.

Runs two independent loops:
  1. Scoreboard loop (every 10s) — discovers games, manages PBP collectors
  2. Play-by-play loop (every 3s) — polls ESPN for new plays, fast and independent

Decoupling these ensures play polling is never blocked by scoreboard HTTP calls.
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

PBP_INTERVAL = 1  # seconds — fast loop for play-by-play
SCOREBOARD_INTERVAL = 10  # seconds — slower loop for game discovery


async def run() -> None:
    settings = Settings()
    producer = KafkaProducer(settings)
    scoreboard = ScoreboardCollector(settings, producer)

    # game_id → PlayByPlayCollector for active games
    pbp_collectors: dict[str, PlayByPlayCollector] = {}
    active_game_ids: set[str] = set()
    collector_lock = asyncio.Lock()

    shutdown = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, shutdown.set)

    logger.info(
        "ingestion.starting",
        pbp_interval=PBP_INTERVAL,
        scoreboard_interval=SCOREBOARD_INTERVAL,
    )

    async def scoreboard_loop() -> None:
        """Discover games and manage PBP collectors."""
        nonlocal active_game_ids
        while not shutdown.is_set():
            try:
                await scoreboard.poll()
                games = await scoreboard.collect()

                new_active: set[str] = set()
                async with collector_lock:
                    for game in games:
                        gid = game["game_id"]
                        status = game["status"]

                        if status in LIVE_STATUSES:
                            new_active.add(gid)
                            if gid not in pbp_collectors:
                                logger.info("ingestion.pbp_start", game_id=gid, status=status)
                                pbp_collectors[gid] = PlayByPlayCollector(settings, producer, gid)

                    # Clean up finished games
                    finished = set(pbp_collectors.keys()) - new_active
                    for gid in finished:
                        logger.info(
                            "ingestion.pbp_stop",
                            game_id=gid,
                            plays_collected=pbp_collectors[gid].new_play_count,
                        )
                        await pbp_collectors[gid].close()
                        del pbp_collectors[gid]

                    active_game_ids = new_active

                logger.info(
                    "ingestion.scoreboard_cycle",
                    games=len(games),
                    live_games=len(new_active),
                    pbp_collectors=len(pbp_collectors),
                )
            except Exception:
                logger.exception("ingestion.scoreboard_error")

            try:
                await asyncio.wait_for(shutdown.wait(), timeout=SCOREBOARD_INTERVAL)
            except TimeoutError:
                pass

    async def pbp_loop() -> None:
        """Fast loop — poll play-by-play for all active games."""
        while not shutdown.is_set():
            try:
                async with collector_lock:
                    active = {gid: c for gid, c in pbp_collectors.items() if gid in active_game_ids}

                if active:
                    await asyncio.gather(
                        *(c.poll() for c in active.values()),
                        return_exceptions=True,
                    )
                    logger.debug(
                        "ingestion.pbp_cycle",
                        games_polled=len(active),
                    )
            except Exception:
                logger.exception("ingestion.pbp_error")

            try:
                await asyncio.wait_for(shutdown.wait(), timeout=PBP_INTERVAL)
            except TimeoutError:
                pass

    try:
        # Run both loops concurrently
        await asyncio.gather(
            scoreboard_loop(),
            pbp_loop(),
        )
    finally:
        logger.info("ingestion.shutting_down")
        for c in pbp_collectors.values():
            await c.close()
        await scoreboard.close()


if __name__ == "__main__":
    asyncio.run(run())
