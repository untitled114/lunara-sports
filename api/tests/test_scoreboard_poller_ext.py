"""Extended tests for scoreboard_poller — full poll cycle."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from src.services.scoreboard_poller import _poll_scoreboard, run_scoreboard_poller


@pytest.mark.asyncio
class TestPollScoreboard:
    async def test_no_data(self):
        with (
            patch("src.services.scoreboard_poller.espn_client") as mock_espn,
            patch("src.services.scoreboard_poller.cache_game_list", new_callable=AsyncMock),
            patch("src.services.scoreboard_poller.cache_game_state", new_callable=AsyncMock),
        ):
            mock_espn.get_scoreboard = AsyncMock(return_value=None)
            await _poll_scoreboard()  # should not raise

    async def test_empty_events(self):
        with (
            patch("src.services.scoreboard_poller.espn_client") as mock_espn,
            patch("src.services.scoreboard_poller.cache_game_list", new_callable=AsyncMock),
            patch("src.services.scoreboard_poller.cache_game_state", new_callable=AsyncMock),
        ):
            mock_espn.get_scoreboard = AsyncMock(return_value={"events": []})
            await _poll_scoreboard()  # should not raise

    async def test_no_session_factory(self):
        with (
            patch("src.services.scoreboard_poller.espn_client") as mock_espn,
            patch("src.services.scoreboard_poller.get_session_factory", return_value=None),
            patch("src.services.scoreboard_poller.cache_game_list", new_callable=AsyncMock),
            patch("src.services.scoreboard_poller.cache_game_state", new_callable=AsyncMock),
        ):
            mock_espn.get_scoreboard = AsyncMock(return_value={"events": [{"id": "1"}]})
            await _poll_scoreboard()  # should return early

    async def test_full_poll_with_game(self, session_factory):
        event = {
            "id": "401810099",
            "competitions": [
                {
                    "competitors": [
                        {"team": {"abbreviation": "BOS"}, "homeAway": "home", "score": "55"},
                        {"team": {"abbreviation": "LAL"}, "homeAway": "away", "score": "48"},
                    ],
                    "date": "2026-02-20T00:30:00Z",
                    "venue": {"fullName": "TD Garden"},
                }
            ],
            "status": {
                "type": {"state": "in", "description": ""},
                "period": 3,
                "displayClock": "5:30",
            },
        }

        # Need to pre-create teams in the DB so the FK constraint is satisfied
        from src.db.models import Team

        async with session_factory() as sess:
            sess.add_all(
                [
                    Team(abbrev="BOS", name="Boston Celtics"),
                    Team(abbrev="LAL", name="Los Angeles Lakers"),
                ]
            )
            await sess.commit()

        mock_broadcast = AsyncMock()
        with (
            patch("src.services.scoreboard_poller.espn_client") as mock_espn,
            patch(
                "src.services.scoreboard_poller.get_session_factory", return_value=session_factory
            ),
            patch("src.services.scoreboard_poller.cache_game_list", new_callable=AsyncMock),
            patch("src.services.scoreboard_poller.cache_game_state", new_callable=AsyncMock),
            patch("src.services.scoreboard_poller.manager") as mock_mgr,
        ):
            mock_espn.get_scoreboard = AsyncMock(return_value={"events": [event]})
            mock_mgr.broadcast = mock_broadcast
            await _poll_scoreboard()
            # Should have broadcast: 1) live game_update + 2) scoreboard_update
            assert mock_broadcast.call_count == 2
            # First call: per-game live update
            mock_broadcast.assert_any_call(
                "401810099",
                {"type": "game_update", "data": mock_broadcast.call_args_list[0][0][1]["data"]},
            )
            # Second call: scoreboard-wide update
            mock_broadcast.assert_any_call(
                "scoreboard",
                {
                    "type": "scoreboard_update",
                    "data": mock_broadcast.call_args_list[1][0][1]["data"],
                },
            )

    async def test_final_game_skips_live_broadcast_mixed_with_unparseable(self, session_factory):
        """Two events: one unparseable (dropped, line 129) and one FINAL
        game. Since status isn't live/halftime, the per-game cache/broadcast
        block is skipped (168->126) — only the scoreboard-wide broadcast
        fires."""
        unparseable_event = {"id": "bad", "competitions": [{"competitors": []}]}
        final_event = {
            "id": "401810100",
            "competitions": [
                {
                    "competitors": [
                        {"team": {"abbreviation": "BOS"}, "homeAway": "home", "score": "110"},
                        {"team": {"abbreviation": "LAL"}, "homeAway": "away", "score": "105"},
                    ],
                    "date": "2026-02-20T00:30:00Z",
                    "venue": {"fullName": "TD Garden"},
                }
            ],
            "status": {"type": {"state": "post", "description": ""}, "period": 4},
        }

        from src.db.models import Team

        async with session_factory() as sess:
            sess.add_all(
                [
                    Team(abbrev="BOS", name="Boston Celtics"),
                    Team(abbrev="LAL", name="Los Angeles Lakers"),
                ]
            )
            await sess.commit()

        mock_broadcast = AsyncMock()
        mock_cache_state = AsyncMock()
        with (
            patch("src.services.scoreboard_poller.espn_client") as mock_espn,
            patch(
                "src.services.scoreboard_poller.get_session_factory", return_value=session_factory
            ),
            patch("src.services.scoreboard_poller.cache_game_list", new_callable=AsyncMock),
            patch("src.services.scoreboard_poller.cache_game_state", mock_cache_state),
            patch("src.services.scoreboard_poller.manager") as mock_mgr,
        ):
            mock_espn.get_scoreboard = AsyncMock(
                return_value={"events": [unparseable_event, final_event]}
            )
            mock_mgr.broadcast = mock_broadcast
            await _poll_scoreboard()

            # Only the scoreboard-wide broadcast — no per-game live update.
            assert mock_broadcast.call_count == 1
            call_args, call_kwargs = mock_broadcast.call_args
            assert call_args[0] == "scoreboard"
            message = call_args[1]
            assert message["type"] == "scoreboard_update"
            rows = message["data"]
            # Only the parseable, final game made it into rows — the
            # unparseable event was dropped (line 129).
            assert len(rows) == 1
            row = rows[0]
            assert row["id"] == "401810100"
            assert row["status"] == "final"
            assert row["home_team"] == "BOS"
            assert row["away_team"] == "LAL"
            assert row["home_score"] == 110
            assert row["away_score"] == 105
            assert row["venue"] == "TD Garden"
            mock_cache_state.assert_not_called()

    async def test_all_events_unparseable_skips_final_broadcast(self, session_factory):
        """Every event fails to parse: rows stays empty, so the trailing
        `if rows:` block (cache_game_list + scoreboard broadcast) never
        runs at all (181->exit)."""
        unparseable_event = {"id": "bad", "competitions": [{"competitors": []}]}

        mock_broadcast = AsyncMock()
        mock_cache_list = AsyncMock()
        with (
            patch("src.services.scoreboard_poller.espn_client") as mock_espn,
            patch(
                "src.services.scoreboard_poller.get_session_factory", return_value=session_factory
            ),
            patch("src.services.scoreboard_poller.cache_game_list", mock_cache_list),
            patch("src.services.scoreboard_poller.cache_game_state", new_callable=AsyncMock),
            patch("src.services.scoreboard_poller.manager") as mock_mgr,
        ):
            mock_espn.get_scoreboard = AsyncMock(return_value={"events": [unparseable_event]})
            mock_mgr.broadcast = mock_broadcast
            await _poll_scoreboard()

            mock_broadcast.assert_not_called()
            mock_cache_list.assert_not_called()


@pytest.mark.asyncio
class TestRunScoreboardPoller:
    async def test_runs_and_stops(self):
        call_count = 0

        async def limited_sleep(seconds):
            nonlocal call_count
            call_count += 1
            if call_count >= 1:
                raise asyncio.CancelledError()

        with (
            patch("src.services.scoreboard_poller._poll_scoreboard", new_callable=AsyncMock),
            patch("src.services.scoreboard_poller.asyncio.sleep", side_effect=limited_sleep),
        ):
            with pytest.raises(asyncio.CancelledError):
                await run_scoreboard_poller()

    async def test_continues_on_error(self):
        call_count = 0

        async def limited_sleep(seconds):
            nonlocal call_count
            call_count += 1
            if call_count >= 2:
                raise asyncio.CancelledError()

        with (
            patch(
                "src.services.scoreboard_poller._poll_scoreboard",
                new_callable=AsyncMock,
                side_effect=Exception("boom"),
            ),
            patch("src.services.scoreboard_poller.asyncio.sleep", side_effect=limited_sleep),
        ):
            with pytest.raises(asyncio.CancelledError):
                await run_scoreboard_poller()
