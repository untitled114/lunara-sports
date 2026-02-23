"""SQLAlchemy async engine and session factory."""

from __future__ import annotations

from collections.abc import AsyncGenerator

import structlog
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from ..config import Settings

logger = structlog.get_logger(__name__)

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_db(settings: Settings) -> None:
    """Create the async engine and session factory."""
    global _engine, _session_factory
    _engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_size=10,
        max_overflow=20,
    )
    _session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
    logger.info("db.engine_created", url=settings.database_url.split("@")[-1])


async def create_tables() -> None:
    """Create all tables if they don't exist (for production bootstrap)."""
    if _engine is None:
        raise RuntimeError("Database not initialized — call init_db() first")
    from .models import Base
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("db.tables_created")


async def seed_teams() -> None:
    """Seed the teams table with NBA teams (idempotent)."""
    if _session_factory is None:
        return
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from .models import Team

    teams = [
        ("ATL", "Atlanta Hawks", "Eastern", "Southeast"),
        ("BOS", "Boston Celtics", "Eastern", "Atlantic"),
        ("BKN", "Brooklyn Nets", "Eastern", "Atlantic"),
        ("CHA", "Charlotte Hornets", "Eastern", "Southeast"),
        ("CHI", "Chicago Bulls", "Eastern", "Central"),
        ("CLE", "Cleveland Cavaliers", "Eastern", "Central"),
        ("DAL", "Dallas Mavericks", "Western", "Southwest"),
        ("DEN", "Denver Nuggets", "Western", "Northwest"),
        ("DET", "Detroit Pistons", "Eastern", "Central"),
        ("GS", "Golden State Warriors", "Western", "Pacific"),
        ("HOU", "Houston Rockets", "Western", "Southwest"),
        ("IND", "Indiana Pacers", "Eastern", "Central"),
        ("LAC", "LA Clippers", "Western", "Pacific"),
        ("LAL", "Los Angeles Lakers", "Western", "Pacific"),
        ("MEM", "Memphis Grizzlies", "Western", "Southwest"),
        ("MIA", "Miami Heat", "Eastern", "Southeast"),
        ("MIL", "Milwaukee Bucks", "Eastern", "Central"),
        ("MIN", "Minnesota Timberwolves", "Western", "Northwest"),
        ("NO", "New Orleans Pelicans", "Western", "Southwest"),
        ("NY", "New York Knicks", "Eastern", "Atlantic"),
        ("OKC", "Oklahoma City Thunder", "Western", "Northwest"),
        ("ORL", "Orlando Magic", "Eastern", "Southeast"),
        ("PHI", "Philadelphia 76ers", "Eastern", "Atlantic"),
        ("PHX", "Phoenix Suns", "Western", "Pacific"),
        ("POR", "Portland Trail Blazers", "Western", "Northwest"),
        ("SAC", "Sacramento Kings", "Western", "Pacific"),
        ("SA", "San Antonio Spurs", "Western", "Southwest"),
        ("TOR", "Toronto Raptors", "Eastern", "Atlantic"),
        ("UTA", "Utah Jazz", "Western", "Northwest"),
        ("WSH", "Washington Wizards", "Eastern", "Southeast"),
    ]
    async with _session_factory() as session:
        for abbrev, name, conf, div in teams:
            stmt = pg_insert(Team).values(
                abbrev=abbrev, name=name, conference=conf, division=div,
            ).on_conflict_do_nothing(index_elements=["abbrev"])
            await session.execute(stmt)
        await session.commit()
    logger.info("db.teams_seeded", count=len(teams))


async def close_db() -> None:
    """Dispose of the engine connection pool."""
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("db.engine_disposed")


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async SQLAlchemy session."""
    if _session_factory is None:
        raise RuntimeError("Database not initialized — call init_db() in lifespan")
    async with _session_factory() as session:
        yield session


def get_session_factory() -> async_sessionmaker[AsyncSession] | None:
    """Return the session factory (for use outside of FastAPI dependency injection)."""
    return _session_factory


async def db_ping() -> bool:
    """Health check — returns True if PG is reachable."""
    if _engine is None:
        return False
    try:
        async with _engine.connect() as conn:
            await conn.execute(
                __import__("sqlalchemy").text("SELECT 1")
            )
        return True
    except Exception:
        return False
