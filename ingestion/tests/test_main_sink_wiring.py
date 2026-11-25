"""Ingestion wiring: one PostgresSink and one EspnHttp, shared by every collector."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError


def test_settings_require_database_url(monkeypatch):
    from src.config import Settings

    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


@pytest.mark.asyncio
async def test_build_io_creates_connected_sink_and_shared_http():
    from src.__main__ import build_io
    from src.config import Settings

    s = Settings(_env_file=None, database_url="postgresql://x")
    with (
        patch("src.__main__.PostgresSink") as sink_cls,
        patch("src.__main__.build_http") as build_http,
    ):
        sink_cls.return_value.connect = AsyncMock()
        sink, http = await build_io(s)
    sink_cls.assert_called_once_with("postgresql://x")
    sink.connect.assert_awaited_once()
    build_http.assert_called_once_with()
    assert http is build_http.return_value


@pytest.mark.asyncio
async def test_collectors_share_one_http_and_flush_sink_async():
    from src.collectors.scoreboard import ScoreboardCollector
    from src.config import Settings

    s = Settings(_env_file=None, database_url="postgresql://x")
    sink, http = AsyncMock(), AsyncMock()
    sink.produce = lambda **kw: None
    http.get.return_value.json = lambda: {"events": []}
    http.get.return_value.raise_for_status = lambda: None
    c = ScoreboardCollector(s, sink, http)
    await c.poll()
    http.get.assert_awaited()
    sink.flush.assert_awaited()
