"""Background poller that syncs Sport-suite picks once per day.

Runs every 5 minutes, checks if today's picks have been synced already,
and triggers sync if not.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

import structlog

from ..config import Settings
from ..db.session import get_session_factory
from .pick_sync_service import sync_picks

logger = structlog.get_logger(__name__)

POLL_INTERVAL = 300  # 5 minutes


def _eastern_today() -> date:
    """Return today's date in US Eastern time (timezone.utc-5)."""
    utc_now = datetime.now(timezone.utc)
    et_now = utc_now - timedelta(hours=5)
    return et_now.date()


async def run_pick_sync_poller(settings: Settings) -> None:
    """Run the pick sync poller loop indefinitely."""
    api_url = settings.sport_suite_api_url
    predictions_dir = settings.sport_suite_predictions_dir

    if not api_url and not predictions_dir:
        logger.info("pick_sync_poller.disabled", reason="no sport_suite_api_url or predictions_dir")
        return

    source = f"api:{api_url}" if api_url else f"file:{predictions_dir}"
    logger.info("pick_sync_poller.started", interval=POLL_INTERVAL, source=source)
    last_synced_date: date | None = None

    while True:
        try:
            today = _eastern_today()
            if last_synced_date == today:
                await asyncio.sleep(POLL_INTERVAL)
                continue

            factory = get_session_factory()
            if factory is None:
                await asyncio.sleep(POLL_INTERVAL)
                continue

            async with factory() as session:
                count = await sync_picks(
                    session,
                    predictions_dir,
                    today,
                    api_url=api_url,
                    api_key=settings.sport_suite_api_key,
                )

            if count > 0:
                last_synced_date = today
                logger.info("pick_sync_poller.synced", date=today.isoformat(), picks=count)
            else:
                logger.debug("pick_sync_poller.no_picks", date=today.isoformat())

        except Exception:
            logger.exception("pick_sync_poller.error")

        await asyncio.sleep(POLL_INTERVAL)
