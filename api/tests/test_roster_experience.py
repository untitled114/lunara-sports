"""A roster's experience column comes from ESPN's roster endpoint.

Fixture: espn_roster_27_20261125.json, ESPN's /teams/27/roster (Washington Wizards) as
recorded 2026-11-25 (see tests/fixtures/README.md). The team endpoint the roster used to
come from (/teams/27?enable=roster) carries no experience at all, so every player showed
"R" (rookie), Deandre Ayton included.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

from src.services import team_service
from src.services.team_service import get_team_roster

FIXTURE = Path(__file__).parent / "fixtures" / "espn_roster_27_20261125.json"


async def test_experience_comes_from_espn_years():
    data = json.loads(FIXTURE.read_text())
    with patch.object(team_service.espn_client, "get_roster", AsyncMock(return_value=data)):
        roster = await get_team_roster("WSH")
    by_id = {a["id"]: a for a in data["athletes"]}
    assert len(roster) == len(data["athletes"])
    for p in roster:
        years = (by_id[p.id].get("experience") or {}).get("years")
        assert p.experience == ("-" if years is None else "R" if years == 0 else str(years))
    assert any(p.experience not in ("R", "-") for p in roster)


def test_missing_experience_is_unknown_not_rookie():
    assert team_service._experience({}) == "-"
    assert team_service._experience({"experience": {}}) == "-"
    assert team_service._experience({"experience": {"years": 0}}) == "R"
    assert team_service._experience({"experience": {"years": 9}}) == "9"


async def test_no_roster_from_espn_gives_an_empty_list():
    with patch.object(team_service.espn_client, "get_roster", AsyncMock(return_value=None)):
        assert await get_team_roster("WSH") == []
