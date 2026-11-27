"""A player's full season line from ESPN's athlete stats (GET /players/{id}/stats).

Fixture: espn_athlete_stats_3945274_20261125.json, ESPN's stats response for Luka Doncic,
recorded 2026-11-25 (2026-27 season in progress), unedited apart from ESPN's navigation
links, which were removed.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

from src.services import stats_service
from src.services.stats_service import _season_row, get_player_season_stats

DATA = json.loads(
    (Path(__file__).parent / "fixtures/espn_athlete_stats_3945274_20261125.json").read_text()
)


def _espn(category: str, season: str) -> dict[str, str]:
    cat = next(c for c in DATA["categories"] if c["name"] == category)
    row = next(r for r in cat["statistics"] if r["season"]["displayName"] == season)
    return dict(zip(cat["labels"], row["stats"], strict=False))


async def test_the_full_per_game_line_for_the_latest_season():
    with patch.object(stats_service.espn_client, "get_athlete_stats", AsyncMock(return_value=DATA)):
        s = await get_player_season_stats("3945274")
    avg = _espn("averages", s.season)
    misc = _espn("miscellaneous", s.season)
    assert s.season == "2026-27"
    assert (s.gp, s.gs) == (int(avg["GP"]), int(avg["GS"]))
    assert (s.mpg, s.fg, s.three, s.ft) == (avg["MIN"], avg["FG"], avg["3PT"], avg["FT"])
    assert (s.orpg, s.drpg, s.tovpg, s.pfpg) == (avg["OR"], avg["DR"], avg["TO"], avg["PF"])
    assert (s.double_doubles, s.triple_doubles) == (int(misc["DD2"]), int(misc["TD3"]))
    assert s.ppg == avg["PTS"]


def test_a_season_missing_from_a_category_gives_nothing():
    assert _season_row(DATA, "miscellaneous", "1999-00") == {}
    assert _season_row(DATA, "no-such-category", "2026-27") == {}


def test_int_or_none():
    assert stats_service._int_or_none("4") == 4
    assert stats_service._int_or_none("") is None
    assert stats_service._int_or_none(None) is None
    assert stats_service._int_or_none("n/a") is None
