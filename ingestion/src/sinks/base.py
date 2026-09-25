"""Event sink protocol — where collectors hand off parsed ESPN events."""

from __future__ import annotations

from typing import Protocol


class EventSink(Protocol):
    def produce(self, topic: str, key: str, value: dict) -> None: ...  # pragma: no cover

    async def flush(self) -> None: ...  # pragma: no cover

    async def close(self) -> None: ...  # pragma: no cover
