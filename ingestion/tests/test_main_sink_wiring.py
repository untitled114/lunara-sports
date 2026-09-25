"""Ingestion wiring: one PostgresSink + one EspnHttp, no Kafka/PubSub (Task 10)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

pytestmark = pytest.mark.xfail(strict=True, reason="pending Task 10")


def test_settings_require_database_url(monkeypatch):
    from src.config import Settings

    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_have_no_kafka_or_pubsub(monkeypatch):
    from src.config import Settings

    s = Settings(_env_file=None, database_url="postgresql://x")
    for gone in ("kafka_bootstrap_servers", "schema_registry_url", "pubsub_project"):
        assert not hasattr(s, gone)
    assert s.espn_proxy_url == "" and s.proxy_trigger_failures == 3
    assert s.proxy_cooldown_seconds == 300.0


@pytest.mark.asyncio
async def test_build_io_creates_connected_sink_and_shared_http():
    from src.__main__ import build_io
    from src.config import Settings

    s = Settings(
        _env_file=None,
        database_url="postgresql://x",
        espn_proxy_url="http://p",
        proxy_trigger_failures=4,
        proxy_cooldown_seconds=60,
    )
    with patch("src.__main__.PostgresSink") as sink_cls, patch("src.__main__.EspnHttp") as http_cls:
        sink_cls.return_value.connect = AsyncMock()
        sink, http = await build_io(s)
    sink_cls.assert_called_once_with("postgresql://x")
    sink.connect.assert_awaited_once()
    http_cls.assert_called_once_with("http://p", trigger_failures=4, cooldown_seconds=60)


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
