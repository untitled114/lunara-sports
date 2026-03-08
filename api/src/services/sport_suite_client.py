"""Client for posting pick results back to Sport-Suite.

Non-blocking, best-effort — failure never affects Lunara's operation.
"""

from __future__ import annotations

import httpx
import structlog

logger = structlog.get_logger(__name__)


async def post_pick_result(
    api_url: str,
    api_key: str,
    sport_suite_id: str,
    actual_value: float,
    is_hit: bool,
) -> bool:
    """POST finalized pick result to Sport-Suite.

    Returns True on success, False on any failure (always non-blocking).
    Called via asyncio.create_task — never awaited directly in hot path.
    """
    url = f"{api_url.rstrip('/')}/picks/{sport_suite_id}/result"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                url,
                json={"actual_value": actual_value, "is_hit": is_hit, "source": "lunara"},
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=5.0,
            )
            if resp.status_code == 200:
                logger.info(
                    "sport_suite_client.result_posted",
                    sport_suite_id=sport_suite_id,
                    is_hit=is_hit,
                )
                return True
            logger.warning(
                "sport_suite_client.post_failed",
                status=resp.status_code,
                sport_suite_id=sport_suite_id,
            )
            return False
    except Exception:
        logger.warning(
            "sport_suite_client.post_error",
            sport_suite_id=sport_suite_id,
            actual_value=actual_value,
        )
        return False
