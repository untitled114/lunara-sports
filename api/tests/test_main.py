"""Tests for main.py — lifespan, WebSocket handlers, middleware, endpoints."""

from __future__ import annotations

import json
from contextlib import ExitStack, contextmanager
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient
from starlette.testclient import TestClient

from src.config import Settings
from src.db.session import get_session
from src.main import app, lifespan

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_settings(**overrides):
    """Build a mock Settings object with safe defaults for testing."""
    defaults = dict(
        database_url="sqlite+aiosqlite:///:memory:",
        redis_url="redis://localhost:6379/0",
        api_host="0.0.0.0",
        api_port=8000,
        sport_suite_predictions_dir="",
        sport_suite_api_url="",
        sport_suite_api_key="",
        olap_export_dir="",
        jwt_secret="test-secret",
        jwt_algorithm="HS256",
        jwt_expiry_days=7,
    )
    defaults.update(overrides)
    s = MagicMock(spec=Settings)
    for k, v in defaults.items():
        setattr(s, k, v)
    return s


@contextmanager
def _lifespan_mocks(settings):
    """Apply all lifespan-related patches at once to avoid deep nesting."""
    targets = {
        "src.main.Settings": MagicMock(return_value=settings),
        "src.main.init_db": MagicMock(),
        "src.main.create_tables": AsyncMock(),
        "src.main.seed_teams": AsyncMock(),
        "src.main.init_redis": AsyncMock(),
        "src.main.init_espn_client": MagicMock(),
        "src.main.populate_team_logos": AsyncMock(),
        "src.main.close_espn_client": AsyncMock(),
        "src.main.close_redis": AsyncMock(),
        "src.main.close_db": AsyncMock(),
        "src.main.run_play_poller": AsyncMock(),
        "src.main.run_scoreboard_poller": AsyncMock(),
        "src.main.run_pick_sync_poller": AsyncMock(),
        "src.main.run_pick_tracker_poller": AsyncMock(),
        "src.main.run_olap_poller": AsyncMock(),
    }
    with ExitStack() as stack:
        mocks = {}
        for target, mock_obj in targets.items():
            mocks[target] = stack.enter_context(patch(target, mock_obj))
        yield mocks


@contextmanager
def _app_test_mocks(extra_patches=None):
    """Apply all patches needed to run the app via TestClient or AsyncClient.

    This includes every lifespan dependency so that ``TestClient(app)``
    can start the application without real infrastructure.
    """
    targets = {
        # Game-service level mocks (used by routers)
        "src.services.game_service.get_cached_game_list": AsyncMock(return_value=None),
        "src.services.game_service.get_cached_game_state": AsyncMock(return_value=None),
        "src.services.game_service.cache_game_list": AsyncMock(),
        "src.services.game_service.cache_game_state": AsyncMock(),
        "src.services.game_service.espn_client": MagicMock(
            get_scoreboard=AsyncMock(return_value=None),
            get_game_summary=AsyncMock(return_value=None),
            get_game_summary_live=AsyncMock(return_value=None),
        ),
        # Lifespan startup mocks
        "src.main.init_db": MagicMock(),
        "src.main.create_tables": AsyncMock(),
        "src.main.seed_teams": AsyncMock(),
        "src.main.init_redis": AsyncMock(),
        "src.main.init_espn_client": MagicMock(),
        "src.main.populate_team_logos": AsyncMock(),
        # Lifespan shutdown mocks
        "src.main.close_espn_client": AsyncMock(),
        "src.main.close_redis": AsyncMock(),
        "src.main.close_db": AsyncMock(),
        # Health-check mocks
        "src.main.redis_ping": AsyncMock(return_value=True),
        "src.main.db_ping": AsyncMock(return_value=True),
        # Background poller mocks
        "src.main.run_play_poller": AsyncMock(),
        "src.main.run_scoreboard_poller": AsyncMock(),
        "src.main.run_pick_sync_poller": AsyncMock(),
        "src.main.run_pick_tracker_poller": AsyncMock(),
        "src.main.run_olap_poller": AsyncMock(),
    }
    if extra_patches:
        targets.update(extra_patches)
    with ExitStack() as stack:
        mocks = {}
        for target, mock_obj in targets.items():
            mocks[target] = stack.enter_context(patch(target, mock_obj))
        yield mocks


# ---------------------------------------------------------------------------
# Lifespan Tests
# ---------------------------------------------------------------------------


class TestLifespan:
    """Test the lifespan context manager — startup and shutdown paths."""

    async def test_lifespan_full_cycle(self):
        """Lifespan performs full startup then a clean shutdown (no message broker)."""
        settings = _make_settings()

        with _lifespan_mocks(settings) as mocks:
            async with lifespan(MagicMock()):
                mocks["src.main.init_db"].assert_called_once()
                mocks["src.main.create_tables"].assert_awaited_once()
                mocks["src.main.seed_teams"].assert_awaited_once()
                mocks["src.main.init_redis"].assert_awaited_once()
                mocks["src.main.init_espn_client"].assert_called_once()
                mocks["src.main.populate_team_logos"].assert_awaited_once()

            # Shutdown
            mocks["src.main.close_espn_client"].assert_awaited_once()
            mocks["src.main.close_redis"].assert_awaited_once()
            mocks["src.main.close_db"].assert_awaited_once()


# ---------------------------------------------------------------------------
# Health Endpoint Tests (degraded states)
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    async def test_health_degraded_postgres_down(self, seeded_session):
        """Health returns degraded when postgres ping fails."""

        async def _override():
            yield seeded_session

        extras = {
            "src.main.db_ping": AsyncMock(return_value=False),
            "src.main.redis_ping": AsyncMock(return_value=True),
        }

        with _app_test_mocks(extra_patches=extras):
            app.dependency_overrides[get_session] = _override
            try:
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as c:
                    resp = await c.get("/health")
                    assert resp.status_code == 200
                    data = resp.json()
                    assert data["status"] == "degraded"
                    assert data["postgres"] is False
                    assert data["redis"] is True
            finally:
                app.dependency_overrides.clear()

    async def test_health_degraded_redis_down(self, seeded_session):
        """Health returns degraded when redis ping fails."""

        async def _override():
            yield seeded_session

        extras = {
            "src.main.db_ping": AsyncMock(return_value=True),
            "src.main.redis_ping": AsyncMock(return_value=False),
        }

        with _app_test_mocks(extra_patches=extras):
            app.dependency_overrides[get_session] = _override
            try:
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as c:
                    resp = await c.get("/health")
                    data = resp.json()
                    assert data["status"] == "degraded"
                    assert data["postgres"] is True
                    assert data["redis"] is False
            finally:
                app.dependency_overrides.clear()

    async def test_health_degraded_both_down(self, seeded_session):
        """Health returns degraded when both services fail."""

        async def _override():
            yield seeded_session

        extras = {
            "src.main.db_ping": AsyncMock(return_value=False),
            "src.main.redis_ping": AsyncMock(return_value=False),
        }

        with _app_test_mocks(extra_patches=extras):
            app.dependency_overrides[get_session] = _override
            try:
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as c:
                    resp = await c.get("/health")
                    data = resp.json()
                    assert data["status"] == "degraded"
                    assert data["postgres"] is False
                    assert data["redis"] is False
            finally:
                app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# NoCacheMiddleware Tests
# ---------------------------------------------------------------------------


class TestNoCacheMiddleware:
    async def test_nocache_headers_on_normal_path(self, client):
        """Normal API paths should get no-cache headers."""
        resp = await client.get("/health")
        assert resp.headers.get("cache-control") == "no-store, no-cache, must-revalidate, max-age=0"
        assert resp.headers.get("cdn-cache-control") == "no-store"

    async def test_nocache_on_ws_stats(self, client):
        """API endpoint /ws/stats should get no-cache headers."""
        resp = await client.get("/ws/stats")
        assert resp.headers.get("cache-control") == "no-store, no-cache, must-revalidate, max-age=0"
        assert resp.headers.get("cdn-cache-control") == "no-store"

    async def test_no_nocache_headers_on_metrics(self, client):
        """/metrics path should NOT get no-cache headers."""
        resp = await client.get("/metrics")
        assert resp.headers.get("cdn-cache-control") is None

    async def test_no_nocache_headers_on_docs(self, client):
        """/docs path should NOT get no-cache headers."""
        resp = await client.get("/docs")
        assert resp.headers.get("cdn-cache-control") is None

    async def test_no_nocache_headers_on_openapi(self, client):
        """/openapi.json path should NOT get no-cache headers."""
        resp = await client.get("/openapi.json")
        assert resp.headers.get("cdn-cache-control") is None


# ---------------------------------------------------------------------------
# WebSocket: /ws/scoreboard
# ---------------------------------------------------------------------------


class TestScoreboardWebSocket:
    def test_scoreboard_ws_connect_with_cached_data(self):
        """Scoreboard WS sends cached game list on connect, responds to ping."""
        cached_games = [{"id": "g1", "status": "live"}]
        extras = {
            "src.main.get_cached_game_list": AsyncMock(return_value=cached_games),
        }

        with _app_test_mocks(extra_patches=extras):
            with TestClient(app) as tc:
                with tc.websocket_connect("/ws/scoreboard") as ws:
                    msg = ws.receive_text()
                    data = json.loads(msg)
                    assert data["type"] == "scoreboard_update"
                    assert data["data"] == cached_games

                    ws.send_text("ping")
                    pong = ws.receive_text()
                    assert json.loads(pong)["type"] == "pong"

    def test_scoreboard_ws_connect_no_cached_data(self):
        """Scoreboard WS skips initial message when no cache exists."""
        extras = {
            "src.main.get_cached_game_list": AsyncMock(return_value=None),
        }

        with _app_test_mocks(extra_patches=extras):
            with TestClient(app) as tc:
                with tc.websocket_connect("/ws/scoreboard") as ws:
                    # No cached data — first response should be to a ping
                    ws.send_text("ping")
                    pong = ws.receive_text()
                    assert json.loads(pong)["type"] == "pong"

    def test_scoreboard_ws_ignores_non_ping_then_responds_to_ping(self):
        """A non-"ping" message takes the `if data == "ping":` false branch
        (229->227) — no reply is sent for it, and the loop keeps the socket
        open to receive the next message. A "ping" sent right after is the
        first (and only) reply pulled off the wire, proving "hello" itself
        produced nothing."""
        extras = {
            "src.main.get_cached_game_list": AsyncMock(return_value=None),
        }

        with _app_test_mocks(extra_patches=extras):
            with TestClient(app) as tc:
                with tc.websocket_connect("/ws/scoreboard") as ws:
                    ws.send_text("hello")  # false branch: no reply
                    ws.send_text("ping")  # true branch: replies with pong
                    reply = json.loads(ws.receive_text())
                    assert reply["type"] == "pong"

    def test_scoreboard_ws_disconnect(self):
        """Scoreboard WS handles clean disconnect."""
        extras = {
            "src.main.get_cached_game_list": AsyncMock(return_value=None),
        }

        with _app_test_mocks(extra_patches=extras):
            with TestClient(app) as tc:
                with tc.websocket_connect("/ws/scoreboard") as ws:
                    ws.send_text("ping")
                    ws.receive_text()
                # WS closes — disconnect handler runs

    def test_scoreboard_ws_exception_during_cache_fetch(self):
        """Scoreboard WS handles exception in get_cached_game_list gracefully."""
        extras = {
            "src.main.get_cached_game_list": AsyncMock(side_effect=RuntimeError("redis down")),
        }

        with _app_test_mocks(extra_patches=extras):
            with TestClient(app) as tc:
                # The exception causes the handler to fall through to except Exception
                # and disconnect cleanly (no unhandled error).
                with tc.websocket_connect("/ws/scoreboard"):
                    pass  # connection opened then closes


# ---------------------------------------------------------------------------
# WebSocket: /ws/{game_id}
# ---------------------------------------------------------------------------


class TestGameWebSocket:
    def test_game_ws_connect_receives_history_and_ping(self):
        """Game WS sends play history on connect and responds to ping."""
        fake_plays = [
            {"id": 1, "event_type": "jump_ball", "description": "Tip-off"},
            {"id": 2, "event_type": "jump_shot", "description": "Tatum 2pt"},
        ]
        extras = {
            "src.main.get_recent_plays": AsyncMock(return_value=fake_plays),
        }

        with _app_test_mocks(extra_patches=extras):
            with TestClient(app) as tc:
                with tc.websocket_connect("/ws/game123") as ws:
                    msg = ws.receive_text()
                    data = json.loads(msg)
                    assert data["type"] == "history"
                    assert len(data["data"]) == 2
                    assert data["data"][0]["event_type"] == "jump_ball"

                    ws.send_text("ping")
                    pong = ws.receive_text()
                    assert json.loads(pong)["type"] == "pong"

    def test_game_ws_empty_history(self):
        """Game WS sends empty history when no plays exist."""
        extras = {
            "src.main.get_recent_plays": AsyncMock(return_value=[]),
        }

        with _app_test_mocks(extra_patches=extras):
            with TestClient(app) as tc:
                with tc.websocket_connect("/ws/game999") as ws:
                    msg = ws.receive_text()
                    data = json.loads(msg)
                    assert data["type"] == "history"
                    assert data["data"] == []

    def test_game_ws_disconnect(self):
        """Game WS handles disconnect cleanly."""
        extras = {
            "src.main.get_recent_plays": AsyncMock(return_value=[]),
        }

        with _app_test_mocks(extra_patches=extras):
            with TestClient(app) as tc:
                with tc.websocket_connect("/ws/game999") as ws:
                    ws.receive_text()  # consume history
                    ws.send_text("ping")
                    ws.receive_text()  # consume pong
                # WS closes cleanly

    def test_game_ws_non_ping_message_continues_loop(self):
        """Game WS keeps alive on non-ping messages (no pong for non-ping)."""
        extras = {
            "src.main.get_recent_plays": AsyncMock(return_value=[]),
        }

        with _app_test_mocks(extra_patches=extras):
            with TestClient(app) as tc:
                with tc.websocket_connect("/ws/game999") as ws:
                    ws.receive_text()  # consume history
                    # Send a non-ping message, then ping to prove loop is still alive
                    ws.send_text("hello")
                    ws.send_text("ping")
                    pong = ws.receive_text()
                    assert json.loads(pong)["type"] == "pong"

    def test_game_ws_exception_during_get_recent_plays(self):
        """Game WS handles exception in get_recent_plays gracefully."""
        extras = {
            "src.main.get_recent_plays": AsyncMock(side_effect=RuntimeError("db error")),
        }

        with _app_test_mocks(extra_patches=extras):
            with TestClient(app) as tc:
                # The exception triggers except Exception, which disconnects cleanly
                with tc.websocket_connect("/ws/game_err"):
                    pass


# ---------------------------------------------------------------------------
# ws_stats and publish_play (additional edge-case tests)
# ---------------------------------------------------------------------------


class TestWsEndpoints:
    async def test_ws_stats_returns_counts(self, client):
        resp = await client.get("/ws/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["total_connections"], int)
        assert isinstance(data["active_games"], list)

    async def test_publish_play_returns_202(self, client):
        resp = await client.post(
            "/ws/publish/game123",
            json={"event_type": "three_pointer", "player": "Curry"},
        )
        assert resp.status_code == 202
        data = resp.json()
        assert data["status"] == "broadcast"
        assert "clients" in data

    async def test_publish_play_empty_body(self, client):
        resp = await client.post("/ws/publish/game_x", json={})
        assert resp.status_code == 202
        data = resp.json()
        assert data["status"] == "broadcast"
