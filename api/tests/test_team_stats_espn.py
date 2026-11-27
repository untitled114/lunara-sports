"""Team statistics from ESPN's statistics/byteam payload (GET /stats/teams).

Fixtures, both recorded 2026-11-25 (see tests/fixtures/README.md):
- espn_team_stats_2027_20261125.json: every team's per-game numbers, 2026-27 regular season.
- espn_standings_2027_20261125.json: the standings at the same time (for the W-L column).
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.services import standings_service, stats_service
from src.services.stats_service import _team_stat_rows, get_team_stats_list
from src.services.team_mapping import ESPN_TEAM_IDS

FIX = Path(__file__).parent / "fixtures"
TEAM_STATS = json.loads((FIX / "espn_team_stats_2027_20261125.json").read_text())
STANDINGS = json.loads((FIX / "espn_standings_2027_20261125.json").read_text())


def _raw(abbrev_espn: str) -> dict[str, list[float]]:
    """The team's raw category values, by category name, in the payload's order."""
    entry = next(t for t in TEAM_STATS["teams"] if t["team"]["abbreviation"] == abbrev_espn)
    out: dict[str, list[list[float]]] = {}
    for category in entry["categories"]:
        out.setdefault(category["name"], []).append(category["values"])
    return out


def test_every_team_once_ranked_by_point_differential():
    rows = _team_stat_rows(TEAM_STATS, {})
    assert len(rows) == 30
    assert {r.abbrev for r in rows} == set(ESPN_TEAM_IDS)
    assert [r.rank for r in rows] == list(range(1, 31))
    diffs = [float(r.diff) for r in rows]
    assert diffs == sorted(diffs, reverse=True)


def test_points_for_and_against_agree_with_espns_totals_and_differential():
    names = {c["name"]: c["names"] for c in TEAM_STATS["categories"] if c.get("names")}
    i_games = names["general"].index("gamesPlayed")
    i_points = names["offensive"].index("points")
    for row in _team_stat_rows(TEAM_STATS, {}):
        espn_abbrev = "UTAH" if row.abbrev == "UTA" else row.abbrev
        raw = _raw(espn_abbrev)
        games = raw["general"][0][i_games]
        own_points, opp_points = raw["offensive"][0][i_points], raw["offensive"][1][i_points]
        assert row.games == int(games)
        assert row.ppg == f"{own_points / games:.1f}"
        assert row.opp_ppg == f"{opp_points / games:.1f}"
        assert abs(float(row.ppg) - float(row.opp_ppg) - float(row.diff)) <= 0.15


def test_shooting_and_per_game_columns_are_espns_own_figures():
    spurs = next(r for r in _team_stat_rows(TEAM_STATS, {}) if r.abbrev == "SA")
    names = {c["name"]: c["names"] for c in TEAM_STATS["categories"] if c.get("names")}
    raw = _raw("SA")
    off = dict(zip(names["offensive"], raw["offensive"][0], strict=False))
    assert spurs.fg_pct == f"{off['fieldGoalPct']:.1f}"
    assert spurs.three_pct == f"{off['threePointFieldGoalPct']:.1f}"
    assert spurs.apg == f"{off['avgAssists']:.1f}"
    assert all(v for v in (spurs.rpg, spurs.spg, spurs.bpg, spurs.tov, spurs.ft_pct))


async def test_the_list_uses_the_standings_season_and_their_records():
    eastern, western = standings_service._parse(STANDINGS)
    choice = standings_service.SeasonChoice(
        year=2027, years="2026-27", is_previous=False, eastern=eastern, western=western
    )
    with (
        patch.object(stats_service, "choose_regular_season", AsyncMock(return_value=choice)),
        patch.object(
            stats_service.espn_client, "get_team_stats", AsyncMock(return_value=TEAM_STATS)
        ) as get,
    ):
        rows = await get_team_stats_list()
    get.assert_awaited_once_with(2027)
    standing = {t.abbrev: t for t in [*eastern, *western]}
    for row in rows:
        assert row.record == f"{standing[row.abbrev].w}-{standing[row.abbrev].l}"


@pytest.mark.parametrize(
    ("choice", "payload", "error"),
    [
        (None, TEAM_STATS, None),
        ("no-year", TEAM_STATS, None),
        ("ok", None, None),
        ("ok", TEAM_STATS, RuntimeError("espn down")),
    ],
)
async def test_no_rows_when_espn_has_nothing(choice, payload, error):
    eastern, western = standings_service._parse(STANDINGS)
    choices = {
        None: None,
        "no-year": standings_service.SeasonChoice(year=None, years="", is_previous=False),
        "ok": standings_service.SeasonChoice(
            year=2027, years="2026-27", is_previous=False, eastern=eastern, western=western
        ),
    }
    get = AsyncMock(side_effect=error) if error else AsyncMock(return_value=payload)
    with (
        patch.object(
            stats_service, "choose_regular_season", AsyncMock(return_value=choices[choice])
        ),
        patch.object(stats_service.espn_client, "get_team_stats", get),
    ):
        assert await get_team_stats_list() == []
