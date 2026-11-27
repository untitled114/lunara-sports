"""Winning percentage is rounded to three places, the way standings print it.

The real standings fixture (espn_standings_2027_20261125.json, recorded 2026-11-25, see
tests/fixtures/README.md) had Boston at 12-6, which the old code printed as .666.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.services.standings_service import _parse, win_pct

FIX = Path(__file__).parent / "fixtures"


@pytest.mark.parametrize(
    ("w", "l", "pct"),
    [
        (12, 6, ".667"),
        (7, 10, ".412"),
        (2, 15, ".118"),
        (9, 7, ".563"),
        (15, 0, "1.000"),
        (0, 0, ".000"),
        (9, 16, ".360"),
    ],
)
def test_win_pct_rounds_to_three_places(w, l, pct):
    assert win_pct(w, l) == pct


def test_every_team_in_the_real_standings_is_rounded():
    data = json.loads((FIX / "espn_standings_2027_20261125.json").read_text())
    east, west = _parse(data)
    for t in [*east, *west]:
        w, l = int(t.w), int(t.l)
        g = w + l
        # Half up in whole thousandths (9-7 is .5625 -> .563), as standings print it.
        expected = ".000" if g == 0 else "1.000" if w == g else f".{(2000 * w + g) // (2 * g):03d}"
        assert t.pct == expected, t.abbrev
