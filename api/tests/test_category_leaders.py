"""One category's qualified leaders with filters (the Stats page's top 10).

Fixtures (tests/fixtures/README.md), recorded 2026-11-26, navigation links removed:
- espn_qualified_pts_20261126.json: ESPN statistics/byathlete, isqualified=true, by points
  per game, the first 25 of 319 qualified, each with position and games played.
- espn_standings_2027_preseason.json: ESPN's 2026-27 standings, which name each
  conference's teams.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.services import standings_service, stats_service
from src.services.stats_service import LEADER_SORTS, get_category_leaders

FIX = Path(__file__).parent / "fixtures"
PTS = json.loads((FIX / "espn_qualified_pts_20261126.json").read_text())
PRE = json.loads((FIX / "espn_standings_2027_preseason.json").read_text())
EAST, WEST = standings_service._parse(PRE)
CURRENT = standings_service.SeasonChoice(
    year=2027, years="2026-27", is_previous=False, eastern=EAST, western=WEST
)


def _athletes():
    names = {c["name"]: c["names"] for c in PTS["categories"]}
    gp, pts = names["general"].index("gamesPlayed"), names["offensive"].index("avgPoints")
    out = []
    for a in PTS["athletes"]:
        cats = {c["name"]: c["values"] for c in a["categories"]}
        ath = a["athlete"]
        out.append(
            (
                ath["id"],
                ath["teamShortName"],
                ath["position"]["abbreviation"],
                int(cats["general"][gp]),
                f"{cats['offensive'][pts]:.1f}",
            )
        )
    return out


@pytest.fixture
def espn():
    leaders = AsyncMock(return_value=PTS)
    with (
        patch.object(stats_service, "choose_regular_season", AsyncMock(return_value=CURRENT)),
        patch.object(stats_service.espn_client, "get_qualified_leaders", leaders),
    ):
        yield leaders


async def test_rows_carry_position_and_games_played(espn):
    r = await get_category_leaders("pts", limit=10)
    want = _athletes()[:10]
    assert [(x.player_id, x.team, x.position, x.gp, x.value) for x in r.rows] == want
    assert [x.rank for x in r.rows] == list(range(1, 11))
    assert (r.category, r.season_label, r.is_previous_season) == (
        "pts",
        "2026-27 regular season",
        False,
    )
    espn.assert_awaited_once_with(2027, LEADER_SORTS["pts"], 500)


async def test_qualified_is_espns_total_and_matching_counts_the_filter(espn):
    r = await get_category_leaders("pts")
    assert (r.qualified, r.matching) == (319, 319)
    ny = await get_category_leaders("pts", team="NY")
    want = [a for a in _athletes() if a[1] == "NY"]
    assert [x.player_id for x in ny.rows] == [a[0] for a in want]
    assert [x.rank for x in ny.rows] == list(range(1, len(want) + 1))
    assert (ny.qualified, ny.matching) == (319, len(want))


async def test_position_filter(espn):
    r = await get_category_leaders("pts", position="C")
    want = [a[0] for a in _athletes() if a[2] == "C"]
    assert want and [x.player_id for x in r.rows] == want


async def test_conference_filter_uses_the_seasons_standings(espn):
    east = {t.abbrev for t in EAST}
    r = await get_category_leaders("pts", conference="east")
    want = [a[0] for a in _athletes() if a[1] in east]
    assert len(want) > 10
    assert [x.player_id for x in r.rows] == want[:10]
    assert r.matching == len(want)
    w = await get_category_leaders("pts", conference="west")
    assert {x.team for x in w.rows}.isdisjoint(east)


async def test_unknown_category_is_none(espn):
    assert await get_category_leaders("dunks") is None


async def test_route_answers_404_for_an_unknown_category(client):
    with patch("src.routers.stats.get_category_leaders", AsyncMock(return_value=None)):
        resp = await client.get("/stats/leaders/dunks")
    assert resp.status_code == 404


async def test_route_passes_the_filters(client, espn):
    resp = await client.get("/stats/leaders/pts", params={"team": "NY", "limit": 10})
    assert resp.status_code == 200
    body = resp.json()
    assert body["category"] == "pts" and body["matching"] == len(
        [a for a in _athletes() if a[1] == "NY"]
    )
    assert all(r["team"] == "NY" for r in body["rows"])
