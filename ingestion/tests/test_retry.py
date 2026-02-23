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
