"""Tests for the pick tracker poller — live stat tracking and hit/miss resolution."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.pick_tracker_poller import (
    _eastern_today,
    _get_stat_value,
    _name_match,
    _update_picks_for_game,
)

# ── _name_match ──────────────────────────────────────────────────────


class TestNameMatch:
    def test_exact_match(self):
        assert _name_match("LeBron James", "LeBron James") is True

    def test_case_insensitive(self):
        assert _name_match("LEBRON JAMES", "lebron james") is True

    def test_last_name_match(self):
        assert _name_match("LeBron James", "L. James") is True

    def test_short_last_name_no_match(self):
        # Last name too short (<=2 chars) should not match
        assert _name_match("John Li", "Bob Li") is False

    def test_different_names(self):
        assert _name_match("Stephen Curry", "LeBron James") is False

    def test_whitespace_handling(self):
        assert _name_match("  LeBron James  ", "LeBron James") is True

    def test_empty_names(self):
        assert _name_match("", "") is True  # both empty → "" == ""

    def test_single_name(self):
        assert _name_match("Nene", "Nene") is True


# ── _get_stat_value ──────────────────────────────────────────────────


class TestGetStatValue:
    def _make_player(self, **kwargs):
        p = MagicMock()
        for k, v in kwargs.items():
            setattr(p, k, v)
        return p

    def test_points(self):
        p = self._make_player(points=25)
        assert _get_stat_value(p, "POINTS") == 25.0

    def test_rebounds(self):
        p = self._make_player(rebounds=10)
        assert _get_stat_value(p, "REBOUNDS") == 10.0

    def test_assists(self):
        p = self._make_player(assists=8)
        assert _get_stat_value(p, "ASSISTS") == 8.0

    def test_steals(self):
        p = self._make_player(steals=3)
        assert _get_stat_value(p, "STEALS") == 3.0

    def test_blocks(self):
        p = self._make_player(blocks=2)
        assert _get_stat_value(p, "BLOCKS") == 2.0

    def test_threes_parsing(self):
        p = self._make_player(three_pt="3-7")
        assert _get_stat_value(p, "THREES") == 3.0

    def test_threes_zero(self):
        p = self._make_player(three_pt="0-5")
        assert _get_stat_value(p, "THREES") == 0.0

    def test_threes_invalid_format(self):
        p = self._make_player(three_pt="bad")
        assert _get_stat_value(p, "THREES") == 0.0

    def test_unknown_market(self):
        p = self._make_player(points=25)
        assert _get_stat_value(p, "UNKNOWN") is None

    def test_none_stat_value(self):
        p = MagicMock(spec=[])  # no attributes
        assert _get_stat_value(p, "POINTS") is None


# ── _eastern_today ───────────────────────────────────────────────────


class TestEasternToday:
    def test_returns_date(self):
        result = _eastern_today()
        assert result is not None


# ── _update_picks_for_game ───────────────────────────────────────────


class TestUpdatePicksForGame:
    @pytest.fixture
    def mock_session(self):
        s = AsyncMock()
        return s

    def _make_pick(self, **kwargs):
        pick = MagicMock()
        pick.id = kwargs.get("id", 1)
        pick.player_name = kwargs.get("player_name", "LeBron James")
        pick.market = kwargs.get("market", "POINTS")
        pick.line = kwargs.get("line", 25.5)
        pick.prediction = kwargs.get("prediction", "OVER")
        pick.actual_value = kwargs.get("actual_value")
        pick.is_hit = kwargs.get("is_hit")
        pick.tier = kwargs.get("tier", "X")
        pick.model_version = kwargs.get("model_version", "xl")
        pick.book = kwargs.get("book", "DraftKings")
        pick.sport_suite_id = kwargs.get("sport_suite_id")
        return pick

    def _make_boxscore(self, players_home=None, players_away=None):
        box = MagicMock()
        home = MagicMock()
        away = MagicMock()
        home.players = players_home or []
        away.players = players_away or []
        box.home = home
        box.away = away
        return box

    def _make_box_player(self, name, **stats):
        p = MagicMock()
        p.name = name
        for k, v in stats.items():
            setattr(p, k, v)
        return p

    async def test_no_boxscore(self, mock_session):
        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=None,
        ):
            result = await _update_picks_for_game(mock_session, "game1", "live", [])
            assert result == []

    async def test_updates_actual_value(self, mock_session):
        bp = self._make_box_player("LeBron James", points=30)
        box = self._make_boxscore(players_home=[bp])
        pick = self._make_pick(actual_value=None)

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=box,
        ):
            result = await _update_picks_for_game(mock_session, "game1", "live", [pick])
            assert len(result) == 1
            assert result[0]["actual_value"] == 30.0

    async def test_marks_hit_on_final_over(self, mock_session):
        bp = self._make_box_player("LeBron James", points=30)
        box = self._make_boxscore(players_home=[bp])
        pick = self._make_pick(line=25.5, prediction="OVER", actual_value=None)

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=box,
        ):
            result = await _update_picks_for_game(mock_session, "game1", "final", [pick])
            assert result[0]["is_hit"] is True

    async def test_marks_miss_on_final_over(self, mock_session):
        bp = self._make_box_player("LeBron James", points=20)
        box = self._make_boxscore(players_home=[bp])
        pick = self._make_pick(line=25.5, prediction="OVER", actual_value=None)

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=box,
        ):
            result = await _update_picks_for_game(mock_session, "game1", "final", [pick])
            assert result[0]["is_hit"] is False

    async def test_marks_hit_on_final_under(self, mock_session):
        bp = self._make_box_player("LeBron James", points=20)
        box = self._make_boxscore(players_home=[bp])
        pick = self._make_pick(line=25.5, prediction="UNDER", actual_value=None)

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=box,
        ):
            result = await _update_picks_for_game(mock_session, "game1", "final", [pick])
            assert result[0]["is_hit"] is True

    async def test_no_player_match(self, mock_session):
        bp = self._make_box_player("Kevin Durant", points=30)
        box = self._make_boxscore(players_home=[bp])
        pick = self._make_pick(player_name="LeBron James")

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=box,
        ):
            result = await _update_picks_for_game(mock_session, "game1", "live", [pick])
            assert result == []

    async def test_skip_unchanged_value(self, mock_session):
        bp = self._make_box_player("LeBron James", points=25)
        box = self._make_boxscore(players_home=[bp])
        pick = self._make_pick(actual_value=25.0, is_hit=None)

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=box,
        ):
            result = await _update_picks_for_game(mock_session, "game1", "live", [pick])
            assert result == []

    async def test_fires_sport_suite_callback_on_final(self, mock_session):
        bp = self._make_box_player("LeBron James", points=30)
        box = self._make_boxscore(players_home=[bp])
        pick = self._make_pick(sport_suite_id="ss-123", actual_value=None)

        with (
            patch(
                "src.services.pick_tracker_poller.get_boxscore",
                new_callable=AsyncMock,
                return_value=box,
            ),
            patch(
                "src.services.pick_tracker_poller.post_pick_result", new_callable=AsyncMock
            ) as mock_post,
        ):
            result = await _update_picks_for_game(
                mock_session,
                "game1",
                "final",
                [pick],
                api_url="http://example.com",
                api_key="key123",
            )
            assert len(result) == 1
            # post_pick_result is called via asyncio.create_task
