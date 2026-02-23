"""Integration tests for retry and circuit breaker with real HTTP mocking.

These tests don't require Kafka — they test the ingestion resilience layer.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ingestion"))

from src.resilience.circuit_breaker import CircuitBreaker, CircuitOpenError  # noqa: E402
from src.resilience.retry import espn_retry  # noqa: E402


class TestRetryIntegration:
    """Test retry behavior with realistic HTTP error sequences."""

    @pytest.mark.asyncio
    async def test_espn_retry_on_500(self):
        """ESPN returns 500 twice then 200 → verify ingestion succeeds after retries."""
        call_count = 0

        @espn_retry
        async def fetch():
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                resp = httpx.Response(
                    500,
                    request=httpx.Request("GET", "http://espn.test/scoreboard"),
                )
                raise httpx.HTTPStatusError(
                    "Internal Server Error", request=resp.request, response=resp
                )
            return {"events": []}

        result = await fetch()
        assert result == {"events": []}
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_circuit_breaker_opens_after_failures(self):
        """ESPN returns 500 repeatedly → circuit opens → subsequent calls raise CircuitOpenError."""
        cb = CircuitBreaker(
            failure_threshold=3, recovery_timeout=60.0, success_threshold=2
        )

        async def failing_fetch():
            resp = httpx.Response(500, request=httpx.Request("GET", "http://espn.test"))
            raise httpx.HTTPStatusError("500", request=resp.request, response=resp)

        # Trip the circuit breaker
        for _ in range(3):
            with pytest.raises(httpx.HTTPStatusError):
                await cb.call(failing_fetch())

        # Circuit should be open now
        with pytest.raises(CircuitOpenError):
            await cb.call(failing_fetch())

    @pytest.mark.asyncio
    async def test_circuit_breaker_with_collector(self):
        """Test circuit breaker integration with the actual ScoreboardCollector."""
        from src.config import Settings

        settings = Settings(
            kafka_bootstrap_servers="localhost:29092",
            schema_registry_url="http://localhost:8081",
        )

        # Create a mock producer
        mock_producer = MagicMock()
        mock_producer.produce = MagicMock()
        mock_producer.flush = MagicMock()

        from src.collectors.scoreboard import ScoreboardCollector

        collector = ScoreboardCollector(settings, mock_producer)

        # Override the circuit breaker with a low threshold
        collector._circuit_breaker = CircuitBreaker(
            failure_threshold=2, recovery_timeout=60.0, success_threshold=1
        )

        # Make HTTP calls fail
        error_resp = httpx.Response(500, request=httpx.Request("GET", "http://test"))
        collector.client = AsyncMock()
        collector.client.get = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "500", request=error_resp.request, response=error_resp
            )
        )

        # First two polls should hit HTTP errors (retry exhaustion opens circuit)
        # but poll() catches the error and returns gracefully
        await collector.poll()
        await collector.poll()

        # Producer should not have been called (all polls failed)
        mock_producer.produce.assert_not_called()

        await collector.close()
