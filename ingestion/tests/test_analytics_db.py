"""The analytics views (migration 016) on a real game, as ingestion stores it.

CLE @ CHA, 2026-11-09 (401909953): the stored rows are reconciled with ESPN's final play list
(the pipeline's own path), then every view is checked against ESPN's numbers for the game:
the quarter line scores and team totals from ESPN's header, each player's points and both
teams' largest lead and lead changes from ESPN's box score. Ties and scoring runs have no ESPN
figure; they are checked against a plain Python pass over ESPN's raw play list.

Needs TEST_DATABASE_URL (see test_reconcile_db.py); skipped without it.
"""

from __future__ import annotations

import pytest

from src.sinks.postgres import PostgresSink

from .test_reconcile_db import (
    DSN,
    GAME_ID,
    _box_score_points,
    _espn_plays,
    _load,
    _seed_the_stored_night,
    conn,  # noqa: F401  (fixture)
)

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set"),
]
SUMMARY = "tests/fixtures/espn/espn_summary_401909953_core.json"


async def _reconciled(db) -> None:
    await _seed_the_stored_night(db)
    sink = PostgresSink(DSN)
    await sink.connect()
    try:
        await sink.reconcile(GAME_ID, _espn_plays())
    finally:
        await sink.close()


def _espn_team_stats() -> dict[str, dict[str, str]]:
    summary = _load(SUMMARY)
    return {
        t["team"]["abbreviation"]: {s["name"]: s["displayValue"] for s in t["statistics"]}
        for t in summary["boxscore"]["teams"]
    }


def _espn_line_scores() -> dict[str, list[int]]:
    competitors = _load(SUMMARY)["header"]["competitions"][0]["competitors"]
    return {c["homeAway"]: [int(q["displayValue"]) for q in c["linescores"]] for c in competitors}


def _reference_flow() -> dict:
    """Ties and runs from ESPN's raw play list, in ESPN's order, with no SQL involved."""
    summary = _load(SUMMARY)
    competitors = summary["header"]["competitions"][0]["competitors"]
    side_of = {c["team"]["id"]: c["homeAway"] for c in competitors}
    margin, ties, runs = 0, 0, []
    for play in summary["plays"]:
        if not play.get("scoringPlay"):
            continue
        side = side_of.get(play.get("team", {}).get("id"))
        before, margin = margin, play["homeScore"] - play["awayScore"]
        if margin == 0 and before != 0:
            ties += 1
        if runs and runs[-1][0] == side:
            runs[-1][1] += play["scoreValue"]
        else:
            runs.append([side, play["scoreValue"]])
    longest = max(runs, key=lambda r: r[1])
    return {"times_tied": ties, "runs": runs, "longest": tuple(longest)}


async def test_quarter_scoring_equals_espns_line_scores(conn):  # noqa: F811
    await _reconciled(conn)
    rows = await conn.fetch(
        "SELECT quarter, home_points, away_points FROM analytics.quarter_scoring"
        " WHERE game_id = $1 ORDER BY quarter",
        GAME_ID,
    )
    espn = _espn_line_scores()
    assert [r["home_points"] for r in rows] == espn["home"] == [29, 40, 38, 17]
    assert [r["away_points"] for r in rows] == espn["away"] == [28, 25, 27, 32]


async def test_player_points_equal_espns_box_score(conn):  # noqa: F811
    await _reconciled(conn)
    rows = await conn.fetch(
        "SELECT team, player_name, points, threes, twos, free_throws"
        " FROM analytics.player_points WHERE game_id = $1",
        GAME_ID,
    )
    assert {(r["team"], r["player_name"]): r["points"] for r in rows} == _box_score_points()
    for r in rows:
        assert r["points"] == 3 * r["threes"] + 2 * r["twos"] + r["free_throws"]


async def test_game_flow_matches_espn_and_the_reference(conn):  # noqa: F811
    await _reconciled(conn)
    flow = await conn.fetchrow("SELECT * FROM analytics.game_flow WHERE game_id = $1", GAME_ID)
    espn = _espn_team_stats()
    ref = _reference_flow()
    assert (flow["home_team"], flow["away_team"]) == ("CHA", "CLE")
    assert flow["largest_home_lead"] == int(espn["CHA"]["largestLead"]) == 33
    assert flow["largest_away_lead"] == int(espn["CLE"]["largestLead"]) == 9
    assert flow["lead_changes"] == int(espn["CHA"]["leadChanges"]) == 3
    assert flow["times_tied"] == ref["times_tied"]
    assert flow["final_margin"] == 12
    side, points = ref["longest"]
    assert (flow["longest_run_points"], flow["longest_run_team"]) == (
        points,
        {"home": "CHA", "away": "CLE"}[side],
    )


async def test_scoring_runs_partition_every_point(conn):  # noqa: F811
    await _reconciled(conn)
    runs = await conn.fetch(
        "SELECT side, points FROM analytics.scoring_runs WHERE game_id = $1 ORDER BY first_play",
        GAME_ID,
    )
    assert [[r["side"], r["points"]] for r in runs] == _reference_flow()["runs"]
    assert sum(r["points"] for r in runs) == 124 + 112
