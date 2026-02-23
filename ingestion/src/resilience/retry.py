"""Retry decorator for ESPN HTTP calls using tenacity."""

from __future__ import annotations

import httpx
import structlog
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

logger = structlog.get_logger(__name__)


def _is_retryable(exc: BaseException) -> bool:
    """Return True for transient HTTP errors worth retrying."""
    if isinstance(exc, httpx.RequestError):
        return True
    return isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code >= 500


def _log_retry(state: RetryCallState) -> None:
    """Log each retry attempt before sleeping."""
    exc = state.outcome.exception() if state.outcome else None
    logger.warning(
        "espn.retrying",
        attempt=state.attempt_number,
        wait=f"{state.next_action.sleep:.1f}s" if state.next_action else "?",
        error=str(exc) if exc else "unknown",
    )


espn_retry = retry(
    retry=retry_if_exception(_is_retryable),
    wait=wait_exponential(multiplier=1, min=1, max=30),
    stop=stop_after_attempt(5),
    before_sleep=_log_retry,
    reraise=True,
)
