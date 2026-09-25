"""Extra tests for db/session — create_tables, seed_teams."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.db.session import create_tables, seed_teams


class TestCreateTables:
    async def test_raises_when_no_engine(self):
        import src.db.session as mod

        old = mod._engine
        mod._engine = None
        try:
            with pytest.raises(RuntimeError, match="Database not initialized"):
                await create_tables()
        finally:
            mod._engine = old

    async def test_creates_tables(self):
        mock_engine = MagicMock()
        mock_conn = AsyncMock()
        mock_engine.begin.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_engine.begin.return_value.__aexit__ = AsyncMock(return_value=False)

        import src.db.session as mod

        old = mod._engine
        mod._engine = mock_engine
        try:
            await create_tables()
            mock_conn.run_sync.assert_called_once()
        finally:
            mod._engine = old


class TestSeedTeams:
    async def test_skips_when_no_factory(self):
        import src.db.session as mod

        old = mod._session_factory
        mod._session_factory = None
        try:
            await seed_teams()  # should not raise
        finally:
            mod._session_factory = old

    async def test_inserts_30_teams_then_noop_on_second_call(self, session_factory):
        """seed_teams() is idempotent: it inserts all 30 NBA teams once,
        and a second call does not error or duplicate rows (uses
        ON CONFLICT DO NOTHING on the abbrev unique index)."""
        from sqlalchemy import select

        import src.db.session as mod
        from src.db.models import Team

        old = mod._session_factory
        mod._session_factory = session_factory
        try:
            await seed_teams()
            async with session_factory() as s:
                rows = (await s.execute(select(Team))).scalars().all()
                assert len(rows) == 30
                assert {t.abbrev for t in rows if t.abbrev == "BOS"} == {"BOS"}

            await seed_teams()  # second call: no-op, no error, no duplicates
            async with session_factory() as s:
                rows = (await s.execute(select(Team))).scalars().all()
                assert len(rows) == 30
        finally:
            mod._session_factory = old
