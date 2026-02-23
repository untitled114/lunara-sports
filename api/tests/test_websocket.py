"""Tests for WebSocket live feed functionality."""

import json
from unittest.mock import AsyncMock, patch

import pytest

from src.ws.live_feed import ConnectionManager


# ── ConnectionManager unit tests ────────────────────────────────────────


@pytest.mark.asyncio
async def test_manager_connect_disconnect():
    mgr = ConnectionManager()
    ws = AsyncMock()

    await mgr.connect(ws, "game1")
    assert mgr.connection_count("game1") == 1
    assert mgr.connection_count() == 1
    assert "game1" in mgr.active_games()

    await mgr.disconnect(ws, "game1")
    assert mgr.connection_count("game1") == 0
    assert "game1" not in mgr.active_games()


@pytest.mark.asyncio
async def test_manager_multiple_games():
    mgr = ConnectionManager()
    ws1, ws2 = AsyncMock(), AsyncMock()

    await mgr.connect(ws1, "game1")
    await mgr.connect(ws2, "game2")
    assert mgr.connection_count() == 2
    assert set(mgr.active_games()) == {"game1", "game2"}


@pytest.mark.asyncio
async def test_manager_broadcast():
    mgr = ConnectionManager()
    ws1, ws2 = AsyncMock(), AsyncMock()

    # Simulate CONNECTED state
    from starlette.websockets import WebSocketState
    ws1.client_state = WebSocketState.CONNECTED
    ws2.client_state = WebSocketState.CONNECTED

    await mgr.connect(ws1, "game1")
    await mgr.connect(ws2, "game1")

    await mgr.broadcast("game1", {"type": "play", "data": {"id": 1}})

    assert ws1.send_text.called
    assert ws2.send_text.called
    payload = json.loads(ws1.send_text.call_args[0][0])
    assert payload["type"] == "play"
    assert payload["data"]["id"] == 1


@pytest.mark.asyncio
async def test_manager_broadcast_removes_dead():
    mgr = ConnectionManager()
    ws_good = AsyncMock()
    ws_dead = AsyncMock()

    from starlette.websockets import WebSocketState
    ws_good.client_state = WebSocketState.CONNECTED
    ws_dead.client_state = WebSocketState.DISCONNECTED

    await mgr.connect(ws_good, "game1")
    await mgr.connect(ws_dead, "game1")
    assert mgr.connection_count("game1") == 2

    await mgr.broadcast("game1", {"type": "ping"})

    # Dead connection should have been removed
    assert mgr.connection_count("game1") == 1


@pytest.mark.asyncio
async def test_manager_broadcast_no_subscribers():
    mgr = ConnectionManager()
    # Should not raise
    await mgr.broadcast("nonexistent", {"type": "play"})


@pytest.mark.asyncio
async def test_manager_disconnect_idempotent():
    mgr = ConnectionManager()
    ws = AsyncMock()
    # Disconnect without ever connecting — should not raise
    await mgr.disconnect(ws, "game1")
    assert mgr.connection_count() == 0


# ── REST publish endpoint ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_publish_endpoint(client):
    resp = await client.post(
        "/ws/publish/401810001",
        json={"id": 99, "description": "Test play"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "broadcast"


@pytest.mark.asyncio
async def test_ws_stats_endpoint(client):
    resp = await client.get("/ws/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_connections" in data
    assert "active_games" in data
