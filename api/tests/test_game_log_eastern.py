"""A player's game log is dated in Eastern time, with his team's score first.

Fixture: espn_gamelog_4066328_20261126.json, ESPN's game log for Jarrett Allen recorded
2026-11-26 (see tests/fixtures/README.md). ESPN's gameDate is UTC, so an evening game
(CLE at NY, tip 2026-11-26 00:30 UTC) belongs to Wed Nov 25 in Eastern time; ESPN's score
is winner first ("121-102" for a Cleveland loss).
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

from src.services import stats_service
from src.services.stats_service import get_player_game_log

FIXTURE = Path(__file__).parent / "fixtures" / "espn_gamelog_4066328_20261126.json"
ET = ZoneInfo("America/New_York")


def _tip(meta: dict) -> datetime:
    return datetime.fromisoformat(meta["gameDate"].replace("Z", "+00:00")).astimezone(ET)


async def _log() -> tuple[list[dict], dict]:
    data = json.loads(FIXTURE.read_text())
    with patch.object(
        stats_service.espn_client, "get_athlete_gamelog", AsyncMock(return_value=data)
    ):
        return await get_player_game_log("4066328"), data["events"]


async def test_dates_are_the_eastern_day_of_the_tip():
    log, meta = await _log()
    assert log
    for g in log:
        assert g["date"] == _tip(meta[g["event_id"]]).date().isoformat()
    # The fixture's evening games prove the conversion matters.
    assert any(meta[g["event_id"]]["gameDate"][:10] != g["date"] for g in log)


async def test_the_score_puts_his_team_first():
    log, _ = await _log()
    for g in log:
        mine, theirs = (int(x) for x in g["score"].split("-"))
        assert (mine > theirs) == (g["result"] == "W"), g
    tonight = next(g for g in log if g["event_id"] == "401909319")
    assert (tonight["result"], tonight["score"]) == ("L", "102-121")


def test_values_that_do_not_parse_are_left_as_they_were():
    assert stats_service._eastern_date("") == ""
    assert stats_service._team_first("", "W") == ""
    assert stats_service._team_first("121-102", "") == "121-102"
