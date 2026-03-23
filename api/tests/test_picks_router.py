"""Tests for the picks router — GET/POST/DELETE endpoints + gating logic."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.db.models import Base, Game, ModelPick, Team, User, UserTail
from src.db.session import get_session
from src.main import app
from src.routers.picks import _gate_pick

# ── Helpers ────────────────────────────────────────────────────────────────


def _make_pick(**overrides) -> ModelPick:
    """Create a ModelPick ORM instance with sensible defaults."""
    defaults = dict(
        id=1,
        game_id="401810001",
        player_name="Jayson Tatum",
        team="BOS",
        market="POINTS",
        line=Decimal("26.5"),
        prediction="OVER",
        p_over=Decimal("0.812"),
        edge=Decimal("3.50"),
        book="DraftKings",
        model_version="xl",
        tier="X",
        actual_value=Decimal("30.0"),
        is_hit=True,
        edge_pct=Decimal("12.50"),
        consensus_line=Decimal("25.5"),
        opponent_team="LAL",
        reasoning="Strong matchup history",
        is_home=True,
        confidence="high",
        line_spread=Decimal("1.5"),
        game_date=date(2026, 3, 22),
        rolling_stats={"L5": 28.4},
        injury_status=None,
        created_at=datetime(2026, 3, 22, 12, 0, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    pick = ModelPick()
    for k, v in defaults.items():
        setattr(pick, k, v)
    return pick


# ── _gate_pick unit tests ──────────────────────────────────────────────────


class TestGatePick:
    """Direct unit tests for the _gate_pick helper function."""

    def test_premium_user_sees_all_fields(self):
        pick = _make_pick()
        result = _gate_pick(pick, is_premium=True)

        assert result["is_gated"] is False
        assert result["line"] == float(pick.line)
        assert result["p_over"] == float(pick.p_over)
        assert result["edge"] == float(pick.edge)
        assert result["book"] == "DraftKings"
        assert result["edge_pct"] == float(pick.edge_pct)
        assert result["consensus_line"] == float(pick.consensus_line)
        assert result["reasoning"] == "Strong matchup history"
        assert result["confidence"] == "high"
        assert result["line_spread"] == float(pick.line_spread)

    def test_free_user_sees_gated_fields(self):
        pick = _make_pick()
        result = _gate_pick(pick, is_premium=False)

        assert result["is_gated"] is True
        assert result["line"] == 0
        assert result["p_over"] is None
        assert result["edge"] is None
        assert result["book"] is None
        assert result["edge_pct"] is None
        assert result["consensus_line"] is None
        assert result["reasoning"] is None
        assert result["confidence"] is None
        assert result["line_spread"] is None

    def test_common_fields_present_for_both(self):
        pick = _make_pick()
        for is_premium in (True, False):
            result = _gate_pick(pick, is_premium=is_premium)
            assert result["id"] == 1
            assert result["game_id"] == "401810001"
            assert result["player_name"] == "Jayson Tatum"
            assert result["team"] == "BOS"
            assert result["market"] == "POINTS"
            assert result["prediction"] == "OVER"
            assert result["model_version"] == "xl"
            assert result["tier"] == "X"
            assert result["actual_value"] == 30.0
            assert result["is_hit"] is True
            assert result["opponent_team"] == "LAL"
            assert result["is_home"] is True

    def test_none_actual_value(self):
        pick = _make_pick(actual_value=None)
        result = _gate_pick(pick, is_premium=True)
        assert result["actual_value"] is None

    def test_none_premium_fields(self):
        """Premium user with None values in optional fields."""
        pick = _make_pick(
            line=None,
            p_over=None,
            edge=None,
            edge_pct=None,
            consensus_line=None,
            line_spread=None,
        )
        result = _gate_pick(pick, is_premium=True)
        assert result["line"] == 0  # None line becomes 0
        assert result["p_over"] is None
        assert result["edge"] is None
        assert result["edge_pct"] is None
        assert result["consensus_line"] is None
        assert result["line_spread"] is None

    def test_rolling_stats_and_injury(self):
        pick = _make_pick(rolling_stats={"L5": 28.4}, injury_status="Questionable")
        result = _gate_pick(pick, is_premium=True)
        assert result["rolling_stats"] == {"L5": 28.4}
        assert result["injury_status"] == "Questionable"


# ── Shared fixture for HTTP tests ──────────────────────────────────────────


@pytest.fixture
async def picks_engine():
    """In-memory async SQLite engine with all tables."""
    eng = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest.fixture
async def picks_session(picks_engine):
    """Async session bound to the in-memory database."""
    factory = async_sessionmaker(picks_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as sess:
        yield sess


FREE_USER_ID = uuid.UUID("aaaaaaaa-1111-2222-3333-444444444444")
PREMIUM_USER_ID = uuid.UUID("bbbbbbbb-1111-2222-3333-444444444444")


@pytest.fixture
async def seeded_picks_session(picks_session):
    """Session with teams, a game, picks, and users (free + premium)."""
    picks_session.add_all(
        [
            Team(abbrev="BOS", name="Boston Celtics", conference="Eastern", division="Atlantic"),
            Team(abbrev="LAL", name="Los Angeles Lakers", conference="Western", division="Pacific"),
        ]
    )
    await picks_session.flush()

    game = Game(
        id="401810001",
        home_team="BOS",
        away_team="LAL",
        status="live",
        home_score=55,
        away_score=48,
        quarter=3,
        clock="8:30",
        start_time=datetime(2026, 3, 22, 0, 30, tzinfo=timezone.utc),
        venue="TD Garden",
    )
    picks_session.add(game)
    await picks_session.flush()

    # Two picks for today
    picks_session.add_all(
        [
            ModelPick(
                id=10,
                game_id="401810001",
                player_name="Jayson Tatum",
                team="BOS",
                market="POINTS",
                line=Decimal("26.5"),
                prediction="OVER",
                p_over=Decimal("0.812"),
                edge=Decimal("3.50"),
                book="DraftKings",
                model_version="xl",
                tier="X",
                actual_value=None,
                is_hit=None,
                edge_pct=Decimal("12.50"),
                consensus_line=Decimal("25.5"),
                opponent_team="LAL",
                reasoning="Strong matchup",
                is_home=True,
                confidence="high",
                line_spread=Decimal("1.5"),
                game_date=date.today(),
            ),
            ModelPick(
                id=11,
                game_id="401810001",
                player_name="LeBron James",
                team="LAL",
                market="REBOUNDS",
                line=Decimal("8.5"),
                prediction="OVER",
                p_over=Decimal("0.720"),
                edge=Decimal("2.80"),
                book="FanDuel",
                model_version="v3",
                tier="Z",
                actual_value=None,
                is_hit=None,
                edge_pct=Decimal("8.00"),
                consensus_line=Decimal("8.0"),
                opponent_team="BOS",
                reasoning="Boards monster",
                is_home=False,
                confidence="medium",
                line_spread=Decimal("1.0"),
                game_date=date.today(),
            ),
        ]
    )
    await picks_session.flush()

    # Free user
    picks_session.add(
        User(
            id=FREE_USER_ID,
            username="freeuser",
            display_name="Free User",
            membership_tier="free",
        )
    )
    # Premium user
    picks_session.add(
        User(
            id=PREMIUM_USER_ID,
            username="premiumuser",
            display_name="Premium User",
            membership_tier="premium",
        )
    )
    await picks_session.commit()
    yield picks_session


def _app_patches():
    """Context managers to mock infrastructure for ASGI testing."""
    mock_consumer_instance = MagicMock()
    mock_consumer_instance.run = AsyncMock()
    mock_consumer_instance.stop = MagicMock()
    mock_consumer_cls = MagicMock(return_value=mock_consumer_instance)

    return (
        patch(
            "src.services.game_service.get_cached_game_list",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "src.services.game_service.get_cached_game_state",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch("src.services.game_service.cache_game_list", new_callable=AsyncMock),
        patch("src.services.game_service.cache_game_state", new_callable=AsyncMock),
        patch(
            "src.services.game_service.espn_client",
            MagicMock(
                get_scoreboard=AsyncMock(return_value=None),
                get_game_summary=AsyncMock(return_value=None),
                get_game_summary_live=AsyncMock(return_value=None),
            ),
        ),
        patch("src.main.init_redis", new_callable=AsyncMock),
        patch("src.main.close_redis", new_callable=AsyncMock),
        patch("src.main.redis_ping", new_callable=AsyncMock, return_value=True),
        patch("src.main.db_ping", new_callable=AsyncMock, return_value=True),
        patch("src.main.init_db"),
        patch("src.main.close_db", new_callable=AsyncMock),
        patch("src.main.run_play_poller", new_callable=AsyncMock),
        patch("src.main.KafkaConsumerLoop", mock_consumer_cls),
    )


@pytest.fixture
async def picks_client(seeded_picks_session):
    """HTTPX async client wired to the seeded in-memory DB."""

    async def _override_session():
        yield seeded_picks_session

    patches = _app_patches()

    with (
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patches[4],
        patches[5],
        patches[6],
        patches[7],
        patches[8],
        patches[9],
        patches[10],
        patches[11],
        patches[12],
    ):
        app.dependency_overrides[get_session] = _override_session
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        app.dependency_overrides.clear()


# ── GET /picks/today ───────────────────────────────────────────────────────


class TestTodayPicks:
    async def test_returns_picks_for_today(self, picks_client):
        # Patch _eastern_today to match the date.today() used in fixture seeding
        with patch("src.routers.picks._eastern_today", return_value=date.today()):
            resp = await picks_client.get("/picks/today")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 2
            names = {p["player_name"] for p in data}
            assert "Jayson Tatum" in names
            assert "LeBron James" in names

    async def test_returns_empty_when_no_picks(self, picks_client):
        """Patch _eastern_today to return a date with no picks."""
        with patch("src.routers.picks._eastern_today", return_value=date(2020, 1, 1)):
            resp = await picks_client.get("/picks/today")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_picks_include_common_fields(self, picks_client):
        with patch("src.routers.picks._eastern_today", return_value=date.today()):
            resp = await picks_client.get("/picks/today")
            pick = resp.json()[0]
            assert "id" in pick
            assert "game_id" in pick
            assert "player_name" in pick
            assert "team" in pick
            assert "market" in pick
            assert "prediction" in pick

    async def test_today_no_auth_still_works(self, picks_client):
        """Anonymous access to /picks/today should return 200."""
        resp = await picks_client.get("/picks/today")
        assert resp.status_code == 200


# ── GET /games/{game_id}/picks ─────────────────────────────────────────────


class TestGamePicks:
    async def test_returns_picks_for_game(self, picks_client):
        resp = await picks_client.get("/games/401810001/picks")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    async def test_returns_empty_for_nonexistent_game(self, picks_client):
        resp = await picks_client.get("/games/NONEXISTENT/picks")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_game_picks_no_auth_still_works(self, picks_client):
        """Anonymous access to /games/{id}/picks should return 200."""
        resp = await picks_client.get("/games/401810001/picks")
        assert resp.status_code == 200


# ── POST /picks/{pick_id}/tail ─────────────────────────────────────────────


class TestTailPick:
    async def test_tail_requires_auth(self, picks_client):
        """No auth header => 401."""
        resp = await picks_client.post("/picks/10/tail")
        assert resp.status_code == 401

    async def test_tail_pick_not_found(self, picks_client):
        """Authenticated user, but pick ID doesn't exist => 404."""
        resp = await picks_client.post(
            "/picks/9999/tail",
            headers={"X-User-Id": str(FREE_USER_ID)},
        )
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Pick not found"

    async def test_tail_pick_success(self, picks_client, seeded_picks_session):
        """Authenticated user tails an existing pick.

        The tail_pick handler uses pg_insert (PostgreSQL-only), so we mock the
        session.execute + session.commit for the INSERT portion while keeping
        the session.get (pick lookup) real.
        """
        original_execute = seeded_picks_session.execute
        original_get = seeded_picks_session.get

        async def patched_execute(stmt, *args, **kwargs):
            # If it's the pg_insert statement, skip it (just pretend success)
            stmt_str = str(type(stmt).__name__)
            if "Insert" in stmt_str:
                return MagicMock()
            return await original_execute(stmt, *args, **kwargs)

        with (
            patch.object(seeded_picks_session, "execute", side_effect=patched_execute),
            patch.object(seeded_picks_session, "commit", new_callable=AsyncMock),
        ):
            resp = await picks_client.post(
                "/picks/10/tail",
                headers={"X-User-Id": str(FREE_USER_ID)},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "tailed"
        assert data["pick_id"] == 10


# ── DELETE /picks/{pick_id}/tail ───────────────────────────────────────────


class TestUntailPick:
    async def test_untail_requires_auth(self, picks_client):
        """No auth header => 401."""
        resp = await picks_client.delete("/picks/10/tail")
        assert resp.status_code == 401

    async def test_untail_pick_success(self, picks_client, seeded_picks_session):
        """Untail returns success even if no matching tail exists (idempotent delete)."""
        resp = await picks_client.delete(
            "/picks/10/tail",
            headers={"X-User-Id": str(FREE_USER_ID)},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "untailed"
        assert resp.json()["pick_id"] == 10

    async def test_untail_after_inserting_tail(self, picks_client, seeded_picks_session):
        """Insert a UserTail directly, then untail via the endpoint."""
        # Insert tail row directly (bypasses pg_insert issue)
        seeded_picks_session.add(UserTail(id=1, user_id=FREE_USER_ID, pick_id=10))
        await seeded_picks_session.commit()

        resp = await picks_client.delete(
            "/picks/10/tail",
            headers={"X-User-Id": str(FREE_USER_ID)},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "untailed"


# ── GET /picks/tailed ──────────────────────────────────────────────────────


class TestTailedPicks:
    async def test_tailed_requires_auth(self, picks_client):
        resp = await picks_client.get("/picks/tailed")
        assert resp.status_code == 401

    async def test_tailed_empty_when_none(self, picks_client):
        resp = await picks_client.get(
            "/picks/tailed",
            headers={"X-User-Id": str(FREE_USER_ID)},
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_tailed_returns_gated_for_free_user(self, picks_client, seeded_picks_session):
        """Free user has a tailed pick — fields are gated."""
        # Insert tail row directly (bypasses pg_insert)
        seeded_picks_session.add(UserTail(id=100, user_id=FREE_USER_ID, pick_id=10))
        await seeded_picks_session.commit()

        resp = await picks_client.get(
            "/picks/tailed",
            headers={"X-User-Id": str(FREE_USER_ID)},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        pick = data[0]
        assert pick["is_gated"] is True
        assert pick["line"] == 0
        assert pick["p_over"] is None
        assert pick["edge"] is None
        assert pick["book"] is None
        assert pick["reasoning"] is None
        assert pick["confidence"] is None

    async def test_tailed_returns_full_for_premium_user(self, picks_client, seeded_picks_session):
        """Premium user has a tailed pick — all fields visible."""
        seeded_picks_session.add(UserTail(id=101, user_id=PREMIUM_USER_ID, pick_id=10))
        await seeded_picks_session.commit()

        resp = await picks_client.get(
            "/picks/tailed",
            headers={"X-User-Id": str(PREMIUM_USER_ID)},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        pick = data[0]
        assert pick["is_gated"] is False
        assert pick["line"] == 26.5
        assert pick["book"] == "DraftKings"
        assert pick["reasoning"] == "Strong matchup"
        assert pick["confidence"] == "high"

    async def test_tailed_multiple_picks(self, picks_client, seeded_picks_session):
        """User tails multiple picks, all returned."""
        seeded_picks_session.add_all(
            [
                UserTail(id=200, user_id=PREMIUM_USER_ID, pick_id=10),
                UserTail(id=201, user_id=PREMIUM_USER_ID, pick_id=11),
            ]
        )
        await seeded_picks_session.commit()

        resp = await picks_client.get(
            "/picks/tailed",
            headers={"X-User-Id": str(PREMIUM_USER_ID)},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2


# ── POST /picks/sync ──────────────────────────────────────────────────────


class TestSyncPicks:
    async def test_sync_no_source_configured(self, picks_client):
        """When neither API URL nor predictions dir is configured, returns 400."""
        mock_settings = MagicMock()
        mock_settings.sport_suite_api_url = ""
        mock_settings.sport_suite_predictions_dir = ""

        with patch("src.routers.picks._get_settings", return_value=mock_settings):
            resp = await picks_client.post("/picks/sync")
        assert resp.status_code == 400
        assert "No pick source configured" in resp.json()["detail"]

    async def test_sync_success(self, picks_client):
        """When API URL is configured and sync succeeds."""
        mock_settings = MagicMock()
        mock_settings.sport_suite_api_url = "http://fake-api"
        mock_settings.sport_suite_api_key = "test-key"
        mock_settings.sport_suite_predictions_dir = ""

        with (
            patch("src.routers.picks._get_settings", return_value=mock_settings),
            patch("src.routers.picks.sync_picks", new_callable=AsyncMock, return_value=5),
        ):
            resp = await picks_client.post("/picks/sync")
        assert resp.status_code == 200
        data = resp.json()
        assert data["synced"] == 5

    async def test_sync_with_explicit_date(self, picks_client):
        """Provide an explicit date parameter."""
        mock_settings = MagicMock()
        mock_settings.sport_suite_api_url = "http://fake-api"
        mock_settings.sport_suite_api_key = "key"
        mock_settings.sport_suite_predictions_dir = ""

        with (
            patch("src.routers.picks._get_settings", return_value=mock_settings),
            patch("src.routers.picks.sync_picks", new_callable=AsyncMock, return_value=3),
        ):
            resp = await picks_client.post("/picks/sync?pick_date=2026-03-20")
        assert resp.status_code == 200
        assert resp.json()["date"] == "2026-03-20"
        assert resp.json()["synced"] == 3

    async def test_sync_with_predictions_dir(self, picks_client):
        """When predictions dir is configured (no API URL), sync still works."""
        mock_settings = MagicMock()
        mock_settings.sport_suite_api_url = ""
        mock_settings.sport_suite_predictions_dir = "/tmp/predictions"
        mock_settings.sport_suite_api_key = ""

        with (
            patch("src.routers.picks._get_settings", return_value=mock_settings),
            patch("src.routers.picks.sync_picks", new_callable=AsyncMock, return_value=2),
        ):
            resp = await picks_client.post("/picks/sync")
        assert resp.status_code == 200
        assert resp.json()["synced"] == 2


# ── _eastern_today ─────────────────────────────────────────────────────────


class TestEasternToday:
    def test_returns_date(self):
        from src.routers.picks import _eastern_today

        result = _eastern_today()
        assert isinstance(result, date)


# ── _get_settings ──────────────────────────────────────────────────────────


class TestGetSettings:
    def test_returns_settings_instance(self):
        # Reset global cache for clean test
        import src.routers.picks as picks_mod
        from src.routers.picks import _get_settings

        picks_mod._settings = None
        result = _get_settings()
        from src.config import Settings

        assert isinstance(result, Settings)
        # Second call should return cached instance
        result2 = _get_settings()
        assert result is result2
        # Clean up
        picks_mod._settings = None
