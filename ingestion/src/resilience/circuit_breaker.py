"""Async circuit breaker for protecting ESPN HTTP calls."""

from __future__ import annotations

import time
from enum import Enum

import structlog

logger = structlog.get_logger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(Exception):
    """Raised when a call is attempted while the circuit is OPEN."""


class CircuitBreaker:
    """Async circuit breaker with configurable thresholds.

    Parameters:
        failure_threshold: Consecutive failures before opening the circuit.
        recovery_timeout: Seconds to wait in OPEN before transitioning to HALF_OPEN.
        success_threshold: Consecutive successes in HALF_OPEN to close the circuit.
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        success_threshold: int = 2,
    ) -> None:
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._opened_at: float = 0.0

    @property
    def state(self) -> CircuitState:
        """Current circuit state, transitioning OPEN → HALF_OPEN after timeout."""
        if (
            self._state == CircuitState.OPEN
            and time.monotonic() - self._opened_at >= self.recovery_timeout
        ):
            logger.info("circuit_breaker.half_open")
            self._state = CircuitState.HALF_OPEN
            self._success_count = 0
        return self._state

    async def call(self, coro):
        """Execute an awaitable through the circuit breaker.

        Args:
            coro: An awaitable (coroutine) to execute.

        Returns:
            The result of the awaitable.

        Raises:
            CircuitOpenError: If the circuit is currently OPEN.
        """
        current = self.state

        if current == CircuitState.OPEN:
            raise CircuitOpenError(
                f"Circuit is OPEN (opened {time.monotonic() - self._opened_at:.0f}s ago)"
            )

        try:
            result = await coro
        except Exception:
            self._on_failure()
            raise

        self._on_success()
        return result

    def _on_failure(self) -> None:
        self._failure_count += 1
        self._success_count = 0

        if self._state == CircuitState.HALF_OPEN or self._failure_count >= self.failure_threshold:
            self._open()

    def _on_success(self) -> None:
        if self._state == CircuitState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= self.success_threshold:
                logger.info("circuit_breaker.closed")
                self._state = CircuitState.CLOSED
                self._failure_count = 0
                self._success_count = 0
        else:
            self._failure_count = 0

    def _open(self) -> None:
        logger.warning(
            "circuit_breaker.opened",
            failures=self._failure_count,
        )
        self._state = CircuitState.OPEN
        self._opened_at = time.monotonic()
        self._failure_count = 0
        self._success_count = 0
