"""A team's schedule is dated and timed in Eastern time and runs soonest first.

The games are real, as the games table stored them on 2026-11-25: CLE at NY (401909319,
tip 2026-11-26 00:30 UTC = Wed Nov 25 7:30 PM ET, final 102-121), SA at POR (401909325,
tip 2026-11-26 03:00 UTC = Wed Nov 25 10:00 PM ET, final 111-116, as GET
/games/?game_date=2026-11-25 returned it after the final) and IND at CLE (401910068, tip
2026-12-02 00:00 UTC = Tue Dec 1 7:00 PM ET, scheduled). Before this change the late
games were dated Nov 26 (UTC) and the list ran newest first.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from src.db.models import Game, Team
from src.services.team_service import get_team_schedule


@pytest.fixture
async def real_games(session):
    session.add_all(
        [
            Team(abbrev=a, name=n, conference=c, division=d)
            for a, n, c, d in (
                ("CLE", "Cleveland Cavaliers", "Eastern", "Central"),
                ("NY", "New York Knicks", "Eastern", "Atlantic"),
                ("IND", "Indiana Pacers", "Eastern", "Central"),
                ("SA", "San Antonio Spurs", "Western", "Southwest"),
                ("POR", "Portland Trail Blazers", "Western", "Northwest"),
            )
        ]
    )
    await session.flush()
    session.add_all(
        [
            Game(
                id="401910068",
                home_team="CLE",
                away_team="IND",
                status="scheduled",
                home_score=0,
                away_score=0,
                start_time=datetime(2026, 12, 2, 0, 0, tzinfo=timezone.utc),
            ),
            Game(
                id="401909319",
                home_team="NY",
                away_team="CLE",
                status="final",
                home_score=121,
                away_score=102,
                start_time=datetime(2026, 11, 26, 0, 30, tzinfo=timezone.utc),
            ),
            Game(
                id="401909325",
                home_team="POR",
                away_team="SA",
                status="final",
                home_score=116,
                away_score=111,
                quarter=4,
                clock=None,
                start_time=datetime(2026, 11, 26, 3, 0, tzinfo=timezone.utc),
            ),
        ]
    )
    await session.commit()
    return session


async def test_a_late_tip_is_dated_on_its_eastern_day(real_games):
    g = next(x for x in await get_team_schedule("POR", real_games) if x.game_id == "401909325")
    assert (g.day, g.tip, g.start) == ("Wed, Nov 25", "10:00 PM", "2026-11-25T22:00:00-05:00")
    assert g.date == g.day


async def test_the_schedule_runs_soonest_first(real_games):
    games = await get_team_schedule("CLE", real_games)
    assert [g.game_id for g in games] == ["401909319", "401910068"]
    assert [(g.day, g.tip) for g in games] == [
        ("Wed, Nov 25", "7:30 PM"),
        ("Tue, Dec 1", "7:00 PM"),
    ]


async def test_status_words_are_capitalized(real_games):
    by_id = {g.game_id: g for g in await get_team_schedule("CLE", real_games)}
    by_id.update({g.game_id: g for g in await get_team_schedule("POR", real_games)})
    assert (by_id["401909319"].status, by_id["401910068"].status, by_id["401909325"].status) == (
        "Final",
        "Scheduled",
        "Final",
    )
    assert by_id["401909319"].result == "L 102-121"


def test_every_stored_status_has_a_capitalized_word():
    """The statuses ingestion stores (an enum, not game data) map to plain words."""
    from src.services.team_service import _STATUS_WORDS

    assert {s: _STATUS_WORDS[s] for s in ("scheduled", "live", "halftime", "final")} == {
        "scheduled": "Scheduled",
        "live": "Live",
        "halftime": "Halftime",
        "final": "Final",
    }
