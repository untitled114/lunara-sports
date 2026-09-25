"""Tests for team_service — team listing, detail, roster, schedule, stats."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from src.db.models import Game, Team
from src.services.team_service import (
    get_team_detail,
    get_team_roster,
    get_team_schedule,
    get_team_stats,
    get_teams,
)


@pytest.fixture
async def team_session(session):
    """Session with teams and games for team service tests."""
    session.add_all(
        [
            Team(abbrev="BOS", name="Boston Celtics", conference="Eastern", division="Atlantic"),
            Team(abbrev="LAL", name="Los Angeles Lakers", conference="Western", division="Pacific"),
            Team(
                abbrev="MIA",
                name="Miami Heat",
                conference="Eastern",
                division="Southeast",
                logo_url="http://heat-logo.png",
            ),
        ]
    )
    await session.flush()

    session.add_all(
        [
            # Final game: BOS home win (110-105)
            Game(
                id="g1",
                home_team="BOS",
                away_team="LAL",
                status="final",
                home_score=110,
                away_score=105,
                start_time=datetime(2026, 2, 17, 0, 30, tzinfo=timezone.utc),
            ),
            # Scheduled game
            Game(
                id="g2",
                home_team="LAL",
                away_team="BOS",
                status="scheduled",
                home_score=0,
                away_score=0,
                start_time=datetime(2026, 2, 20, 3, 0, tzinfo=timezone.utc),
            ),
            # Final game where LAL is home and loses (MIA away win)
            Game(
                id="g3",
                home_team="LAL",
                away_team="MIA",
                status="final",
                home_score=95,
                away_score=102,
                start_time=datetime(2026, 2, 18, 3, 0, tzinfo=timezone.utc),
            ),
        ]
    )
    await session.commit()
    return session


# ── get_teams ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestGetTeams:
    async def test_lists_all_teams(self, team_session):
        teams = await get_teams(team_session)
        assert len(teams) == 3
        names = {t["name"] for t in teams}
        assert "Boston Celtics" in names
        assert "Los Angeles Lakers" in names
        assert "Miami Heat" in names

    async def test_excludes_alias_rows_like_utah(self, session):
        """Migration 007 seeds both 'UTA' and 'UTAH' rows for the same team (so raw
        ingestion FKs never failed before normalization existed) — GET /teams must
        list the Jazz once, under the canonical 'UTA', not twice."""
        session.add_all(
            [
                Team(abbrev="UTA", name="Utah Jazz", conference="Western", division="Northwest"),
                Team(abbrev="UTAH", name="Utah Jazz", conference="Western", division="Northwest"),
                Team(
                    abbrev="BOS", name="Boston Celtics", conference="Eastern", division="Atlantic"
                ),
            ]
        )
        await session.commit()

        teams = await get_teams(session)
        abbrevs = [t["abbrev"] for t in teams]
        assert abbrevs.count("UTA") == 1
        assert "UTAH" not in abbrevs
        assert len(teams) == 2

    async def test_last_game_lookup_error_is_swallowed(self, team_session):
        """A failure looking up a team's last game is caught and the team
        still appears in the result with last_game left empty."""
        original_execute = team_session.execute
        call_count = 0

        async def flaky_execute(stmt, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call is the `select(Team)` query — let it through.
                return await original_execute(stmt, *args, **kwargs)
            raise RuntimeError("db unavailable")

        with patch.object(team_session, "execute", side_effect=flaky_execute):
            teams = await get_teams(team_session)

        assert len(teams) == 3
        assert all(t["last_game"] == "" for t in teams)

    async def test_home_team_win_last_game(self, team_session):
        """BOS won g1 at home 110-105 vs LAL. But g3 is later (LAL@MIA)
        so BOS last final is g1: W 110-105 vs LAL."""
        teams = await get_teams(team_session)
        bos = next(t for t in teams if t["abbrev"] == "BOS")
        # BOS was home in g1 and won
        assert bos["last_game"] == "W 110-105 vs LAL"

    async def test_away_team_loss_last_game(self, team_session):
        """LAL lost g3 at home 95-102 vs MIA (g3 is more recent than g1).
        LAL was home and lost → L."""
        teams = await get_teams(team_session)
        lal = next(t for t in teams if t["abbrev"] == "LAL")
        # LAL's most recent final is g3 (home, lost 95-102)
        assert lal["last_game"] == "L 102-95 vs MIA"

    async def test_away_team_win_last_game(self, team_session):
        """MIA was away in g3 and won (102 > 95)."""
        teams = await get_teams(team_session)
        mia = next(t for t in teams if t["abbrev"] == "MIA")
        # MIA was away in g3 and won 102-95
        assert mia["last_game"] == "W 102-95 @ LAL"

    async def test_team_logo_url(self, team_session):
        teams = await get_teams(team_session)
        mia = next(t for t in teams if t["abbrev"] == "MIA")
        assert mia["logo_url"] == "http://heat-logo.png"

    async def test_team_without_logo(self, team_session):
        teams = await get_teams(team_session)
        bos = next(t for t in teams if t["abbrev"] == "BOS")
        assert bos["logo_url"] == ""

    async def test_empty_db_returns_empty(self, session):
        """No teams in DB → empty list."""
        teams = await get_teams(session)
        assert teams == []

    async def test_team_with_no_final_games(self, session):
        """Team exists but no final games → empty last_game."""
        session.add(
            Team(abbrev="CHI", name="Chicago Bulls", conference="Eastern", division="Central")
        )
        await session.commit()
        teams = await get_teams(session)
        assert len(teams) == 1
        assert teams[0]["last_game"] == ""

    async def test_conference_and_division_included(self, team_session):
        teams = await get_teams(team_session)
        bos = next(t for t in teams if t["abbrev"] == "BOS")
        assert bos["conference"] == "Eastern"
        assert bos["division"] == "Atlantic"


# ── get_team_detail ───────────────────────────────────────────────────


@pytest.mark.asyncio
class TestGetTeamDetail:
    async def test_returns_none_for_unknown_team(self, team_session):
        result = await get_team_detail("XXX", team_session)
        assert result is None

    async def test_basic_detail_without_espn(self, team_session):
        """When ESPN returns None, detail comes from DB only."""
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=None)
            result = await get_team_detail("BOS", team_session)
            assert result is not None
            assert result.name == "Boston Celtics"
            assert result.abbrev == "BOS"
            assert result.conference == "Eastern"
            assert result.division == "Atlantic"
            # Defaults when no ESPN data
            assert result.record == ""
            assert result.city == ""
            assert result.venue == ""
            assert result.color == "#3b82f6"

    async def test_enriches_from_espn_full(self, team_session):
        """Full ESPN data enrichment — record, city, venue, color, logo."""
        espn_data = {
            "team": {
                "record": {"items": [{"summary": "40-10"}]},
                "location": "Boston",
                "franchise": {"venue": {"fullName": "TD Garden"}},
                "color": "008348",
                "logos": [{"href": "http://celtics-logo.png"}],
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=espn_data)
            result = await get_team_detail("BOS", team_session)
            assert result.record == "40-10"
            assert result.city == "Boston"
            assert result.venue == "TD Garden"
            assert result.color == "#008348"
            assert result.logo_url == "http://celtics-logo.png"

    async def test_espn_no_record_key(self, team_session):
        """ESPN data exists but no 'record' key → record defaults to empty."""
        espn_data = {
            "team": {
                "location": "Los Angeles",
                "franchise": {"venue": {"fullName": "Crypto.com Arena"}},
                "color": "552583",
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=espn_data)
            result = await get_team_detail("LAL", team_session)
            assert result.record == ""
            assert result.city == "Los Angeles"
            assert result.venue == "Crypto.com Arena"
            assert result.color == "#552583"

    async def test_espn_empty_record_items_raises(self, team_session):
        """ESPN record with empty items list triggers IndexError (known edge case)."""
        espn_data = {
            "team": {
                "record": {"items": []},
                "location": "Miami",
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=espn_data)
            with pytest.raises(IndexError):
                await get_team_detail("MIA", team_session)

    async def test_espn_record_item_no_summary(self, team_session):
        """ESPN record item exists but has no 'summary' key → defaults to empty."""
        espn_data = {
            "team": {
                "record": {"items": [{"type": "total"}]},
                "location": "Miami",
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=espn_data)
            result = await get_team_detail("MIA", team_session)
            assert result.record == ""

    async def test_espn_no_franchise_key(self, team_session):
        """ESPN data with no 'franchise' key → venue is empty."""
        espn_data = {
            "team": {
                "location": "Boston",
                "color": "008348",
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=espn_data)
            result = await get_team_detail("BOS", team_session)
            assert result.venue == ""

    async def test_espn_franchise_no_venue(self, team_session):
        """ESPN data with franchise but no venue."""
        espn_data = {
            "team": {
                "franchise": {},
                "location": "Boston",
                "color": "008348",
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=espn_data)
            result = await get_team_detail("BOS", team_session)
            assert result.venue == ""

    async def test_espn_no_logos(self, team_session):
        """ESPN data with no logos key → fallback to DB logo_url."""
        espn_data = {
            "team": {
                "location": "Miami",
                "color": "98002e",
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=espn_data)
            # MIA has a logo_url in DB
            result = await get_team_detail("MIA", team_session)
            assert result.logo_url == "http://heat-logo.png"

    async def test_espn_no_color(self, team_session):
        """ESPN data with no color → defaults to 3b82f6."""
        espn_data = {
            "team": {
                "location": "Boston",
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=espn_data)
            result = await get_team_detail("BOS", team_session)
            assert result.color == "#3b82f6"

    async def test_no_espn_id_for_unknown_abbrev(self, session):
        """Team exists in DB but has no ESPN mapping → skip ESPN enrichment."""
        session.add(Team(abbrev="ZZZ", name="Test Team", conference="Eastern", division="Atlantic"))
        await session.commit()
        with patch("src.services.team_service.espn_id_for", return_value=None):
            result = await get_team_detail("ZZZ", session)
            assert result is not None
            assert result.name == "Test Team"
            assert result.record == ""
            assert result.color == "#3b82f6"

    async def test_team_with_null_conference_division(self, session):
        """Team with None conference/division → defaults to empty string."""
        session.add(Team(abbrev="TST", name="Test FC"))
        await session.commit()
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=None)
            with patch("src.services.team_service.espn_id_for", return_value=None):
                result = await get_team_detail("TST", session)
                assert result.conference == ""
                assert result.division == ""

    async def test_espn_empty_team_dict(self, team_session):
        """ESPN returns data but team dict is empty."""
        espn_data = {"team": {}}
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=espn_data)
            result = await get_team_detail("BOS", team_session)
            assert result.record == ""
            assert result.city == ""
            assert result.venue == ""
            assert result.color == "#3b82f6"


# ── get_team_roster ───────────────────────────────────────────────────


@pytest.mark.asyncio
class TestGetTeamRoster:
    async def test_returns_empty_for_unknown_team(self):
        """Unknown team abbreviation → no ESPN ID → empty list."""
        result = await get_team_roster("ZZZZZ")
        assert result == []

    async def test_returns_empty_when_espn_returns_none(self):
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=None)
            result = await get_team_roster("BOS")
            assert result == []

    async def test_full_athlete_data(self):
        """Full athlete with all fields populated."""
        data = {
            "team": {
                "athletes": [
                    {
                        "id": "4065648",
                        "displayName": "Jayson Tatum",
                        "jersey": "0",
                        "position": {"abbreviation": "SF"},
                        "displayHeight": "6' 8\"",
                        "displayWeight": "210 lbs",
                        "age": 27,
                        "experience": {"years": 7},
                        "college": {"name": "Duke"},
                        "headshot": {"href": "http://tatum.png"},
                    }
                ]
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=data)
            result = await get_team_roster("BOS")
            assert len(result) == 1
            p = result[0]
            assert p.id == "4065648"
            assert p.name == "Jayson Tatum"
            assert p.jersey == "0"
            assert p.position == "SF"
            assert p.height == "6' 8\""
            assert p.weight == "210"  # " lbs" stripped
            assert p.age == 27
            assert p.experience == "7"
            assert p.college == "Duke"
            assert p.headshot_url == "http://tatum.png"

    async def test_athlete_minimal_data(self):
        """Athlete with missing optional fields → defaults."""
        data = {
            "team": {
                "athletes": [
                    {
                        "fullName": "Rookie Player",
                    }
                ]
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=data)
            result = await get_team_roster("BOS")
            assert len(result) == 1
            p = result[0]
            assert p.id == ""
            assert p.name == "Rookie Player"
            assert p.jersey == ""
            assert p.position == ""
            assert p.height == ""
            assert p.weight == ""
            assert p.age is None
            assert p.experience == "R"  # No experience key → "R"
            assert p.college == ""
            assert p.headshot_url == ""

    async def test_athlete_uses_displayname_over_fullname(self):
        """displayName takes priority over fullName."""
        data = {
            "team": {
                "athletes": [
                    {
                        "displayName": "Display Name",
                        "fullName": "Full Name",
                    }
                ]
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=data)
            result = await get_team_roster("BOS")
            assert result[0].name == "Display Name"

    async def test_multiple_athletes(self):
        """Multiple athletes returned."""
        data = {
            "team": {
                "athletes": [
                    {"displayName": "Player A", "id": "1"},
                    {"displayName": "Player B", "id": "2"},
                    {"displayName": "Player C", "id": "3"},
                ]
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=data)
            result = await get_team_roster("BOS")
            assert len(result) == 3
            assert [p.name for p in result] == ["Player A", "Player B", "Player C"]

    async def test_empty_athletes_list(self):
        """ESPN returns team but empty athletes list."""
        data = {"team": {"athletes": []}}
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=data)
            result = await get_team_roster("BOS")
            assert result == []

    async def test_no_athletes_key(self):
        """ESPN returns team but no athletes key at all."""
        data = {"team": {}}
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=data)
            result = await get_team_roster("BOS")
            assert result == []

    async def test_athlete_experience_zero_years(self):
        """Athlete with experience years = 0."""
        data = {
            "team": {
                "athletes": [
                    {
                        "displayName": "Rookie",
                        "experience": {"years": 0},
                    }
                ]
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=data)
            result = await get_team_roster("BOS")
            assert result[0].experience == "0"

    async def test_athlete_no_headshot_key(self):
        """Athlete with headshot = None or missing."""
        data = {
            "team": {
                "athletes": [
                    {
                        "displayName": "No Photo",
                        "headshot": None,
                    }
                ]
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=data)
            result = await get_team_roster("BOS")
            # headshot is None → athlete.get("headshot") is None → falsy → ""
            assert result[0].headshot_url == ""

    async def test_athlete_no_college_key(self):
        """Athlete with college = None."""
        data = {
            "team": {
                "athletes": [
                    {
                        "displayName": "International",
                        "college": None,
                    }
                ]
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=data)
            result = await get_team_roster("BOS")
            assert result[0].college == ""

    async def test_athlete_experience_none(self):
        """Athlete with experience key set to None."""
        data = {
            "team": {
                "athletes": [
                    {
                        "displayName": "Null Exp",
                        "experience": None,
                    }
                ]
            }
        }
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=data)
            result = await get_team_roster("BOS")
            # experience is None → falsy → "R"
            assert result[0].experience == "R"


# ── get_team_schedule ─────────────────────────────────────────────────


@pytest.mark.asyncio
class TestGetTeamSchedule:
    async def test_returns_schedule_for_team(self, team_session):
        result = await get_team_schedule("BOS", team_session)
        assert len(result) == 2  # g1 and g2 (BOS is in both)

    async def test_final_home_win(self, team_session):
        """BOS home win in g1: W 110-105."""
        result = await get_team_schedule("BOS", team_session)
        final = next((g for g in result if g.game_id == "g1"), None)
        assert final is not None
        assert final.status == "Final"
        assert final.result == "W 110-105"
        assert final.home_away == "vs"
        assert final.opponent == "vs LAL"
        assert final.score == "110-105"

    async def test_final_away_loss(self, team_session):
        """LAL was away in g1 and lost: L 105-110."""
        result = await get_team_schedule("LAL", team_session)
        g1 = next((g for g in result if g.game_id == "g1"), None)
        assert g1 is not None
        assert g1.status == "Final"
        assert g1.result == "L 105-110"
        assert g1.home_away == "@"
        assert g1.opponent == "@ BOS"
        assert g1.score == "105-110"

    async def test_final_home_loss(self, team_session):
        """LAL was home in g3 and lost 95-102."""
        result = await get_team_schedule("LAL", team_session)
        g3 = next((g for g in result if g.game_id == "g3"), None)
        assert g3 is not None
        assert g3.result == "L 95-102"
        assert g3.home_away == "vs"
        assert g3.opponent == "vs MIA"

    async def test_final_away_win(self, team_session):
        """MIA was away in g3 and won 102-95."""
        result = await get_team_schedule("MIA", team_session)
        g3 = next((g for g in result if g.game_id == "g3"), None)
        assert g3 is not None
        assert g3.result == "W 102-95"
        assert g3.home_away == "@"
        assert g3.opponent == "@ LAL"

    async def test_scheduled_game_no_result(self, team_session):
        """Scheduled game has empty result and score."""
        result = await get_team_schedule("BOS", team_session)
        sched = next((g for g in result if g.game_id == "g2"), None)
        assert sched is not None
        assert sched.result == ""
        assert sched.score == ""
        assert sched.status == "scheduled"

    async def test_date_formatting(self, team_session):
        result = await get_team_schedule("BOS", team_session)
        # All games should have non-empty date strings
        for g in result:
            assert g.date != ""
            assert "Feb" in g.date  # Both games in February

    async def test_empty_for_nonexistent_team(self, team_session):
        result = await get_team_schedule("XXX", team_session)
        assert result == []

    async def test_schedule_ordered_by_start_time_desc(self, team_session):
        """Games should come back ordered by start_time descending."""
        result = await get_team_schedule("LAL", team_session)
        # LAL has 3 games: g2 (Feb 20), g3 (Feb 18), g1 (Feb 17)
        assert len(result) == 3
        assert result[0].game_id == "g2"
        assert result[1].game_id == "g3"
        assert result[2].game_id == "g1"

    async def test_game_without_start_time(self, session):
        """Game with no start_time — date should be empty string.
        Note: start_time is NOT NULL so this scenario requires special handling.
        Instead, test a live game status that isn't 'final'."""
        session.add_all(
            [
                Team(abbrev="PHX", name="Phoenix Suns", conference="Western", division="Pacific"),
                Team(
                    abbrev="DEN", name="Denver Nuggets", conference="Western", division="Northwest"
                ),
            ]
        )
        await session.flush()
        session.add(
            Game(
                id="g_live",
                home_team="PHX",
                away_team="DEN",
                status="live",
                home_score=60,
                away_score=55,
                quarter=3,
                clock="5:00",
                start_time=datetime(2026, 3, 1, 2, 0, tzinfo=timezone.utc),
            )
        )
        await session.commit()

        result = await get_team_schedule("PHX", session)
        assert len(result) == 1
        assert result[0].status == "live"
        assert result[0].result == ""  # Not final → no result


# ── get_team_stats ────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestGetTeamStats:
    async def test_always_empty(self):
        """No data source since the Sport-suite DB pools were retired
        (owner-approved); always returns empty."""
        result = await get_team_stats("BOS")
        assert result == []
