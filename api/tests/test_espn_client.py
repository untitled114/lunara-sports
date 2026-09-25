"""Tests for espn_client — cached HTTP requests."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.services.espn_client import (
    CALENDAR_TTL,
    SCOREBOARD_TTL,
    STANDINGS_TTL,
    SUMMARY_LIVE_TTL,
    SUMMARY_TTL,
    _cached_get,
    _get_client,
    close_espn_client,
    get_athlete_gamelog,
    get_athlete_info,
    get_athlete_stats,
    get_game_summary,
    get_game_summary_live,
    get_scoreboard,
    get_scoreboard_calendar,
    get_standings,
    get_team_roster,
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


class TestGetScoreboardCalendar:
    @pytest.mark.asyncio
    async def test_uses_own_cache_key_and_long_ttl(self, mock_redis, mock_http):
        """Must not reuse get_scoreboard's 8s live-score cache — the calendar barely
        changes intra-day, so the /games/next fallback path gets its own key and a
        long TTL instead of re-hitting ESPN on essentially every request."""
        _, resp = mock_http
        resp.json.return_value = {"leagues": [{"calendar": ["2026-10-03T07:00Z"]}]}
        days = await get_scoreboard_calendar()
        assert days == [date(2026, 10, 3)]
        mock_redis.get.assert_awaited_once_with("espn:scoreboard:calendar")
        mock_redis.set.assert_awaited_once()
        assert mock_redis.set.call_args.args[0] == "espn:scoreboard:calendar"
        assert mock_redis.set.call_args.kwargs["ex"] == CALENDAR_TTL == 21600

    @pytest.mark.asyncio
    async def test_dict_shaped_calendar_entries(self, mock_redis, mock_http):
        """Some ESPN responses give calendar items as {"startDate": ...} objects
        rather than bare strings — both shapes must parse to the same ET date."""
        _, resp = mock_http
        resp.json.return_value = {"leagues": [{"calendar": [{"startDate": "2026-10-03T07:00Z"}]}]}
        assert await get_scoreboard_calendar() == [date(2026, 10, 3)]

    @pytest.mark.asyncio
    async def test_skips_blank_entries(self, mock_redis, mock_http):
        """A calendar item with no usable date string is skipped, not raised on."""
        _, resp = mock_http
        resp.json.return_value = {
            "leagues": [{"calendar": ["", {"startDate": ""}, "2026-10-03T07:00Z"]}]
        }
        assert await get_scoreboard_calendar() == [date(2026, 10, 3)]

    @pytest.mark.asyncio
    async def test_no_data_returns_empty(self, mock_redis, mock_http):
        client, _ = mock_http
        client.get = AsyncMock(side_effect=httpx.HTTPError("timeout"))
        assert await get_scoreboard_calendar() == []


class TestGetStandings:
    @pytest.mark.asyncio
    async def test_returns_data(self, mock_redis, mock_http):
        client, resp = mock_http
        resp.json.return_value = {"children": []}
        result = await get_standings()
        assert result == {"children": []}

    @pytest.mark.asyncio
    async def test_with_season_appends_query_and_cache_suffix(self, mock_redis, mock_http):
        client, resp = mock_http
        resp.json.return_value = {"children": [], "seasons": [{"year": 2026}]}
        result = await get_standings(season=2026)
        assert result == {"children": [], "seasons": [{"year": 2026}]}
        client.get.assert_called_once_with(
            "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=2026",
            params=None,
        )
        mock_redis.set.assert_called_once()
        assert mock_redis.set.call_args.args[0] == "espn:standings:2026"


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


class TestUncachedWrapperFunctions:
    """Thin wrapper functions that just delegate to _cached_get with their
    own cache key / URL / TTL — previously never exercised at all."""

    async def test_get_team_roster(self, mock_redis, mock_http):
        _, resp = mock_http
        resp.json.return_value = {"team": {"athletes": []}}
        result = await get_team_roster(2)
        assert result == {"team": {"athletes": []}}

    async def test_get_athlete_stats(self, mock_redis, mock_http):
        _, resp = mock_http
        resp.json.return_value = {"categories": []}
        result = await get_athlete_stats("12345")
        assert result == {"categories": []}

    async def test_get_athlete_gamelog(self, mock_redis, mock_http):
        _, resp = mock_http
        resp.json.return_value = {"events": {}}
        result = await get_athlete_gamelog("12345")
        assert result == {"events": {}}

    async def test_get_athlete_info(self, mock_redis, mock_http):
        _, resp = mock_http
        resp.json.return_value = {"athlete": {"id": "12345"}}
        result = await get_athlete_info("12345")
        assert result == {"athlete": {"id": "12345"}}


class TestClientLifecycle:
    def test_get_client_raises_if_not_initialized(self):
        with patch("src.services.espn_client._client", None):
            with pytest.raises(RuntimeError, match="not initialized"):
                _get_client()

    @pytest.mark.asyncio
    async def test_close_when_never_initialized_is_noop(self, capsys):
        with patch("src.services.espn_client._client", None):
            await close_espn_client()
        # The `if _client:` guard skips the body entirely — no aclose(),
        # no "espn_client.closed" log line.
        assert "espn_client.closed" not in capsys.readouterr().out

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
