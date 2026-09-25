"""WebSocket connection manager for live game feeds.

Manages per-game WebSocket connections and broadcasts new plays to all
connected clients.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Callable

import structlog
from fastapi import WebSocket
from starlette.websockets import WebSocketState

from ..metrics import websocket_connections_active

logger = structlog.get_logger(__name__)

# A client that cannot take a message within this long is treated as dead: one
# stalled socket must never hold up a play for everyone else in the room.
SEND_TIMEOUT = 2.0


class ConnectionManager:
    """Manages per-game WebSocket connections."""

    def __init__(self) -> None:
        self.active_connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self._room_emptied: list[Callable[[str], None]] = []
        self._closing: set[asyncio.Task] = set()

    def on_room_emptied(self, listener: Callable[[str], None]) -> None:
        """Call ``listener(game_id)`` whenever a game's last client leaves."""
        self._room_emptied.append(listener)

    def _drop_room(self, game_id: str) -> None:
        """Remove an empty room and tell listeners (caller holds ``_lock``)."""
        self.active_connections.pop(game_id, None)
        for listener in self._room_emptied:
            try:
                listener(game_id)
            except Exception as exc:
                logger.warning("ws.room_listener_failed", game_id=game_id, error=repr(exc))

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
                    self._drop_room(game_id)
        websocket_connections_active.set(self.connection_count())
        logger.info("ws.disconnected", game_id=game_id)

    async def broadcast(self, game_id: str, message: dict) -> None:
        """Send to every connection for a game at once; drop dead or stalled ones.

        Iterates a snapshot (clients join/leave mid-broadcast at tip-off) and bounds
        each send by ``SEND_TIMEOUT``, so a slow client can't stall the others.
        """
        conns = self.active_connections.get(game_id)
        if not conns:
            return

        payload = json.dumps(message, default=str)
        targets = list(conns)
        delivered = await asyncio.gather(*(self._send(ws, payload) for ws in targets))
        dead = [ws for ws, ok in zip(targets, delivered, strict=True) if not ok]

        if dead:
            async with self._lock:
                conns = self.active_connections.get(game_id)
                if conns:
                    for ws in dead:
                        conns.discard(ws)
                    if not conns:
                        self._drop_room(game_id)
            websocket_connections_active.set(self.connection_count())
            for ws in dead:
                task = asyncio.create_task(self._close_quietly(ws))
                self._closing.add(task)
                task.add_done_callback(self._closing.discard)

    @staticmethod
    async def _send(ws: WebSocket, payload: str) -> bool:
        if ws.client_state != WebSocketState.CONNECTED:
            return False
        try:
            await asyncio.wait_for(ws.send_text(payload), SEND_TIMEOUT)
        except Exception as exc:  # TimeoutError included: a stalled client is dead to us
            logger.info("ws.client_dropped", error_class=type(exc).__name__)
            return False
        return True

    @staticmethod
    async def _close_quietly(ws: WebSocket) -> None:
        """Close a dropped socket so its client reconnects instead of going stale."""
        try:
            await asyncio.wait_for(ws.close(), SEND_TIMEOUT)
        except Exception:
            pass

    def connection_count(self, game_id: str | None = None) -> int:
        if game_id:
            return len(self.active_connections.get(game_id, set()))
        return sum(len(c) for c in self.active_connections.values())

    def active_games(self) -> list[str]:
        return list(self.active_connections.keys())


manager = ConnectionManager()
