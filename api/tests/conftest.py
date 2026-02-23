"""Shared test fixtures for the API service."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.db.models import Base, Game, Leaderboard, Play, Prediction, Team, User
from src.db.session import get_session
from src.main import app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def engine():
    """In-memory async SQLite engine."""
    eng = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest.fixture
async def session(engine):
    """Async session bound to the in-memory database."""
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as sess:
        yield sess


@pytest.fixture
async def session_factory(engine):
    """Return the session factory itself (for play_poller tests)."""
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def seeded_session(session):
    """Session with seed data: 2 teams, 1 game, 3 plays, 1 user."""
    # Teams
    session.add_all([
        Team(abbrev="BOS", name="Boston Celtics", conference="Eastern", division="Atlantic"),
        Team(abbrev="LAL", name="Los Angeles Lakers", conference="Western", division="Pacific"),
    ])
    await session.flush()

    # Game
    game = Game(
        id="401810001",
        home_team="BOS",
        away_team="LAL",
        status="live",
        home_score=55,
        away_score=48,
        quarter=3,
        clock="8:30",
        start_time=datetime(2026, 2, 17, 0, 0, tzinfo=timezone.utc),
        venue="TD Garden",
    )
    session.add(game)
    await session.flush()

    # Plays (explicit IDs for SQLite compatibility)
    session.add_all([
        Play(id=1, game_id="401810001", sequence_number=1, quarter=1, clock="12:00",
             event_type="jump_ball", description="Tip-off", team="BOS",
             home_score=0, away_score=0),
        Play(id=2, game_id="401810001", sequence_number=10, quarter=1, clock="11:00",
             event_type="jump_shot", description="Tatum makes jumper", team="BOS",
             player_name="Jayson Tatum", home_score=2, away_score=0),
        Play(id=3, game_id="401810001", sequence_number=20, quarter=1, clock="10:30",
             event_type="layup", description="LeBron makes layup", team="LAL",
             player_name="LeBron James", home_score=2, away_score=2),
    ])
    await session.flush()

    # User
    user_id = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    session.add(User(id=user_id, username="testuser", display_name="Test User"))
    await session.flush()

    # Leaderboard
    session.add(Leaderboard(
        user_id=user_id, season="2025-26",
        total_points=150, correct_predictions=30, total_predictions=50,
        streak=5, rank=1,
    ))
    await session.commit()

    yield session


# Shared mock context manager for patching Redis, DB init, and the play poller
_MOCK_PATCHES = [
    ("src.services.game_service.get_cached_game_list", AsyncMock(return_value=None)),
    ("src.services.game_service.get_cached_game_state", AsyncMock(return_value=None)),
    ("src.services.game_service.cache_game_list", AsyncMock()),
    ("src.services.game_service.cache_game_state", AsyncMock()),
    ("src.main.init_redis", AsyncMock()),
    ("src.main.close_redis", AsyncMock()),
    ("src.main.redis_ping", AsyncMock(return_value=True)),
    ("src.main.db_ping", AsyncMock(return_value=True)),
    ("src.main.init_db", lambda *a, **kw: None),
    ("src.main.close_db", AsyncMock()),
    ("src.main.run_play_poller", AsyncMock()),
]


@pytest.fixture
async def client(seeded_session):
    """HTTPX async client with DB session and Redis mocked."""

    async def _override_session():
        yield seeded_session

    patches = [
        patch(target, new_callable=lambda: type(mock) if callable(mock) else lambda: mock, return_value=mock() if isinstance(mock, type) else mock)
        if isinstance(mock, type) else patch(target, mock)
        for target, mock in _MOCK_PATCHES
    ]

    # Mock KafkaConsumerLoop so tests don't attempt real Kafka connections
    mock_consumer_instance = MagicMock()
    mock_consumer_instance.run = AsyncMock()
    mock_consumer_instance.stop = MagicMock()
    mock_consumer_cls = MagicMock(return_value=mock_consumer_instance)

    with patch("src.services.game_service.get_cached_game_list", new_callable=AsyncMock, return_value=None), \
         patch("src.services.game_service.get_cached_game_state", new_callable=AsyncMock, return_value=None), \
         patch("src.services.game_service.cache_game_list", new_callable=AsyncMock), \
         patch("src.services.game_service.cache_game_state", new_callable=AsyncMock), \
         patch("src.main.init_redis", new_callable=AsyncMock), \
         patch("src.main.close_redis", new_callable=AsyncMock), \
         patch("src.main.redis_ping", new_callable=AsyncMock, return_value=True), \
         patch("src.main.db_ping", new_callable=AsyncMock, return_value=True), \
         patch("src.main.init_db"), \
         patch("src.main.close_db", new_callable=AsyncMock), \
         patch("src.main.run_play_poller", new_callable=AsyncMock), \
         patch("src.main.KafkaConsumerLoop", mock_consumer_cls):
        app.dependency_overrides[get_session] = _override_session
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        app.dependency_overrides.clear()
