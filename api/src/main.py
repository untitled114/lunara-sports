"""Play-by-Play API — FastAPI application entry point."""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from .config import Settings
from .db.redis import close_redis, get_cached_game_list, init_redis, redis_ping
from .db.session import close_db, create_tables, db_ping, init_db, seed_teams
from .db.sport_suite import close_sport_suite, init_sport_suite
from .kafka.consumer import KafkaConsumerLoop
from .kafka.producer import close_producer, init_producer
from .metrics import instrumentator
from .models.schemas import HealthResponse
from .routers import (
    auth,
    boxscore,
    comments,
    games,
    leaderboard,
    picks,
    players,
    plays,
    predictions,
    reactions,
    standings,
    stats,
    teams,
)
from .services.espn_client import close_espn_client, init_espn_client
from .services.pick_sync_poller import run_pick_sync_poller
from .services.pick_tracker_poller import run_pick_tracker_poller
from .services.scoreboard_poller import run_scoreboard_poller
from .services.team_logos import populate_team_logos
from .ws.live_feed import manager
from .ws.play_poller import get_recent_plays, run_play_poller

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()

    # Startup
    init_db(settings)
    await create_tables()
    await seed_teams()
    await init_redis(settings)
    init_espn_client()
    await init_sport_suite(settings)
    await populate_team_logos()
    if settings.kafka_bootstrap_servers:
        init_producer(settings)
    logger.info("api.started", host=settings.api_host, port=settings.api_port)

    # Start background Kafka consumer (writes to DB) — skip if no broker configured
    kafka_consumer = None
    consumer_task = None
    if settings.kafka_bootstrap_servers:
        kafka_consumer = KafkaConsumerLoop(settings)
        consumer_task = asyncio.create_task(kafka_consumer.run())
    else:
        logger.warning("kafka.skipped", reason="KAFKA_BOOTSTRAP_SERVERS not set")

    # Start background play poller (broadcasts to WebSocket clients)
    poller_task = asyncio.create_task(run_play_poller())

    # Start background scoreboard poller (keeps game scores current from ESPN)
    scoreboard_task = asyncio.create_task(run_scoreboard_poller())

    # Start pick sync poller (syncs Sport-suite predictions once per day)
    pick_sync_task = asyncio.create_task(run_pick_sync_poller(settings))

    # Start pick tracker poller (updates live stats for pending picks)
    pick_tracker_task = asyncio.create_task(run_pick_tracker_poller())

    yield

    # Shutdown
    if kafka_consumer:
        kafka_consumer.stop()
    poller_task.cancel()
    scoreboard_task.cancel()
    pick_sync_task.cancel()
    pick_tracker_task.cancel()
    if consumer_task:
        try:
            await consumer_task
        except Exception:
            pass
    try:
        await poller_task
    except asyncio.CancelledError:
        pass
    try:
        await scoreboard_task
    except asyncio.CancelledError:
        pass
    try:
        await pick_sync_task
    except asyncio.CancelledError:
        pass
    try:
        await pick_tracker_task
    except asyncio.CancelledError:
        pass
    close_producer()
    await close_espn_client()
    await close_sport_suite()
    await close_redis()
    await close_db()
    logger.info("api.stopped")


app = FastAPI(
    title="Lunara Sports API",
    version="0.1.0",
    description="Real-time sports data, social interactions, and prediction games.",
    lifespan=lifespan,
)


class NoCacheMiddleware(BaseHTTPMiddleware):
    """Prevent Cloudflare and browsers from caching API responses."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        if request.url.path not in ("/metrics", "/docs", "/openapi.json"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["CDN-Cache-Control"] = "no-store"
        return response


app.add_middleware(NoCacheMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

instrumentator.instrument(app).expose(app)

app.include_router(games.router)
app.include_router(plays.router)
app.include_router(predictions.router)
app.include_router(leaderboard.router)
app.include_router(picks.router)
app.include_router(standings.router)
app.include_router(teams.router)
app.include_router(players.router)
app.include_router(stats.router)
app.include_router(boxscore.router)
app.include_router(reactions.router)
app.include_router(comments.router)
app.include_router(auth.router)


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health():
    """Check connectivity to PostgreSQL and Redis."""
    pg_ok = await db_ping()
    redis_ok = await redis_ping()
    status = "ok" if (pg_ok and redis_ok) else "degraded"
    return HealthResponse(status=status, postgres=pg_ok, redis=redis_ok)


@app.get("/ws/stats", tags=["system"])
async def ws_stats():
    """Return WebSocket connection stats."""
    return {
        "total_connections": manager.connection_count(),
        "active_games": manager.active_games(),
    }


@app.post("/ws/publish/{game_id}", tags=["system"], status_code=202)
async def publish_play(game_id: str, play: dict):
    """Push a play event to all WebSocket subscribers for a game.

    Used by the ingestion service to push new plays without waiting for
    the background poller.
    """
    msg = {"type": "play", "data": play}
    await manager.broadcast(game_id, msg)
    return {"status": "broadcast", "clients": manager.connection_count(game_id)}


@app.websocket("/ws/scoreboard")
async def scoreboard_ws(websocket: WebSocket):
    """WebSocket endpoint for live scoreboard updates.

    On connect: sends cached game list.
    Then streams scoreboard_update messages from the poller.
    """
    await manager.connect(websocket, "scoreboard")
    try:
        # Send current cached game list immediately
        from datetime import datetime, timedelta, timezone

        utc_now = datetime.now(timezone.utc)
        et_now = utc_now - timedelta(hours=5)
        today_str = et_now.date().isoformat()
        cached = await get_cached_game_list(today_str)
        if cached:
            await websocket.send_text(
                json.dumps({"type": "scoreboard_update", "data": cached}, default=str)
            )

        # Keep-alive loop
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        await manager.disconnect(websocket, "scoreboard")
    except Exception:
        await manager.disconnect(websocket, "scoreboard")


@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    """WebSocket endpoint for live game feeds.

    On connect:
    1. Sends recent play history as {"type": "history", "data": [...]}
    2. Streams new plays as {"type": "play", "data": {...}}

    The client should merge history with any REST-fetched data based on
    sequence_number to avoid duplicates.
    """
    await manager.connect(websocket, game_id)
    try:
        # Send recent play history
        recent = await get_recent_plays(game_id, limit=500)
        await websocket.send_text(
            json.dumps(
                {
                    "type": "history",
                    "data": recent,
                },
                default=str,
            )
        )

        # Keep-alive loop — read client messages (pings, etc.)
        while True:
            data = await websocket.receive_text()
            # Client can send ping
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        await manager.disconnect(websocket, game_id)
    except Exception:
        await manager.disconnect(websocket, game_id)
