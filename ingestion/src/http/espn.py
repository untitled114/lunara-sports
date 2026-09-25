"""ESPN HTTP: direct first, IPRoyal proxy as fallback (never a browser UA)."""

from __future__ import annotations

import time
from collections.abc import Callable

import httpx
import structlog

logger = structlog.get_logger(__name__)

BLOCK_STATUSES = frozenset({403, 429})


class EspnHttp:
    def __init__(
        self,
        proxy_url: str = "",
        *,
        trigger_failures: int = 3,
        cooldown_seconds: float = 300.0,
        timeout: float = 10.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._direct = httpx.AsyncClient(timeout=timeout)
        self._proxied = httpx.AsyncClient(timeout=timeout, proxy=proxy_url) if proxy_url else None
        self._trigger = trigger_failures
        self._cooldown = cooldown_seconds
        self._clock = clock
        self._blocks = 0
        self._proxy_until = 0.0

    @property
    def via_proxy(self) -> bool:
        return self._proxied is not None and self._clock() < self._proxy_until

    async def get(self, url: str, params: dict | None = None) -> httpx.Response:
        if self.via_proxy:
            return await self._proxied.get(url, params=params)
        try:
            resp = await self._direct.get(url, params=params)
        except httpx.TransportError:
            if self._proxied is None:
                raise
            self._note_block("transport_error")
            return await self._proxied.get(url, params=params)
        if resp.status_code in BLOCK_STATUSES and self._proxied is not None:
            self._note_block(str(resp.status_code))
            return await self._proxied.get(url, params=params)
        if resp.status_code not in BLOCK_STATUSES:
            self._blocks = 0
        return resp

    def _note_block(self, reason: str) -> None:
        self._blocks += 1
        logger.warning("espn.direct_blocked", reason=reason, consecutive=self._blocks)
        if self._blocks >= self._trigger:
            self._proxy_until = self._clock() + self._cooldown
            self._blocks = 0
            logger.warning("espn.proxy_engaged", cooldown_s=self._cooldown)

    async def aclose(self) -> None:
        await self._direct.aclose()
        if self._proxied is not None:
            await self._proxied.aclose()
