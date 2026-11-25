"""ESPN HTTP client: one plain httpx client, with httpx's own default headers."""

from __future__ import annotations

import httpx


class EspnHttp:
    """One shared async client for every ESPN request the service makes."""

    def __init__(self, *, timeout: float = 10.0) -> None:
        self._direct = httpx.AsyncClient(timeout=timeout)

    async def get(self, url: str, params: dict | None = None) -> httpx.Response:
        return await self._direct.get(url, params=params)

    async def aclose(self) -> None:
        await self._direct.aclose()
