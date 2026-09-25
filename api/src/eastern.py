"""The America/New_York calendar: every API "today" and game-day window (EST and EDT)."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")


def eastern_today() -> date:
    """Today's date in New York (NBA schedules are Eastern)."""
    return datetime.now(ET).date()


def eastern_day_window(day: date) -> tuple[datetime, datetime]:
    """[start, end] of an Eastern calendar day, as UTC instants."""
    start = datetime.combine(day, time.min, tzinfo=ET)
    end = datetime.combine(day, time.max, tzinfo=ET)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)
