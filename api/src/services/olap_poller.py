"""Nightly OLAP export poller.

Runs once at startup (exports yesterday to catch late-finishing games),
then sleeps until midnight ET and exports the previous day every 24 hours.

Skipped entirely if OLAP_EXPORT_DIR is not configured.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta

import structlog

from ..config import Settings
from ..db.session import get_session_factory
from .olap_exporter import export_picks_for_date

logger = structlog.get_logger(__name__)


def _eastern_now() -> datetime:
    """Return the current time in US Eastern time (handles EST/EDT)."""
    from zoneinfo import ZoneInfo

    return datetime.now(ZoneInfo("America/New_York"))


def _seconds_until_midnight_et() -> float:
    """Seconds until next midnight Eastern Time."""
    et_now = _eastern_now()
    midnight = (et_now + timedelta(days=1)).replace(hour=0, minute=5, second=0, microsecond=0)
    return max((midnight - et_now).total_seconds(), 60)


async def _export_date(export_dir: str, export_date: date) -> None:
    factory = get_session_factory()
    if factory is None:
        return
    async with factory() as session:
        try:
            count = await export_picks_for_date(session, export_date, export_dir)
            if count:
                logger.info("olap_poller.exported", date=export_date.isoformat(), rows=count)
        except Exception:
            logger.exception("olap_poller.export_error", date=export_date.isoformat())


async def run_olap_poller(settings: Settings | None = None) -> None:
    """Run the nightly OLAP export poller loop."""
    export_dir = settings.olap_export_dir if settings else ""
    if not export_dir:
        logger.info("olap_poller.skipped", reason="OLAP_EXPORT_DIR not configured")
        return

    logger.info("olap_poller.started", export_dir=export_dir)

    # Startup catchup: export yesterday + today (in case games finished overnight)
    et_today = _eastern_now().date()
    for catchup_date in [et_today - timedelta(days=1), et_today]:
        await _export_date(export_dir, catchup_date)

    # Nightly loop: export previous day just after midnight ET
    while True:
        sleep_secs = _seconds_until_midnight_et()
        logger.info("olap_poller.sleeping", hours=round(sleep_secs / 3600, 1))
        await asyncio.sleep(sleep_secs)

        yesterday = _eastern_now().date() - timedelta(days=1)
        await _export_date(export_dir, yesterday)
