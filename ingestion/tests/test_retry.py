"""Tests for the ESPN retry decorator."""

from unittest.mock import AsyncMock

import httpx
import pytest

from src.resilience.retry import espn_retry


class TestEspnRetry:
    """Verify retry behavior on transient errors."""

    @pytest.mark.asyncio
    async def test_retries_on_request_error(self):
        mock_fn = AsyncMock(
            side_effect=[httpx.ConnectError("conn refused"), httpx.ConnectError("timeout"), "ok"]
        )

        @espn_retry
        async def fn():
            return await mock_fn()

        result = await fn()
        assert result == "ok"
        assert mock_fn.call_count == 3

    @pytest.mark.asyncio
    async def test_retries_on_500(self):
        resp_500 = httpx.Response(500, request=httpx.Request("GET", "http://test"))
        mock_fn = AsyncMock(
            side_effect=[
                httpx.HTTPStatusError("500", request=resp_500.request, response=resp_500),
                "ok",
            ]
        )

        @espn_retry
        async def fn():
            return await mock_fn()

        result = await fn()
        assert result == "ok"
        assert mock_fn.call_count == 2

    @pytest.mark.asyncio
    async def test_does_not_retry_on_4xx(self):
        resp_404 = httpx.Response(404, request=httpx.Request("GET", "http://test"))
        error = httpx.HTTPStatusError("404", request=resp_404.request, response=resp_404)
        mock_fn = AsyncMock(side_effect=error)

        @espn_retry
        async def fn():
            return await mock_fn()

        with pytest.raises(httpx.HTTPStatusError):
            await fn()
        assert mock_fn.call_count == 1

    @pytest.mark.asyncio
    async def test_gives_up_after_max_attempts(self):
        mock_fn = AsyncMock(side_effect=httpx.ConnectError("refused"))

        @espn_retry
        async def fn():
            return await mock_fn()

        with pytest.raises(httpx.ConnectError):
            await fn()
        assert mock_fn.call_count == 5  # stop_after_attempt(5)

    @pytest.mark.asyncio
    async def test_does_not_retry_on_non_http_error(self):
        mock_fn = AsyncMock(side_effect=ValueError("bad"))

        @espn_retry
        async def fn():
            return await mock_fn()

        with pytest.raises(ValueError):
            await fn()
        assert mock_fn.call_count == 1


# --- Final fix wave #4: play-by-play retries once, quickly (the next 1 s PBP
# cycle is the real retry); the scoreboard keeps the 5-attempt policy. ---


@pytest.mark.asyncio
async def test_pbp_policy_retries_at_most_once_with_a_short_wait():
    import time

    from src.resilience.retry import PBP_RETRY_WAIT, espn_retry_pbp

    mock_fn = AsyncMock(side_effect=httpx.ConnectError("refused"))

    @espn_retry_pbp
    async def fn():
        return await mock_fn()

    start = time.monotonic()
    with pytest.raises(httpx.ConnectError):
        await fn()
    assert mock_fn.call_count == 2
    assert PBP_RETRY_WAIT <= 0.5
    assert time.monotonic() - start < 1.0


@pytest.mark.asyncio
async def test_playbyplay_fetch_uses_the_pbp_policy_and_scoreboard_keeps_its_own():
    from unittest.mock import MagicMock

    from src.collectors.playbyplay import PlayByPlayCollector

    settings = MagicMock()
    settings.espn_base_url = "https://espn.test"
    http = AsyncMock()
    http.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
    collector = PlayByPlayCollector(settings, MagicMock(), game_id="g1", http=http)

    with pytest.raises(httpx.ConnectError):
        await collector._fetch()
    assert http.get.await_count == 2  # one try + one retry, never 5

    from src.collectors.scoreboard import ScoreboardCollector

    assert ScoreboardCollector._fetch.retry.stop.max_attempt_number == 5
