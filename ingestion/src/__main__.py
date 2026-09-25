"""Ingestion service entry point.

Runs two independent loops:
  1. Scoreboard loop (every 10s) — discovers games, manages PBP collectors
  2. Play-by-play loop (every 3s) — polls ESPN for new plays, fast and independent

Decoupling these ensures play polling is never blocked by scoreboard HTTP calls.
Every collector shares ONE PostgresSink and ONE EspnHttp (built by ``build_io``);
only ``run()`` closes them.
"""

from __future__ import annotations

import asyncio
import os
import signal
import time
from collections.abc import Callable

import structlog

from src.collectors.playbyplay import PlayByPlayCollector
from src.collectors.scoreboard import ScoreboardCollector
from src.config import Settings
from src.http.espn import EspnHttp
from src.sinks.postgres import PostgresSink

logger = structlog.get_logger(__name__)

LIVE_STATUSES = {"live", "halftime"}

PBP_INTERVAL = 1  # seconds — fast loop for play-by-play
SCOREBOARD_INTERVAL = 10  # seconds — slower loop for game discovery
POLL_FAILED_LOG_WINDOW = 60.0  # seconds — at most one pbp_poll_failed per game per window


async def build_io(settings: Settings) -> tuple[PostgresSink, EspnHttp]:
    sink = PostgresSink(settings.database_url)
    await sink.connect()
    http = EspnHttp(
        settings.espn_proxy_url,
        trigger_failures=settings.proxy_trigger_failures,
        cooldown_seconds=settings.proxy_cooldown_seconds,
    )
    return sink, http


async def _quietly(action, event: str, **ctx) -> None:
    """Await ``action()``; log a failure as ``event`` instead of raising."""
    try:
        await action()
    except Exception as e:
        logger.warning(event, error=repr(e), **ctx)


async def _close_quietly(closer, what: str, **ctx) -> None:
    """Await a collector's close(); log (don't raise) so the rest still close."""
    await _quietly(closer, "ingestion.close_failed", what=what, **ctx)


class _RateLimitedWarning:
    """Log ``event`` at most once per key per ``window`` seconds.

    A game that fails every 1s PBP cycle would otherwise flood the journal;
    the next logged line carries how many were suppressed meanwhile.
    """

    def __init__(
        self, event: str, window: float, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self._event = event
        self._window = window
        self._clock = clock
        self._state: dict[str, tuple[float, int]] = {}  # key → (last logged, suppressed)

    def __call__(self, key: str, **fields) -> None:
        now = self._clock()
        last = self._state.get(key)
        if last is not None and now - last[0] < self._window:
            self._state[key] = (last[0], last[1] + 1)
            return
        suppressed = last[1] if last is not None else 0
        logger.warning(self._event, game_id=key, suppressed=suppressed, **fields)
        self._state[key] = (now, 0)

    def forget(self, key: str) -> None:
        self._state.pop(key, None)


async def run() -> None:
    settings = Settings()
    sink, http = await build_io(settings)
    try:
        await _run_loops(settings, sink, http)
    finally:
        try:
            await sink.close()  # final flush, then the pool
        finally:
            await http.aclose()


async def _run_loops(settings: Settings, sink: PostgresSink, http: EspnHttp) -> None:
    scoreboard = ScoreboardCollector(settings, sink, http)

    # game_id → PlayByPlayCollector for active games
    pbp_collectors: dict[str, PlayByPlayCollector] = {}
    active_game_ids: set[str] = set()
    collector_lock = asyncio.Lock()
    poll_failed = _RateLimitedWarning("ingestion.pbp_poll_failed", POLL_FAILED_LOG_WINDOW)

    async def retire(gid: str, collector: PlayByPlayCollector) -> None:
        """Final poll (plays ESPN posts after the flip to final), then close."""
        await _quietly(collector.poll, "ingestion.final_poll_failed", game_id=gid)
        logger.info(
            "ingestion.pbp_stop",
            game_id=gid,
            plays_collected=collector.new_play_count,
        )
        await _close_quietly(collector.close, "pbp_collector", game_id=gid)
        poll_failed.forget(gid)

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
                retiring: dict[str, PlayByPlayCollector] = {}
                async with collector_lock:
                    for game in games:
                        gid = game["game_id"]
                        status = game["status"]

                        if status in LIVE_STATUSES:
                            new_active.add(gid)
                            if gid not in pbp_collectors:
                                logger.info("ingestion.pbp_start", game_id=gid, status=status)
                                pbp_collectors[gid] = PlayByPlayCollector(
                                    settings, sink, game_id=gid, http=http
                                )

                    # Finished games leave the active set now; their final
                    # poll + close run below, outside the lock, so an ESPN
                    # retry never stalls PBP polling for the other games.
                    for gid in set(pbp_collectors.keys()) - new_active:
                        retiring[gid] = pbp_collectors.pop(gid)

                    active_game_ids = new_active

                # Errors are logged inside retire(); the collector is dropped
                # either way (unflushed plays stay in the shared sink).
                await asyncio.gather(*(retire(gid, c) for gid, c in retiring.items()))

                logger.info(
                    "ingestion.scoreboard_cycle",
                    games=len(games),
                    live_games=len(new_active),
                    pbp_collectors=len(pbp_collectors),
                )
            except Exception as e:
                logger.warning("ingestion.scoreboard_error", error=str(e))

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
                    results = await asyncio.gather(
                        *(c.poll() for c in active.values()),
                        return_exceptions=True,
                    )
                    for gid, result in zip(active, results, strict=True):
                        if isinstance(result, BaseException):
                            poll_failed(gid, error=repr(result))
                    logger.debug(
                        "ingestion.pbp_cycle",
                        games_polled=len(active),
                    )
            except Exception as e:
                logger.warning("ingestion.pbp_error", error=str(e))

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
        for gid, c in pbp_collectors.items():
            await _close_quietly(c.close, "pbp_collector", game_id=gid)
        await _close_quietly(scoreboard.close, "scoreboard")


async def health_server() -> None:
    """Minimal HTTP health server answering 200 OK on HEALTH_HOST:PORT.

    Binds loopback by default (R21): 0.0.0.0:8080 collides with Airflow on
    sport-suite-main.
    """
    host = os.environ.get("HEALTH_HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8080"))

    async def handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        await reader.read(1024)
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK")
        await writer.drain()
        writer.close()

    server = await asyncio.start_server(handle, host, port)
    async with server:
        await server.serve_forever()


async def main() -> None:
    """Health server alongside run(); returns as soon as run() does.

    The health server never finishes on its own (serve_forever), so it runs as
    a task that is cancelled when run() returns after SIGTERM/SIGINT —
    otherwise systemd waits TimeoutStopSec and SIGKILLs on every stop.
    """
    health = asyncio.create_task(health_server())
    try:
        await run()
    finally:
        health.cancel()
        try:
            await health
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("ingestion.health_server_failed", error=repr(e))


if __name__ == "__main__":
    asyncio.run(main())
