"""Nightly OLAP export poller.

Runs once at startup (exports yesterday to catch late-finishing games),
then sleeps until midnight ET and exports the previous day every 24 hours.

Skipped entirely if GCS_OLAP_BUCKET is not configured.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

import structlog

from ..config import Settings
from ..db.session import get_session_factory
from .olap_exporter import export_picks_for_date

logger = structlog.get_logger(__name__)


def _seconds_until_midnight_et() -> float:
    """Seconds until next midnight Eastern Time."""
    utc_now = datetime.now(timezone.utc)
    et_now = utc_now - timedelta(hours=5)
    midnight = (et_now + timedelta(days=1)).replace(hour=0, minute=5, second=0, microsecond=0)
    return max((midnight - et_now).total_seconds(), 60)


async def _export_date(bucket: str, export_date: date) -> None:
    factory = get_session_factory()
    if factory is None:
        return
    async with factory() as session:
        try:
            count = await export_picks_for_date(session, export_date, bucket)
            if count:
                logger.info("olap_poller.exported", date=export_date.isoformat(), rows=count)
        except Exception:
            logger.exception("olap_poller.export_error", date=export_date.isoformat())


async def run_olap_poller(settings: Settings | None = None) -> None:
    """Run the nightly OLAP export poller loop."""
    bucket = settings.gcs_olap_bucket if settings else ""
    if not bucket:
        logger.info("olap_poller.skipped", reason="GCS_OLAP_BUCKET not configured")
        return

    logger.info("olap_poller.started", bucket=bucket)

    # Startup catchup: export yesterday + today (in case games finished overnight)
    utc_now = datetime.now(timezone.utc)
    et_today = (utc_now - timedelta(hours=5)).date()
    for catchup_date in [et_today - timedelta(days=1), et_today]:
        await _export_date(bucket, catchup_date)

    # Nightly loop: export previous day just after midnight ET
    while True:
        sleep_secs = _seconds_until_midnight_et()
        logger.info("olap_poller.sleeping", hours=round(sleep_secs / 3600, 1))
        await asyncio.sleep(sleep_secs)

        yesterday = (datetime.now(timezone.utc) - timedelta(hours=5)).date() - timedelta(days=1)
        await _export_date(bucket, yesterday)
