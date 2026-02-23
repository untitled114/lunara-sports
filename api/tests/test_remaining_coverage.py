"""Remaining coverage tests — game_service ESPN parsing, team_service details, pick_tracker poll, play_poller."""

from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.db.models import Game, Team
from src.services.game_service import _fetch_and_upsert_espn
from src.services.pick_tracker_poller import _poll_pick_tracker
from src.ws.play_poller import _poll_once

# ── game_service._fetch_and_upsert_espn ──────────────────────────────


@pytest.mark.asyncio
class TestFetchAndUpsertEspn:
    async def test_returns_empty_on_no_data(self, session):
        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value=None)
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 20))
            assert result == []

    async def test_returns_empty_on_no_events(self, session):
        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": []})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 20))
            assert result == []

    async def test_skips_bad_competitors(self, session):
        bad_event = {
            "id": "999",
            "competitions": [{"competitors": [{"team": {"abbreviation": "BOS"}}]}],
            "status": {"type": {"state": "pre"}},
        }
        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [bad_event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 20))
            assert result == []


# ── team_service — more coverage ──────────────────────────────────────

from src.services.team_service import get_team_detail, get_team_schedule, get_teams


@pytest.fixture
async def full_team_session(session):
    """Session with teams and games for detailed team tests."""
    session.add_all(
        [
            Team(
                abbrev="BOS",
                name="Boston Celtics",
                conference="Eastern",
                division="Atlantic",
                logo_url="http://bos.png",
            ),
            Team(abbrev="LAL", name="Los Angeles Lakers", conference="Western", division="Pacific"),
            Team(abbrev="MIA", name="Miami Heat", conference="Eastern", division="Southeast"),
        ]
    )
    await session.flush()

    session.add_all(
        [
            Game(
                id="ft1",
                home_team="BOS",
                away_team="LAL",
                status="final",
                home_score=110,
                away_score=105,
                start_time=datetime(2026, 2, 15, 0, 30, tzinfo=timezone.utc),
            ),
            Game(
                id="ft2",
                home_team="LAL",
                away_team="BOS",
                status="final",
                home_score=100,
                away_score=108,
                start_time=datetime(2026, 2, 17, 3, 0, tzinfo=timezone.utc),
            ),
            Game(
                id="ft3",
                home_team="BOS",
                away_team="MIA",
                status="scheduled",
                start_time=datetime(2026, 2, 22, 0, 30, tzinfo=timezone.utc),
            ),
        ]
    )
    await session.commit()
    return session


@pytest.mark.asyncio
class TestTeamServiceExtended:
    async def test_get_teams_with_results(self, full_team_session):
        teams = await get_teams(full_team_session)
        assert len(teams) == 3
        bos = next(t for t in teams if t["abbrev"] == "BOS")
        assert bos.get("last_game", "") != ""

    async def test_schedule_shows_results(self, full_team_session):
        schedule = await get_team_schedule("BOS", full_team_session)
        assert len(schedule) == 3
        # Final games should have W/L
        finals = [g for g in schedule if g.status == "Final"]
        assert len(finals) == 2

    async def test_schedule_away_loss(self, full_team_session):
        schedule = await get_team_schedule("LAL", full_team_session)
        finals = [g for g in schedule if g.status == "Final"]
        assert len(finals) == 2

    async def test_team_detail_without_espn(self, full_team_session):
        with patch("src.services.team_service.espn_client") as mock:
            mock.get_team_roster = AsyncMock(return_value=None)
            result = await get_team_detail("BOS", full_team_session)
            assert result.name == "Boston Celtics"
            assert result.logo_url == "http://bos.png"


# ── pick_tracker_poller._poll_pick_tracker ────────────────────────────


@pytest.mark.asyncio
class TestPollPickTracker:
    async def test_no_factory(self):
        with patch("src.services.pick_tracker_poller.get_session_factory", return_value=None):
            await _poll_pick_tracker()  # should not raise

    async def test_no_pending_picks(self, session_factory):
        with patch(
            "src.services.pick_tracker_poller.get_session_factory", return_value=session_factory
        ):
            await _poll_pick_tracker()  # should return early (no picks)


# ── play_poller._poll_once ────────────────────────────────────────────


@pytest.mark.asyncio
class TestPollOnce:
    async def test_no_active_games(self):
        with patch("src.ws.play_poller.manager") as mock_mgr:
            mock_mgr.active_games = MagicMock(return_value=[])
            await _poll_once()

    async def test_no_factory(self):
        with (
            patch("src.ws.play_poller.manager") as mock_mgr,
            patch("src.ws.play_poller.get_session_factory", return_value=None),
        ):
            mock_mgr.active_games = MagicMock(return_value=["g1"])
            await _poll_once()

    async def test_polls_games(self, session_factory):
        from src.db.models import Game, Play, Team

        async with session_factory() as sess:
            sess.add(Team(abbrev="BOS", name="Boston Celtics"))
            sess.add(Team(abbrev="LAL", name="Lakers"))
            await sess.flush()
            sess.add(
                Game(
                    id="poll_g",
                    home_team="BOS",
                    away_team="LAL",
                    status="live",
                    start_time=datetime(2026, 2, 20, 0, 0, tzinfo=timezone.utc),
                )
            )
            await sess.flush()
            sess.add(Play(id=500, game_id="poll_g", sequence_number=1, quarter=1))
            await sess.commit()

        mock_broadcast = AsyncMock()
        with (
            patch("src.ws.play_poller.manager") as mock_mgr,
            patch("src.ws.play_poller.get_session_factory", return_value=session_factory),
        ):
            mock_mgr.active_games = MagicMock(return_value=["poll_g"])
            mock_mgr.broadcast = mock_broadcast
            await _poll_once()
            mock_broadcast.assert_called_once()
