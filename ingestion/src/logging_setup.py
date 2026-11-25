"""Log-level filtering for structlog, read from LOG_LEVEL (default INFO)."""

from __future__ import annotations

import logging
import os

import structlog


def configure_logging() -> None:
    """Drop structlog calls below LOG_LEVEL; unknown values fall back to INFO."""
    name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = logging.getLevelName(name)
    if not isinstance(level, int):
        level = logging.INFO
    structlog.configure(wrapper_class=structlog.make_filtering_bound_logger(level))
