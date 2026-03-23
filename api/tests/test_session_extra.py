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
