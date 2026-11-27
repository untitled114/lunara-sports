"""League leaders under the NBA's qualifying rules (ESPN's qualified lists), and the live
count of players with stats this season.

Fixtures, recorded 2026-11-26 (tests/fixtures/README.md), navigation links removed:
- espn_qualified_pts_20261126.json: ESPN statistics/byathlete, isqualified=true, sorted by
  points per game, top 25 (319 qualified). Anthony Edwards (4 games) is not in it.
- espn_qualified_threes_20261126.json: the same, sorted by threes made per game (325
  qualified); Edwards is, because that rule counts total threes made.
- espn_player_count_20261126.json: isqualified=false, limit 1: 481 players with stats.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.services import standings_service, stats_service
from src.services.stats_service import LEADER_SORTS, get_stat_leaders

FIX = Path(__file__).parent / "fixtures"
PTS = json.loads((FIX / "espn_qualified_pts_20261126.json").read_text())
THREES = json.loads((FIX / "espn_qualified_threes_20261126.json").read_text())
COUNT = json.loads((FIX / "espn_player_count_20261126.json").read_text())
EDWARDS = "4594268"
PRE = json.loads((FIX / "espn_standings_2027_preseason.json").read_text())
PREV = json.loads((FIX / "espn_standings_2026.json").read_text())
CURRENT = standings_service.SeasonChoice(year=2027, years="2026-27", is_previous=False)
PRESEASON = standings_service.SeasonChoice(year=2026, years="2025-26", is_previous=True)


def _by_sort(**payloads):
    def get(season, sort, limit):
        return payloads.get(sort)

    return AsyncMock(side_effect=get)


def _values(data: dict, sort: str) -> list[tuple[str, str]]:
    names = {c["name"]: c["names"] for c in data["categories"]}
    cat, stat = sort.split(".")
    out = []
    for row in data["athletes"]:
        vals = next(c["values"] for c in row["categories"] if c["name"] == cat)
        out.append((row["athlete"]["id"], f"{vals[names[cat].index(stat)]:.1f}"))
    return out


async def test_each_category_is_espns_qualified_list_in_order():
    leaders = _by_sort(**{LEADER_SORTS["pts"]: PTS, LEADER_SORTS["threes"]: THREES})
    with (
        patch.object(stats_service, "choose_regular_season", AsyncMock(return_value=CURRENT)),
        patch.object(stats_service.espn_client, "get_qualified_leaders", leaders),
        patch.object(stats_service.espn_client, "get_player_count", AsyncMock(return_value=481)),
    ):
        r = await get_stat_leaders(limit=25)
    for key, data in (("pts", PTS), ("threes", THREES)):
        got = [(x.player_id, x.value) for x in r.categories[key]]
        assert got == _values(data, LEADER_SORTS[key])
        assert [x.rank for x in r.categories[key]] == list(range(1, 26))
    assert EDWARDS not in {x.player_id for x in r.categories["pts"]}
    assert EDWARDS in {x.player_id for x in r.categories["threes"]}
    first = r.categories["pts"][0]
    assert first.player == PTS["athletes"][0]["athlete"]["displayName"]
    assert first.headshot_url.endswith(f"/players/full/{first.player_id}.png")
    assert r.season_label == "2026-27 regular season" and r.is_previous_season is False
    assert r.player_count == 481


async def test_the_player_count_reads_espns_total():
    with patch.object(stats_service.espn_client, "_cached_get", AsyncMock(return_value=COUNT)):
        assert await stats_service.espn_client.get_player_count(2027) == 481
    with patch.object(stats_service.espn_client, "_cached_get", AsyncMock(return_value=None)):
        assert await stats_service.espn_client.get_player_count(2027) is None


async def test_before_the_season_has_games_the_leaders_are_last_seasons():
    leaders = _by_sort(**{LEADER_SORTS["pts"]: PTS})
    with (
        patch.object(stats_service, "choose_regular_season", AsyncMock(return_value=PRESEASON)),
        patch.object(stats_service.espn_client, "get_qualified_leaders", leaders),
        patch.object(stats_service.espn_client, "get_player_count", AsyncMock(return_value=None)),
    ):
        r = await get_stat_leaders(limit=5)
    assert {c.args[0] if c.args else c.kwargs["season"] for c in leaders.await_args_list} == {2026}
    assert r.is_previous_season is True and r.player_count is None


async def test_a_new_season_without_leaders_yet_keeps_last_seasons():
    def get(season, sort, limit):
        return PTS if season == 2026 and sort == LEADER_SORTS["pts"] else None

    with (
        patch.object(stats_service, "choose_regular_season", AsyncMock(return_value=CURRENT)),
        patch.object(
            stats_service.espn_client, "get_qualified_leaders", AsyncMock(side_effect=get)
        ),
        patch.object(stats_service.espn_client, "get_player_count", AsyncMock(return_value=481)),
    ):
        r = await get_stat_leaders(limit=5)
    assert r.is_previous_season is True and len(r.categories["pts"]) == 5


@pytest.mark.parametrize(
    "choice", [None, standings_service.SeasonChoice(year=None, years="", is_previous=False)]
)
async def test_no_season_no_leaders(choice):
    leaders = AsyncMock()
    with (
        patch.object(stats_service, "choose_regular_season", AsyncMock(return_value=choice)),
        patch.object(stats_service.espn_client, "get_qualified_leaders", leaders),
    ):
        r = await get_stat_leaders()
    leaders.assert_not_awaited()
    assert r.categories == {} and r.season_label == "" and r.player_count is None


async def test_an_espn_error_gives_empty_leaders():
    with (
        patch.object(stats_service, "choose_regular_season", AsyncMock(return_value=CURRENT)),
        patch.object(
            stats_service.espn_client,
            "get_qualified_leaders",
            AsyncMock(side_effect=RuntimeError("down")),
        ),
    ):
        r = await get_stat_leaders()
    assert r.categories == {} and r.is_previous_season is False


async def test_leaders_and_standings_make_the_same_season_decision():
    """Real standings before 2026-27's first game: both fall back to 2025-26."""
    standings_payload = AsyncMock(side_effect=lambda season=None: PREV if season == 2026 else PRE)
    leaders = _by_sort(**{LEADER_SORTS["pts"]: PTS})
    with (
        patch.object(standings_service.espn_client, "get_standings", standings_payload),
        patch.object(stats_service.espn_client, "get_qualified_leaders", leaders),
        patch.object(stats_service.espn_client, "get_player_count", AsyncMock(return_value=None)),
    ):
        standings = await standings_service.get_standings()
        r = await get_stat_leaders(limit=1)
    assert standings.is_previous_season is r.is_previous_season is True
    assert {c.args[0] for c in leaders.await_args_list} == {2026}
