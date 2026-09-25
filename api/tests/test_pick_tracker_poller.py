"""Tests for pick_tracker_poller — live stat tracking logic."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from src.models.schemas import BoxScorePlayer, BoxScoreResponse, BoxScoreTeam
from src.services.pick_tracker_poller import _update_picks_for_game


def _make_boxscore_player(
    name, points=0, rebounds=0, assists=0, steals=0, blocks=0, three_pt="0-0"
):
    return BoxScorePlayer(
        name=name,
        position="",
        starter=True,
        headshot_url="",
        jersey="",
        minutes="30",
        fg="5-10",
        three_pt=three_pt,
        ft="2-2",
        rebounds=rebounds,
        assists=assists,
        fouls=1,
        steals=steals,
        blocks=blocks,
        turnovers=1,
        plus_minus="0",
        points=points,
    )


def _make_pick(
    player_name,
    market,
    line,
    prediction="OVER",
    actual_value=None,
    is_hit=None,
    pick_id=1,
    sport_suite_id=None,
):
    return SimpleNamespace(
        id=pick_id,
        player_name=player_name,
        market=market,
        line=line,
        prediction=prediction,
        actual_value=actual_value,
        is_hit=is_hit,
        tier="X",
        model_version="xl",
        book="DraftKings",
        game_id="g1",
        sport_suite_id=sport_suite_id,
    )


@pytest.mark.asyncio
class TestUpdatePicksForGame:
    async def test_updates_actual_value(self):
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[
                    _make_boxscore_player("LeBron James", points=28),
                ],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )

        pick = _make_pick("LeBron James", "POINTS", 24.5)
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=boxscore,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "live", [pick])
            assert len(updates) == 1
            assert updates[0]["actual_value"] == 28.0
            assert updates[0]["is_hit"] is None  # not final yet

    async def test_determines_hit_on_final(self):
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[
                    _make_boxscore_player("Jayson Tatum", points=30),
                ],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )

        pick = _make_pick("Jayson Tatum", "POINTS", 24.5, "OVER")
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=boxscore,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "final", [pick])
            assert len(updates) == 1
            assert updates[0]["is_hit"] is True

    async def test_determines_miss_on_final(self):
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[
                    _make_boxscore_player("Jayson Tatum", points=20),
                ],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )

        pick = _make_pick("Jayson Tatum", "POINTS", 24.5, "OVER")
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=boxscore,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "final", [pick])
            assert len(updates) == 1
            assert updates[0]["is_hit"] is False

    async def test_under_prediction_hit(self):
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[
                    _make_boxscore_player("Player X", rebounds=4),
                ],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )

        pick = _make_pick("Player X", "REBOUNDS", 6.5, "UNDER")
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=boxscore,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "final", [pick])
            assert updates[0]["is_hit"] is True

    async def test_boxscore_missing_home_still_checks_away(self):
        """boxscore.home is None: the home-extend is skipped (100->102)
        but away players are still collected and matched.

        get_boxscore() itself never returns a BoxScoreResponse with a None
        team (Pydantic requires both), so this uses a duck-typed
        SimpleNamespace to exercise the defensive check directly.
        """
        boxscore = SimpleNamespace(
            home=None,
            away=BoxScoreTeam(
                team="LAL",
                abbrev="LAL",
                players=[_make_boxscore_player("LeBron James", points=28)],
                totals={},
            ),
        )
        pick = _make_pick("LeBron James", "POINTS", 24.5)
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=boxscore,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "live", [pick])
        assert len(updates) == 1
        assert updates[0]["actual_value"] == 28.0

    async def test_boxscore_missing_away_only_home_players(self):
        """boxscore.away is None: the away-extend is skipped (102->105).

        Same rationale as above — SimpleNamespace bypasses BoxScoreResponse's
        required-field validation to exercise this defensive branch.
        """
        boxscore = SimpleNamespace(
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[_make_boxscore_player("Jayson Tatum", points=30)],
                totals={},
            ),
            away=None,
        )
        pick = _make_pick("Jayson Tatum", "POINTS", 24.5)
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=boxscore,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "live", [pick])
        assert len(updates) == 1
        assert updates[0]["actual_value"] == 30.0

    async def test_unknown_market_stat_value_none_skips_pick(self):
        """A pick whose market has no stat mapping (_get_stat_value returns
        None) is skipped without erroring (line 121)."""
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[_make_boxscore_player("Jayson Tatum", points=30)],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )
        pick = _make_pick("Jayson Tatum", "TURNOVERS", 2.5)  # not in MARKET_STAT_MAP
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=boxscore,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "live", [pick])
        assert updates == []

    async def test_no_boxscore_returns_empty(self):
        mock_session = AsyncMock()
        pick = _make_pick("Player", "POINTS", 20)

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=None,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "live", [pick])
            assert updates == []

    async def test_unmatched_player_skipped(self):
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[
                    _make_boxscore_player("Jayson Tatum", points=25),
                ],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )

        pick = _make_pick("Stephen Curry", "POINTS", 20)
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=boxscore,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "live", [pick])
            assert updates == []

    async def test_skips_when_actual_unchanged(self):
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[
                    _make_boxscore_player("Player A", points=20),
                ],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )

        # Pick already has this actual value
        pick = _make_pick("Player A", "POINTS", 24.5, actual_value=20.0)
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=boxscore,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "live", [pick])
            assert updates == []

    async def test_rebounds_tracking(self):
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[
                    _make_boxscore_player("Rebounder", rebounds=12),
                ],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )

        pick = _make_pick("Rebounder", "REBOUNDS", 8.5)
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=boxscore,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "final", [pick])
            assert updates[0]["actual_value"] == 12.0
            assert updates[0]["is_hit"] is True

    async def test_threes_tracking(self):
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[
                    _make_boxscore_player("Shooter", three_pt="4-8"),
                ],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )

        pick = _make_pick("Shooter", "THREES", 2.5)
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_tracker_poller.get_boxscore",
            new_callable=AsyncMock,
            return_value=boxscore,
        ):
            updates = await _update_picks_for_game(mock_session, "g1", "final", [pick])
            assert updates[0]["actual_value"] == 4.0
            assert updates[0]["is_hit"] is True

    async def test_feedback_posted_on_final_with_sport_suite_id(self):
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[_make_boxscore_player("LeBron James", points=30)],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )
        pick = _make_pick("LeBron James", "POINTS", 24.5, sport_suite_id="uuid-abc")
        mock_session = AsyncMock()

        with (
            patch(
                "src.services.pick_tracker_poller.get_boxscore",
                new_callable=AsyncMock,
                return_value=boxscore,
            ),
            patch("src.services.pick_tracker_poller.asyncio.create_task") as mock_task,
            patch(
                "src.services.pick_tracker_poller.post_pick_result",
                new_callable=AsyncMock,
            ) as mock_post,
        ):
            await _update_picks_for_game(
                mock_session,
                "g1",
                "final",
                [pick],
                api_url="https://api.sport-suite.internal",
                api_key="key-123",
            )
            mock_task.assert_called_once()
            mock_post.assert_called_once_with(
                "https://api.sport-suite.internal", "key-123", "uuid-abc", 30.0, True
            )

    async def test_feedback_not_posted_without_api_url(self):
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[_make_boxscore_player("LeBron James", points=30)],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )
        pick = _make_pick("LeBron James", "POINTS", 24.5, sport_suite_id="uuid-abc")
        mock_session = AsyncMock()

        with (
            patch(
                "src.services.pick_tracker_poller.get_boxscore",
                new_callable=AsyncMock,
                return_value=boxscore,
            ),
            patch("src.services.pick_tracker_poller.asyncio.create_task") as mock_task,
        ):
            await _update_picks_for_game(mock_session, "g1", "final", [pick])
            mock_task.assert_not_called()

    async def test_feedback_not_posted_without_sport_suite_id(self):
        boxscore = BoxScoreResponse(
            game_id="g1",
            home=BoxScoreTeam(
                team="BOS",
                abbrev="BOS",
                players=[_make_boxscore_player("LeBron James", points=30)],
                totals={},
            ),
            away=BoxScoreTeam(team="LAL", abbrev="LAL", players=[], totals={}),
        )
        # sport_suite_id=None (file-based sync, no ID available)
        pick = _make_pick("LeBron James", "POINTS", 24.5, sport_suite_id=None)
        mock_session = AsyncMock()

        with (
            patch(
                "src.services.pick_tracker_poller.get_boxscore",
                new_callable=AsyncMock,
                return_value=boxscore,
            ),
            patch("src.services.pick_tracker_poller.asyncio.create_task") as mock_task,
        ):
            await _update_picks_for_game(
                mock_session,
                "g1",
                "final",
                [pick],
                api_url="https://api.sport-suite.internal",
                api_key="key-123",
            )
            mock_task.assert_not_called()
