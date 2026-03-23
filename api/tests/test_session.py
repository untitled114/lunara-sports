"""Tests for db/session.py — database session management."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.db.session import (
    close_db,
    db_ping,
    get_session,
    get_session_factory,
    init_db,
)


class TestInitDb:
    def test_creates_engine(self):
        """init_db sets up engine and session factory."""
        import src.db.session as mod

        old_engine, old_factory = mod._engine, mod._session_factory
        try:
            # init_db is already exercised by conftest fixtures;
            # just verify the function signature and side effects via mock
            with patch("src.db.session.create_async_engine") as mock_create:
                mock_engine = MagicMock()
                mock_create.return_value = mock_engine
                settings = MagicMock()
                settings.database_url = "postgresql+asyncpg://test"
                init_db(settings)
                mock_create.assert_called_once()
                assert mod._engine is mock_engine
                assert mod._session_factory is not None
        finally:
            mod._engine = old_engine
            mod._session_factory = old_factory


class TestGetSessionFactory:
    def test_returns_none_before_init(self):
        import src.db.session as mod

        old = mod._session_factory
        mod._session_factory = None
        try:
            assert get_session_factory() is None
        finally:
            mod._session_factory = old


class TestGetSession:
    async def test_raises_when_not_initialized(self):
        import src.db.session as mod

        old = mod._session_factory
        mod._session_factory = None
        try:
            with pytest.raises(RuntimeError, match="Database not initialized"):
                async for _ in get_session():
                    pass
        finally:
            mod._session_factory = old


class TestCloseDb:
    async def test_close_when_no_engine(self):
        import src.db.session as mod

        old_engine = mod._engine
        mod._engine = None
        try:
            await close_db()  # Should not raise
        finally:
            mod._engine = old_engine

    async def test_close_disposes_engine(self):
        mock_engine = AsyncMock()
        import src.db.session as mod

        old_engine, old_factory = mod._engine, mod._session_factory
        mod._engine = mock_engine
        mod._session_factory = MagicMock()
        try:
            await close_db()
            mock_engine.dispose.assert_called_once()
            assert mod._engine is None
            assert mod._session_factory is None
        finally:
            mod._engine = old_engine
            mod._session_factory = old_factory


class TestDbPing:
    async def test_returns_false_when_no_engine(self):
        import src.db.session as mod

        old = mod._engine
        mod._engine = None
        try:
            assert await db_ping() is False
        finally:
            mod._engine = old

    async def test_returns_false_on_error(self):
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__aenter__ = AsyncMock(side_effect=Exception("down"))
        mock_engine.connect.return_value.__aexit__ = AsyncMock(return_value=False)

        import src.db.session as mod

        old = mod._engine
        mod._engine = mock_engine
        try:
            assert await db_ping() is False
        finally:
            mod._engine = old
