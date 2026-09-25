"""Stat leaders follow the same season decision as the standings fallback.

Real captures only (tests/fixtures):
- espn_standings_2027_preseason.json / espn_standings_2026.json: ESPN's current
  (2026-27, no regular-season games yet) and 2025-26 final standings, the fixtures the
  standings fallback tests use.
- espn_leaders_2026_types2_limit1.json: ESPN's unedited response body (plus the
  end-of-file hook's trailing newline) to GET https://sports.core.api.espn.com/v2/
  sports/basketball/leagues/nba/seasons/2026/types/2/leaders?limit=1, captured
  2026-09-25 19:17 UTC. ESPN season 2026 is 2025-26; types/2 is the regular season.
- espn_leaders_2025_types2_limit1.json: the same request for season 2025 (2024-25),
  captured the same day.
- The current season's leaders (season 2027) answered HTTP 404 {"error": {"message":
  "No stats found."}} on 2026-09-25; espn_client turns a failed request into None.
"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.services import standings_service, stats_service
from src.services.stats_service import _leaders_season_label, get_stat_leaders

FIX = Path(__file__).parent / "fixtures"
PRE = json.loads((FIX / "espn_standings_2027_preseason.json").read_text())
PREV = json.loads((FIX / "espn_standings_2026.json").read_text())
LEADERS_2026 = json.loads((FIX / "espn_leaders_2026_types2_limit1.json").read_text())
LEADERS_2025 = json.loads((FIX / "espn_leaders_2025_types2_limit1.json").read_text())


def _standings(season=None):
    return PREV if season == 2026 else PRE


def _athlete_id(category: str, payload: dict) -> tuple[str, str]:
    cat = next(c for c in payload["categories"] if c["name"] == category)
    top = cat["leaders"][0]
    return top["athlete"]["$ref"].split("/athletes/")[1].split("?")[0], top["displayValue"]


@pytest.fixture
def no_name_lookups():
    """Name/team resolution hits ESPN rosters; it is not under test here."""
    with (
        patch.object(stats_service, "_build_athlete_lookup", AsyncMock(return_value={})),
        patch.object(stats_service, "_resolve_athlete", AsyncMock(return_value={})),
    ):
        yield


@pytest.mark.asyncio
async def test_preseason_leaders_are_last_regular_season(no_name_lookups):
    leaders = AsyncMock(return_value=LEADERS_2026)
    with (
        patch.object(
            standings_service.espn_client, "get_standings", AsyncMock(side_effect=_standings)
        ),
        patch.object(stats_service.espn_client, "get_stat_leaders", leaders),
    ):
        r = await get_stat_leaders(limit=1)
    leaders.assert_awaited_once_with(season=2026, limit=1)
    assert r.season_label == "2025–26 regular season"
    assert r.is_previous_season is True
    pid, value = _athlete_id("pointsPerGame", LEADERS_2026)
    assert (r.categories["pts"][0].player_id, r.categories["pts"][0].value) == (pid, value)
    assert r.categories["pts"][0].headshot_url.endswith(f"/players/full/{pid}.png")
    # Categories the page shows all come through from the real payload.
    assert {"pts", "ast", "reb", "stl", "blk", "threes"} <= set(r.categories)


@pytest.mark.asyncio
async def test_leaders_and_standings_make_the_same_season_decision(no_name_lookups):
    get = AsyncMock(side_effect=_standings)
    leaders = AsyncMock(return_value=LEADERS_2026)
    with (
        patch.object(standings_service.espn_client, "get_standings", get),
        patch.object(stats_service.espn_client, "get_stat_leaders", leaders),
    ):
        standings = await standings_service.get_standings()
        r = await get_stat_leaders(limit=1)
    assert standings.is_previous_season is r.is_previous_season is True
    assert standings.season_label.replace(" final", "") == r.season_label.replace(
        " regular season", ""
    )


@pytest.mark.asyncio
async def test_current_season_once_it_has_games(no_name_lookups):
    """Once a regular-season game is played the current season (ESPN 2027) is asked for.
    Its leaders were a real 404 at capture time, which the client returns as None."""
    current = standings_service.SeasonChoice(2027, "2026-27", False)
    leaders = AsyncMock(return_value=None)
    with (
        patch.object(stats_service, "choose_regular_season", AsyncMock(return_value=current)),
        patch.object(stats_service.espn_client, "get_stat_leaders", leaders),
    ):
        r = await get_stat_leaders(limit=5)
    leaders.assert_awaited_once_with(season=2027, limit=5)
    assert r.categories == {} and r.season_label == "" and r.is_previous_season is False


@pytest.mark.asyncio
async def test_no_standings_no_leaders():
    leaders = AsyncMock()
    with (
        patch.object(standings_service.espn_client, "get_standings", AsyncMock(return_value=None)),
        patch.object(stats_service.espn_client, "get_stat_leaders", leaders),
    ):
        r = await get_stat_leaders()
    leaders.assert_not_awaited()
    assert r.categories == {} and r.season_label == ""


@pytest.mark.asyncio
async def test_espn_error_gives_empty_leaders():
    with patch.object(
        stats_service, "choose_regular_season", AsyncMock(side_effect=Exception("ESPN down"))
    ):
        r = await get_stat_leaders()
    assert r.categories == {} and r.is_previous_season is False


@pytest.mark.asyncio
async def test_payload_gaps_are_skipped_not_invented(no_name_lookups):
    """The real 2026 payload with structure removed, never values changed: the points
    leader's athlete link is dropped and the rebounds list emptied."""
    d = json.loads(json.dumps(LEADERS_2026))
    for c in d["categories"]:
        if c["name"] == "pointsPerGame":
            c["leaders"][0]["athlete"] = {}
        if c["name"] == "reboundsPerGame":
            c["leaders"] = []
    current = standings_service.SeasonChoice(2026, "2025-26", True)
    with (
        patch.object(stats_service, "choose_regular_season", AsyncMock(return_value=current)),
        patch.object(stats_service.espn_client, "get_stat_leaders", AsyncMock(return_value=d)),
    ):
        r = await get_stat_leaders(limit=1)
    assert r.categories["pts"][0].player_id == "" and r.categories["pts"][0].headshot_url == ""
    assert "reb" not in r.categories


def test_label_rules():
    assert _leaders_season_label(LEADERS_2026["$ref"]) == "2025–26 regular season"
    assert _leaders_season_label(LEADERS_2025["$ref"]) == "2024–25 regular season"
    assert _leaders_season_label(".../seasons/2026/types/3/leaders") == "2025–26 postseason"
    assert _leaders_season_label(".../seasons/2010/types/9/leaders") == "2009–10"
    assert _leaders_season_label("") == ""
    assert _leaders_season_label(None) == ""
