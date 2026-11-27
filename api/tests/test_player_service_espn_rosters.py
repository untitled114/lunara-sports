"""Players parse from ESPN's team rosters as ESPN serves them now: a headshot is a URL string.

Real case, 2026-11-10: GET /players?search=Deni+Avdija (and LeBron James, Paul George, Josh Hart,
...) answered 500 with AttributeError 'str' object has no attribute 'get'. ESPN's roster endpoint
(teams/{id}?enable=roster) now gives an athlete's headshot as a plain URL, and a few athletes
have none. The v3 athlete endpoint still gives an object
{"href", "alt"}. Some athletes come with fields missing: Charlotte's Latrell Wrightsell Jr. has
no weight, height, jersey, age or headshot. The team roster (/teams/{abbrev}/roster) reads the
same endpoint and broke the same way.

Fixtures: tests/fixtures/espn_roster_{POR_22,CLE_5,CHA_30}_20261110.json (ESPN's roster
responses for Portland, Cleveland and Charlotte, captured 2026-11-10 12:25 EST, with ESPN's
navigation links and ticket offers removed; Cleveland's Norchad Omier has no headshot).
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

from src.services.player_service import get_all_players, get_player_by_id
from src.services.team_service import get_team_roster

FIXTURES = Path(__file__).parent / "fixtures"
ROSTERS = {  # ESPN team id -> captured response
    22: json.loads((FIXTURES / "espn_roster_POR_22_20261110.json").read_text()),
    5: json.loads((FIXTURES / "espn_roster_CLE_5_20261110.json").read_text()),
    30: json.loads((FIXTURES / "espn_roster_CHA_30_20261110.json").read_text()),
}
AVDIJA_HEADSHOT = "https://a.espncdn.com/i/headshots/nba/players/full/4683021.png"


def _rosters():
    return patch(
        "src.services.espn_client.get_team_roster",
        AsyncMock(side_effect=lambda espn_id: ROSTERS.get(espn_id)),
    )


def _team_rosters():
    """The same captured athletes, listed the way ESPN's /teams/{id}/roster lists them
    (top-level ``athletes``), which is what the team roster reads."""
    return patch(
        "src.services.espn_client.get_roster",
        AsyncMock(
            side_effect=lambda espn_id: (
                {"athletes": ROSTERS[espn_id]["team"]["athletes"]} if espn_id in ROSTERS else None
            )
        ),
    )


async def test_search_finds_a_player_whose_headshot_is_a_url():
    with _rosters():
        result = await get_all_players(search="Deni Avdija")

    assert [t["abbrev"] for t in result] == ["POR"]
    (player,) = result[0]["players"]
    assert player["id"] == "4683021"
    assert player["name"] == "Deni Avdija"
    assert player["position"] == "F"
    assert player["jersey"] == "8"
    assert player["headshot_url"] == AVDIJA_HEADSHOT


async def test_every_athlete_parses_and_a_missing_headshot_is_empty():
    with _rosters():
        result = await get_all_players(search="")

    by_team = {t["abbrev"]: t for t in result}
    assert set(by_team) == {"POR", "CLE", "CHA"}
    with _rosters():
        omier = (await get_all_players(search="Norchad Omier"))[0]["players"][0]
    assert omier["headshot_url"] == ""
    assert all(p["headshot_url"].startswith("https://") for p in by_team["POR"]["players"])


async def test_player_by_id_falls_back_to_the_roster():
    with (
        _rosters(),
        patch(
            "src.services.espn_client.get_athlete_info",
            AsyncMock(return_value=None),
        ),
    ):
        player = await get_player_by_id("4683021")

    assert player["name"] == "Deni Avdija"
    assert player["team"] == "Portland Trail Blazers"
    assert player["team_abbrev"] == "POR"
    assert player["headshot_url"] == AVDIJA_HEADSHOT


async def test_an_athlete_with_missing_fields_parses_empty():
    with _rosters():
        (team,) = await get_all_players(search="Latrell Wrightsell")
    (player,) = team["players"]
    assert player["id"] == "5460427"
    assert (player["jersey"], player["height"], player["weight"], player["headshot_url"]) == (
        "",
        "",
        "",
        "",
    )


async def test_team_roster_parses_url_headshots_and_missing_fields():
    with _team_rosters():
        roster = await get_team_roster("CHA")

    assert len(roster) == len(ROSTERS[30]["team"]["athletes"])
    wrightsell = next(p for p in roster if p.id == "5460427")
    assert (wrightsell.jersey, wrightsell.weight, wrightsell.headshot_url) == ("", "", "")
    with _team_rosters():
        avdija = next(p for p in await get_team_roster("POR") if p.id == "4683021")
    assert avdija.headshot_url == AVDIJA_HEADSHOT
    assert avdija.jersey == "8"
