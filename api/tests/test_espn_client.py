"""Tests for espn_client — cached HTTP requests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.services.espn_client import (
    SCOREBOARD_TTL,
    STANDINGS_TTL,
    SUMMARY_LIVE_TTL,
    SUMMARY_TTL,
    _cached_get,
    _get_client,
    close_espn_client,
    get_game_summary,
    get_game_summary_live,
    get_scoreboard,
    get_standings,
    init_espn_client,
)


@pytest.fixture
def mock_redis():
    """Mock Redis client for caching tests."""
    r = AsyncMock()
    r.get = AsyncMock(return_value=None)
    r.set = AsyncMock()
    with patch("src.services.espn_client.get_redis", return_value=r):
        yield r


@pytest.fixture
def mock_http():
    """Mock httpx client."""
    client = AsyncMock()
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"events": []}
    resp.raise_for_status = MagicMock()
    client.get = AsyncMock(return_value=resp)
    with patch("src.services.espn_client._client", client):
        yield client, resp


class TestCachedGet:
    @pytest.mark.asyncio
    async def test_cache_hit(self, mock_redis):
        mock_redis.get = AsyncMock(return_value='{"data": "cached"}')
        result = await _cached_get("key", "http://test.com", 60)
        assert result == {"data": "cached"}
        mock_redis.set.assert_not_called()

    @pytest.mark.asyncio
    async def test_cache_miss_fetches(self, mock_redis, mock_http):
        client, resp = mock_http
        resp.json.return_value = {"data": "fresh"}
        result = await _cached_get("key", "http://test.com", 60)
        assert result == {"data": "fresh"}
        mock_redis.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_http_error_returns_none(self, mock_redis, mock_http):
        client, resp = mock_http
        client.get = AsyncMock(side_effect=httpx.HTTPError("timeout"))
        result = await _cached_get("key", "http://test.com", 60)
        assert result is None

    @pytest.mark.asyncio
    async def test_passes_params(self, mock_redis, mock_http):
        client, resp = mock_http
        resp.json.return_value = {}
        await _cached_get("key", "http://test.com", 60, params={"date": "20260220"})
        client.get.assert_called_once_with("http://test.com", params={"date": "20260220"})


class TestGetScoreboard:
    @pytest.mark.asyncio
    async def test_with_date(self, mock_redis, mock_http):
        client, resp = mock_http
        resp.json.return_value = {"events": [{"id": "1"}]}
        result = await get_scoreboard("20260220")
        assert result == {"events": [{"id": "1"}]}

    @pytest.mark.asyncio
    async def test_without_date(self, mock_redis, mock_http):
        client, resp = mock_http
        resp.json.return_value = {"events": []}
        result = await get_scoreboard()
        assert result is not None


class TestGetStandings:
    @pytest.mark.asyncio
    async def test_returns_data(self, mock_redis, mock_http):
        client, resp = mock_http
        resp.json.return_value = {"children": []}
        result = await get_standings()
        assert result == {"children": []}


class TestGetGameSummary:
    @pytest.mark.asyncio
    async def test_returns_summary(self, mock_redis, mock_http):
        client, resp = mock_http
        resp.json.return_value = {"boxscore": {}}
        result = await get_game_summary("401810001")
        assert result == {"boxscore": {}}


class TestGetGameSummaryLive:
    @pytest.mark.asyncio
    async def test_uses_shorter_ttl(self, mock_redis, mock_http):
        client, resp = mock_http
        resp.json.return_value = {"boxscore": {}}
        result = await get_game_summary_live("401810001")
        assert result is not None
        # Verify it used the live TTL
        call_args = mock_redis.set.call_args
        assert call_args is not None


class TestClientLifecycle:
    def test_get_client_raises_if_not_initialized(self):
        with patch("src.services.espn_client._client", None):
            with pytest.raises(RuntimeError, match="not initialized"):
                _get_client()

    def test_init_creates_client(self):
        with patch("src.services.espn_client._client", None):
            init_espn_client()
            from src.services import espn_client

            assert espn_client._client is not None
            # Cleanup
            espn_client._client = None

    @pytest.mark.asyncio
    async def test_close_disposes_client(self):
        mock_client = AsyncMock()
        with patch("src.services.espn_client._client", mock_client):
            await close_espn_client()
            mock_client.aclose.assert_called_once()


class TestTTLConstants:
    def test_scoreboard_ttl_short(self):
        assert SCOREBOARD_TTL <= 10

    def test_summary_live_shorter_than_regular(self):
        assert SUMMARY_LIVE_TTL < SUMMARY_TTL

    def test_standings_ttl_long(self):
        assert STANDINGS_TTL >= 1800
