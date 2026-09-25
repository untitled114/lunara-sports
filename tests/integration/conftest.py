"""Fixtures for integration tests against a REAL, throwaway Postgres.

Set ``TEST_DATABASE_URL`` to a local, dedicated database, e.g.::

    docker run -d --name lunara-it-pg -p 55433:5432 \\
        -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lunara_it postgres:16
    TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55433/lunara_it \\
        pytest tests/integration -q

The ``db`` fixture wipes the ``public`` schema, so it refuses any DSN that is
not localhost/127.0.0.1 with a non-production database name (see db_guard).
Without ``TEST_DATABASE_URL`` the database tests skip.
"""

from __future__ import annotations

import os
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from tests.integration.db_guard import assert_safe_test_dsn

DSN = os.environ.get("TEST_DATABASE_URL", "")
MIGRATIONS = sorted(
    (Path(__file__).parents[2] / "storage/postgres/migrations").glob("*.sql")
)

requires_db = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set")


@pytest_asyncio.fixture
async def db():
    """A freshly migrated schema (teams seeded by migration 007); yields an asyncpg connection."""
    assert_safe_test_dsn(DSN)
    assert MIGRATIONS, "no migrations found"
    conn = await asyncpg.connect(DSN)
    try:
        await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        for migration in MIGRATIONS:
            await conn.execute(migration.read_text())
        yield conn
    finally:
        await conn.close()


@pytest_asyncio.fixture
async def session_factory(db):
    """The API's session factory type, bound to the test DSN (+asyncpg driver)."""
    url = DSN.replace("postgresql://", "postgresql+asyncpg://", 1).replace(
        "postgres://", "postgresql+asyncpg://", 1
    )
    engine = create_async_engine(url)
    try:
        yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    finally:
        await engine.dispose()
