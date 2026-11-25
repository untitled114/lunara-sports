"""The README's figures for the stored CLE @ CHA game, from the two captures alone.

No database: these read the stored rows (api/tests/fixtures/lunara_plays_401909953.json) and
ESPN's final summary (tests/fixtures/espn/espn_summary_401909953_core.json) directly.
"""

from __future__ import annotations

import json
from collections import defaultdict
from itertools import pairwise
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _load(rel: str):
    return json.loads((ROOT / rel).read_text())


def test_the_stored_game_had_drifted_from_espn():
    """The figures the README gives for CLE @ CHA, from the two captures alone."""
    stored = {
        p["sequence_number"]: p for p in _load("api/tests/fixtures/lunara_plays_401909953.json")
    }
    espn = {
        int(p["sequenceNumber"]): p
        for p in _load("tests/fixtures/espn/espn_summary_401909953_core.json")["plays"]
    }
    shared = set(stored) & set(espn)
    assert len(shared) == 445
    assert sum(1 for s in shared if stored[s]["description"] != espn[s]["text"]) == 109
    assert len(set(stored) - set(espn)) == 6  # stale rows
    assert len(set(espn) - set(stored)) == 8  # missing plays

    # points summed from the stored score changes, in stored order, against the box score
    points: dict[tuple[str, str], int] = defaultdict(int)
    home = away = 0
    for s in sorted(stored):
        p = stored[s]
        scored = (p["home_score"] - home) + (p["away_score"] - away)
        if scored:
            points[(p["team"], p["player_name"])] += scored
        home, away = p["home_score"], p["away_score"]
    box = {}  # every player in ESPN's box score who played, 0 points included
    for team in _load("tests/fixtures/espn/espn_summary_401909953_core.json")["boxscore"][
        "players"
    ]:
        stats = team["statistics"][0]
        i = stats["labels"].index("PTS")
        for athlete in stats["athletes"]:
            if athlete.get("stats"):
                box[(team["team"]["abbreviation"], athlete["athlete"]["displayName"])] = int(
                    athlete["stats"][i]
                )
    assert len(box) == 22
    assert sum(1 for k, pts in box.items() if points.get(k, 0) != pts) == 12


def test_espns_sequence_order_is_not_its_time_order():
    """In ESPN's final list the running score never goes back; sorted by sequence number
    it goes back four times."""
    plays = _load("tests/fixtures/espn/espn_summary_401909953_core.json")["plays"]

    def backwards(seq):
        scores = [(p["homeScore"], p["awayScore"]) for p in seq]
        return sum(1 for a, b in pairwise(scores) if b[0] < a[0] or b[1] < a[1])

    assert backwards(plays) == 0
    assert backwards(sorted(plays, key=lambda p: int(p["sequenceNumber"]))) == 4
