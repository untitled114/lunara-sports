"""Tests for the async circuit breaker."""

import time
from unittest.mock import patch

import pytest

from src.resilience.circuit_breaker import CircuitBreaker, CircuitOpenError, CircuitState


@pytest.fixture
def cb():
    return CircuitBreaker(failure_threshold=3, recovery_timeout=1.0, success_threshold=2)


async def _succeed():
    return "ok"


async def _fail():
    raise RuntimeError("boom")


class TestCircuitBreakerStateTransitions:
    """Test CLOSED → OPEN → HALF_OPEN → CLOSED transitions."""

    @pytest.mark.asyncio
    async def test_starts_closed(self, cb):
        assert cb.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_stays_closed_on_success(self, cb):
        await cb.call(_succeed())
        assert cb.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_opens_after_failure_threshold(self, cb):
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await cb.call(_fail())
        assert cb.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_raises_circuit_open_error_when_open(self, cb):
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await cb.call(_fail())

        with pytest.raises(CircuitOpenError):
            await cb.call(_succeed())

    @pytest.mark.asyncio
    async def test_transitions_to_half_open_after_timeout(self, cb):
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await cb.call(_fail())
        assert cb.state == CircuitState.OPEN

        # Fast-forward time past recovery_timeout
        with patch("src.resilience.circuit_breaker.time") as mock_time:
            # First call to monotonic() when checking state
            mock_time.monotonic.return_value = time.monotonic() + 2.0
            assert cb.state == CircuitState.HALF_OPEN

    @pytest.mark.asyncio
    async def test_half_open_to_closed_after_success_threshold(self, cb):
        # Open the circuit
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await cb.call(_fail())

        # Advance past recovery timeout
        cb._opened_at = time.monotonic() - 2.0

        assert cb.state == CircuitState.HALF_OPEN

        # Two successes should close it
        await cb.call(_succeed())
        assert cb.state == CircuitState.HALF_OPEN  # not yet
        await cb.call(_succeed())
        assert cb.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_half_open_to_open_on_failure(self, cb):
        # Open the circuit
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await cb.call(_fail())

        # Advance past recovery timeout
        cb._opened_at = time.monotonic() - 2.0
        assert cb.state == CircuitState.HALF_OPEN

        # A single failure in HALF_OPEN re-opens
        with pytest.raises(RuntimeError):
            await cb.call(_fail())
        assert cb.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_failure_count_resets_on_success(self, cb):
        """Two failures then a success should reset the counter."""
        for _ in range(2):
            with pytest.raises(RuntimeError):
                await cb.call(_fail())

        await cb.call(_succeed())
        assert cb.state == CircuitState.CLOSED

        # Need 3 more failures to open, not 1
        with pytest.raises(RuntimeError):
            await cb.call(_fail())
        assert cb.state == CircuitState.CLOSED
