"""Standings fall back to the previous regular season until this one has games."""

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.services import standings_service

FIX = Path(__file__).parent / "fixtures"
PRE = json.loads((FIX / "espn_standings_2027_preseason.json").read_text())
PREV = json.loads((FIX / "espn_standings_2026.json").read_text())


def _with_one_game_played(data: dict) -> dict:
    """Real preseason payload with one team's regular-season record bumped to 1-0."""
    d = json.loads(json.dumps(data))
    entry = d["children"][0]["standings"]["entries"][0]
    for s in entry["stats"]:
        if s["name"] == "wins":
            s["value"], s["displayValue"] = 1.0, "1"
    return d


@pytest.mark.asyncio
async def test_preseason_falls_back_to_previous_regular_season():
    get = AsyncMock(side_effect=lambda season=None: PREV if season == 2026 else PRE)
    with patch.object(standings_service.espn_client, "get_standings", get):
        r = await standings_service.get_standings()
    assert r.is_previous_season is True
    assert r.season_label == "2025–26 final"
    assert get.await_args_list[-1].kwargs == {"season": 2026}
    assert sum(t.w + t.l for t in r.eastern) > 0


@pytest.mark.asyncio
async def test_uses_current_season_once_a_regular_season_game_is_played():
    cur = _with_one_game_played(PRE)
    get = AsyncMock(return_value=cur)
    with patch.object(standings_service.espn_client, "get_standings", get):
        r = await standings_service.get_standings()
    assert r.is_previous_season is False
    assert r.season_label == "2026–27"
    get.assert_awaited_once_with(season=None)


@pytest.mark.asyncio
async def test_seed_comes_from_espn_playoff_seed():
    get = AsyncMock(side_effect=lambda season=None: PREV if season == 2026 else PRE)
    with patch.object(standings_service.espn_client, "get_standings", get):
        r = await standings_service.get_standings()
    seeds = sorted(t.seed for t in r.eastern if t.seed is not None)
    assert seeds[:6] == [1, 2, 3, 4, 5, 6] and len(r.eastern) == 15


@pytest.mark.asyncio
async def test_previous_season_unavailable_returns_current_empty_records():
    get = AsyncMock(side_effect=lambda season=None: None if season == 2026 else PRE)
    with patch.object(standings_service.espn_client, "get_standings", get):
        r = await standings_service.get_standings()
    assert r.is_previous_season is False and r.season_label == "2026–27"


@pytest.mark.asyncio
async def test_missing_previous_season_metadata_returns_current_empty_records():
    """No seasons[1] entry at all (e.g. league's first tracked year) — previous season is
    unreachable, so this falls back to the same "current, empty" response as when ESPN's
    previous-season fetch itself comes back empty."""
    d = json.loads(json.dumps(PRE))
    d["seasons"] = [d["seasons"][0]]
    get = AsyncMock(return_value=d)
    with patch.object(standings_service.espn_client, "get_standings", get):
        r = await standings_service.get_standings()
    assert r.is_previous_season is False
    assert r.season_label == "2026–27"
    get.assert_awaited_once_with(season=None)


@pytest.mark.asyncio
async def test_espn_down_returns_empty():
    with patch.object(standings_service.espn_client, "get_standings", AsyncMock(return_value=None)):
        r = await standings_service.get_standings()
    assert r.eastern == [] and r.western == [] and r.is_previous_season is False


@pytest.mark.asyncio
async def test_standings_use_the_same_team_abbreviations_as_games():
    """Utah is 'UTAH' in ESPN's raw standings payload but games use 'UTA'
    (team_mapping.from_espn_abbrev) — standings must normalize the same way,
    or the frontend's standings lookup never matches Utah's games."""
    get = AsyncMock(side_effect=lambda season=None: PREV if season == 2026 else PRE)
    with patch.object(standings_service.espn_client, "get_standings", get):
        r = await standings_service.get_standings()
    all_abbrevs = {t.abbrev for t in r.eastern + r.western}
    assert "UTA" in all_abbrevs
    assert "UTAH" not in all_abbrevs


def test_standings_abbreviations_match_games_for_every_team():
    """No abbreviation ESPN's real standings payload uses should differ from what
    games use, once normalized — this compares the full 30-team set from the real
    fixtures against team_mapping's canonical (games) abbreviation set, rather than
    special-casing Utah alone, so a future ESPN format change elsewhere is caught."""
    from src.services.team_mapping import ESPN_TEAM_IDS, from_espn_abbrev

    raw = {
        entry["team"]["abbreviation"]
        for data in (PRE, PREV)
        for child in data.get("children", [])
        for entry in child.get("standings", {}).get("entries", [])
    }
    assert len(raw) == 30  # sanity: fixtures cover the whole league

    normalized = {from_espn_abbrev(a) for a in raw}
    games_abbrevs = set(ESPN_TEAM_IDS)

    mismatched = normalized - games_abbrevs
    missing = games_abbrevs - normalized
    assert not mismatched, f"standings abbreviations with no games match: {mismatched}"
    assert not missing, f"games abbreviations standings never produces: {missing}"
