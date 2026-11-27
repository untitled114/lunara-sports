"""The Players directory table: every player with stats this season, sortable by
any column, 25 per page, searchable ("knicks 11"), with team, position and conference
filters and the games rule (70% of his team's games), on by default.

Fixtures (tests/fixtures/README.md), recorded 2026-11-26 the same afternoon, no games in
between: ESPN's all-players list (482 players), the Knicks roster (jersey numbers) and the
2026-27 standings (each team's games).
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.services import standings_service, stats_service
from src.services.stats_service import get_player_table
from src.services.team_mapping import from_espn_abbrev

FIX = Path(__file__).parent / "fixtures"
ALL = json.loads((FIX / "espn_all_players_20261126.json").read_text())
NY_ROSTER = json.loads((FIX / "espn_roster_18_20261126.json").read_text())
STANDINGS = json.loads((FIX / "espn_standings_2027_20261126.json").read_text())
EAST, WEST = standings_service._parse(STANDINGS)
CURRENT = standings_service.SeasonChoice(
    year=2027, years="2026-27", is_previous=False, eastern=EAST, western=WEST
)
TEAM_GAMES = {t.abbrev: t.w + t.l for t in EAST + WEST}


def _espn_rows():
    names = {c["name"]: c["names"] for c in ALL["categories"]}
    out = []
    for a in ALL["athletes"]:
        cats = {c["name"]: c["values"] for c in a["categories"]}
        g = dict(zip(names["general"], cats["general"], strict=True))
        o = dict(zip(names["offensive"], cats["offensive"], strict=True))
        ath = a["athlete"]
        out.append(
            {
                "id": ath["id"],
                # ESPN's code converted to Lunara's, as the standings use ("UTAH" is "UTA").
                "team": from_espn_abbrev(ath["teamShortName"]),
                "gp": int(g["gamesPlayed"]),
                "pts": o["avgPoints"],
                "reb": g["avgRebounds"],
            }
        )
    return out


def _qualified(rows):
    return [r for r in rows if TEAM_GAMES.get(r["team"]) and r["gp"] / TEAM_GAMES[r["team"]] >= 0.7]


@pytest.fixture
def espn():
    async def roster(espn_id):
        return NY_ROSTER if espn_id == 18 else None

    with (
        patch.object(stats_service, "choose_regular_season", AsyncMock(return_value=CURRENT)),
        patch.object(
            stats_service.espn_client, "get_all_player_stats", AsyncMock(return_value=ALL)
        ),
        patch.object(stats_service.espn_client, "get_roster", AsyncMock(side_effect=roster)),
    ):
        yield


async def test_default_is_points_high_to_low_under_the_games_rule_25_per_page(espn):
    r = await get_player_table()
    want = sorted(_qualified(_espn_rows()), key=lambda x: -x["pts"])
    assert r.total == len(want) < 482
    assert (r.page, r.per_page, r.sort, r.dir) == (1, 25, "pts", "desc")
    assert [x.player_id for x in r.rows] == [w["id"] for w in want[:25]]
    first = r.rows[0]
    assert (first.player, first.team, first.position, first.age) == ("Luka Doncic", "LAL", "G", 27)
    assert first.pts == f"{want[0]['pts']:.1f}" and first.gp == want[0]["gp"]
    assert r.season_label == "2026-27 regular season"


async def test_the_games_rule_off_shows_all_482(espn):
    r = await get_player_table(all_players=True)
    assert r.total == 482


async def test_any_column_sorts_and_the_order_flips(espn):
    by_reb = await get_player_table(sort="reb")
    want = sorted(_qualified(_espn_rows()), key=lambda x: -x["reb"])
    assert [x.player_id for x in by_reb.rows[:5]] == [w["id"] for w in want[:5]]
    low = await get_player_table(sort="reb", dir="asc")
    assert float(low.rows[0].reb) <= float(low.rows[-1].reb)


async def test_page_two_continues_the_list(espn):
    p1 = await get_player_table()
    p2 = await get_player_table(page=2)
    assert p2.page == 2 and p2.rows[0].player_id not in {x.player_id for x in p1.rows}
    want = sorted(_qualified(_espn_rows()), key=lambda x: -x["pts"])
    assert [x.player_id for x in p2.rows] == [w["id"] for w in want[25:50]]


async def test_search_by_team_and_number_finds_jalen_brunson(espn):
    r = await get_player_table(q="knicks 11")
    assert [(x.player, x.team, x.jersey) for x in r.rows] == [("Jalen Brunson", "NY", "11")]


async def test_search_by_name(espn):
    r = await get_player_table(q="wemban")
    assert [x.player for x in r.rows] == ["Victor Wembanyama"]


async def test_team_position_and_conference_filters(espn):
    ny = await get_player_table(team="NY", all_players=True)
    assert ny.rows and {x.team for x in ny.rows} == {"NY"}
    c = await get_player_table(position="C", all_players=True)
    assert c.rows and {x.position for x in c.rows} == {"C"}
    east = {t.abbrev for t in EAST}
    e = await get_player_table(conference="east", all_players=True)
    assert e.rows and {x.team for x in e.rows} <= east


async def test_unknown_sort_falls_back_to_points(espn):
    r = await get_player_table(sort="dunks")
    assert r.sort == "pts"


async def test_route(client, espn):
    resp = await client.get("/stats/players", params={"q": "knicks 11"})
    assert resp.status_code == 200
    assert resp.json()["rows"][0]["player"] == "Jalen Brunson"


async def test_sorting_by_name_and_by_age(espn):
    by_name = await get_player_table(sort="player", dir="asc")
    names = [x.player for x in by_name.rows]
    assert names == sorted(names)
    oldest = await get_player_table(sort="age")
    ages = [x.age for x in oldest.rows]
    assert ages == sorted(ages, reverse=True)
