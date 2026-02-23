"""WebSocket connection manager for live game feeds.

Manages per-game WebSocket connections and broadcasts new plays to all
connected clients.
"""

from __future__ import annotations

import asyncio
import json

import structlog
from fastapi import WebSocket
from starlette.websockets import WebSocketState

from ..metrics import websocket_connections_active

logger = structlog.get_logger(__name__)


class ConnectionManager:
    """Manages per-game WebSocket connections."""

    def __init__(self) -> None:
        self.active_connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, game_id: str) -> None:
        await websocket.accept()
        async with self._lock:
            if game_id not in self.active_connections:
                self.active_connections[game_id] = set()
            self.active_connections[game_id].add(websocket)
        websocket_connections_active.set(self.connection_count())
        logger.info("ws.connected", game_id=game_id, clients=len(self.active_connections[game_id]))

    async def disconnect(self, websocket: WebSocket, game_id: str) -> None:
        async with self._lock:
            conns = self.active_connections.get(game_id)
            if conns:
                conns.discard(websocket)
                if not conns:
                    del self.active_connections[game_id]
        websocket_connections_active.set(self.connection_count())
        logger.info("ws.disconnected", game_id=game_id)

    async def broadcast(self, game_id: str, message: dict) -> None:
        """Broadcast to all connections for a game. Removes dead connections."""
        conns = self.active_connections.get(game_id)
        if not conns:
            return

        dead: list[WebSocket] = []
        payload = json.dumps(message, default=str)

        for ws in conns:
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_text(payload)
                else:
                    dead.append(ws)
            except Exception:
                dead.append(ws)

        if dead:
            async with self._lock:
                for ws in dead:
                    conns.discard(ws)
                if not conns:
                    self.active_connections.pop(game_id, None)
            websocket_connections_active.set(self.connection_count())

    def connection_count(self, game_id: str | None = None) -> int:
        if game_id:
            return len(self.active_connections.get(game_id, set()))
        return sum(len(c) for c in self.active_connections.values())

    def active_games(self) -> list[str]:
        return list(self.active_connections.keys())


manager = ConnectionManager()
