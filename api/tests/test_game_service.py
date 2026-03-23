"""Tests for game_service — game queries, ESPN parsing, caching."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.db.models import Game, Team
from src.services.game_service import (
    _fetch_and_upsert_espn,
    _game_to_dict,
    _query_pg,
    get_game,
    get_games,
)


@pytest.fixture
async def game_session(session):
    """Session with teams and games for game_service tests."""
    session.add_all(
        [
            Team(abbrev="BOS", name="Boston Celtics"),
            Team(abbrev="LAL", name="Los Angeles Lakers"),
        ]
    )
    await session.flush()

    # 7:30pm ET on Feb 17 = Feb 18 00:30 UTC
    session.add_all(
        [
            Game(
                id="g1",
                home_team="BOS",
                away_team="LAL",
                status="final",
                home_score=110,
                away_score=105,
                quarter=4,
                clock="0:00",
                start_time=datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc),
                venue="TD Garden",
            ),
            Game(
                id="g2",
                home_team="LAL",
                away_team="BOS",
                status="live",
                home_score=55,
                away_score=48,
                quarter=3,
                clock="5:00",
                start_time=datetime(2026, 2, 20, 3, 0, tzinfo=timezone.utc),
                venue="Crypto.com Arena",
            ),
            Game(
                id="g3",
                home_team="BOS",
                away_team="LAL",
                status="halftime",
                home_score=60,
                away_score=58,
                quarter=2,
                clock="0:00",
                start_time=datetime(2026, 2, 20, 1, 0, tzinfo=timezone.utc),
                venue="TD Garden",
            ),
        ]
    )
    await session.commit()
    return session


# ── Helper to build an ESPN event dict ────────────────────────────────


def _make_espn_event(
    *,
    game_id="401610001",
    home_abbrev="BOS",
    away_abbrev="LAL",
    home_score="110",
    away_score="105",
    state="post",
    description="Final",
    start_date="2026-02-18T00:30Z",
    venue="TD Garden",
    period=4,
    display_clock="0:00",
):
    """Build a realistic ESPN scoreboard event dict."""
    return {
        "id": game_id,
        "date": start_date,
        "competitions": [
            {
                "date": start_date,
                "competitors": [
                    {
                        "homeAway": "home",
                        "team": {"abbreviation": home_abbrev},
                        "score": home_score,
                    },
                    {
                        "homeAway": "away",
                        "team": {"abbreviation": away_abbrev},
                        "score": away_score,
                    },
                ],
                "venue": {"fullName": venue},
            }
        ],
        "status": {
            "type": {"state": state, "description": description},
            "period": period,
            "displayClock": display_clock,
        },
    }


# ── get_games ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestGetGames:
    async def test_returns_games_for_date(self, game_session):
        with (
            patch(
                "src.services.game_service.get_cached_game_list",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_list", new_callable=AsyncMock),
            patch("src.services.game_service.espn_client") as mock_espn,
        ):
            mock_espn.get_scoreboard = AsyncMock(return_value=None)
            games = await get_games(game_session, date(2026, 2, 17))
            assert len(games) == 1
            assert games[0]["id"] == "g1"

    async def test_returns_cached(self, game_session):
        cached = [{"id": "cached_game", "status": "live"}]
        with patch(
            "src.services.game_service.get_cached_game_list",
            new_callable=AsyncMock,
            return_value=cached,
        ):
            games = await get_games(game_session, date(2026, 2, 17))
            assert games == cached

    async def test_empty_date(self, game_session):
        with (
            patch(
                "src.services.game_service.get_cached_game_list",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_list", new_callable=AsyncMock),
            patch("src.services.game_service.espn_client") as mock_espn,
        ):
            mock_espn.get_scoreboard = AsyncMock(return_value=None)
            games = await get_games(game_session, date(2020, 1, 1))
            assert games == []

    async def test_today_date_fetches_espn_first(self, game_session):
        """For today's date, ESPN is tried first, then PG fallback."""
        today = date.today()
        espn_event = _make_espn_event(game_id="espn_today", state="pre", description="Scheduled")

        mock_espn = MagicMock()
        mock_espn.get_scoreboard = AsyncMock(return_value={"events": [espn_event]})

        with (
            patch(
                "src.services.game_service.get_cached_game_list",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "src.services.game_service.cache_game_list",
                new_callable=AsyncMock,
            ) as mock_cache,
            patch("src.services.game_service.espn_client", mock_espn),
            patch("src.services.game_service.date", wraps=date) as mock_date,
        ):
            # Make date.today() return our target date
            mock_date.today = MagicMock(return_value=today)

            games = await get_games(game_session, today)
            # ESPN was called
            mock_espn.get_scoreboard.assert_called_once()
            assert len(games) >= 1
            # Cache was populated
            mock_cache.assert_called_once()

    async def test_today_date_espn_empty_falls_back_to_pg(self, game_session):
        """For today's date, if ESPN returns empty, PG is queried."""
        # Insert a game for 'today' in the ET window so PG finds it
        today = date.today()
        et_offset = timedelta(hours=5)
        start = datetime.combine(today, time(23, 0), tzinfo=timezone.utc) + et_offset

        game_session.add(
            Game(
                id="pg_today",
                home_team="BOS",
                away_team="LAL",
                status="scheduled",
                start_time=start,
                venue="TD Garden",
            )
        )
        await game_session.commit()

        mock_espn = MagicMock()
        mock_espn.get_scoreboard = AsyncMock(return_value=None)

        with (
            patch(
                "src.services.game_service.get_cached_game_list",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_list", new_callable=AsyncMock),
            patch("src.services.game_service.espn_client", mock_espn),
            patch("src.services.game_service.date", wraps=date) as mock_date,
        ):
            mock_date.today = MagicMock(return_value=today)
            games = await get_games(game_session, today)
            # ESPN returned nothing, PG fallback found the game
            assert any(g["id"] == "pg_today" for g in games)

    async def test_non_today_pg_miss_triggers_espn(self, game_session):
        """For a non-today date with no PG data, ESPN is fetched."""
        target = date(2030, 6, 15)  # Far future, no PG data
        espn_event = _make_espn_event(
            game_id="espn_fallback",
            state="post",
            description="Final",
            start_date="2030-06-15T23:00Z",
        )

        mock_espn = MagicMock()
        mock_espn.get_scoreboard = AsyncMock(return_value={"events": [espn_event]})

        with (
            patch(
                "src.services.game_service.get_cached_game_list",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_list", new_callable=AsyncMock),
            patch("src.services.game_service.espn_client", mock_espn),
        ):
            games = await get_games(game_session, target)
            mock_espn.get_scoreboard.assert_called_once()
            assert len(games) == 1
            assert games[0]["id"] == "espn_fallback"

    async def test_defaults_to_eastern_date_when_none(self, game_session):
        """When game_date is None, defaults to current ET date."""
        with (
            patch(
                "src.services.game_service.get_cached_game_list",
                new_callable=AsyncMock,
                return_value=[{"id": "default_date"}],
            ),
        ):
            games = await get_games(game_session, None)
            assert games == [{"id": "default_date"}]

    async def test_no_cache_set_when_empty_result(self, game_session):
        """Cache should NOT be populated when result is empty."""
        mock_cache = AsyncMock()
        with (
            patch(
                "src.services.game_service.get_cached_game_list",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_list", mock_cache),
            patch("src.services.game_service.espn_client") as mock_espn,
        ):
            mock_espn.get_scoreboard = AsyncMock(return_value=None)
            games = await get_games(game_session, date(2099, 1, 1))
            assert games == []
            mock_cache.assert_not_called()


# ── get_game ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestGetGame:
    async def test_returns_game(self, game_session):
        with (
            patch(
                "src.services.game_service.get_cached_game_state",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_state", new_callable=AsyncMock),
        ):
            game = await get_game(game_session, "g2")
            assert game is not None
            assert game["id"] == "g2"
            assert game["status"] == "live"

    async def test_returns_none_for_missing(self, game_session):
        with patch(
            "src.services.game_service.get_cached_game_state",
            new_callable=AsyncMock,
            return_value=None,
        ):
            game = await get_game(game_session, "nonexistent")
            assert game is None

    async def test_returns_cached_state(self, game_session):
        cached = {"id": "g1", "status": "final", "home_score": 999}
        with patch(
            "src.services.game_service.get_cached_game_state",
            new_callable=AsyncMock,
            return_value=cached,
        ):
            game = await get_game(game_session, "g1")
            assert game["home_score"] == 999

    async def test_caches_live_game(self, game_session):
        mock_cache = AsyncMock()
        with (
            patch(
                "src.services.game_service.get_cached_game_state",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_state", mock_cache),
        ):
            game = await get_game(game_session, "g2")
            assert game["status"] == "live"
            mock_cache.assert_called_once()

    async def test_caches_halftime_game(self, game_session):
        """Games with status 'halftime' should also be cached."""
        mock_cache = AsyncMock()
        with (
            patch(
                "src.services.game_service.get_cached_game_state",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_state", mock_cache),
        ):
            game = await get_game(game_session, "g3")
            assert game is not None
            assert game["status"] == "halftime"
            mock_cache.assert_called_once_with("g3", game)

    async def test_does_not_cache_final_game(self, game_session):
        """Games with status 'final' should NOT be cached."""
        mock_cache = AsyncMock()
        with (
            patch(
                "src.services.game_service.get_cached_game_state",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_state", mock_cache),
        ):
            game = await get_game(game_session, "g1")
            assert game is not None
            assert game["status"] == "final"
            mock_cache.assert_not_called()

    async def test_does_not_cache_scheduled_game(self, game_session):
        """Games with status 'scheduled' should NOT be cached."""
        game_session.add(
            Game(
                id="g_sched",
                home_team="BOS",
                away_team="LAL",
                status="scheduled",
                start_time=datetime(2026, 3, 1, 0, 30, tzinfo=timezone.utc),
                venue="TD Garden",
            )
        )
        await game_session.commit()

        mock_cache = AsyncMock()
        with (
            patch(
                "src.services.game_service.get_cached_game_state",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_state", mock_cache),
        ):
            game = await get_game(game_session, "g_sched")
            assert game is not None
            assert game["status"] == "scheduled"
            mock_cache.assert_not_called()

    async def test_get_game_pg_returns_none_mocked(self):
        """Directly test the None return path using a mocked session."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch(
            "src.services.game_service.get_cached_game_state",
            new_callable=AsyncMock,
            return_value=None,
        ):
            result = await get_game(mock_session, "does_not_exist")
            assert result is None

    async def test_get_game_pg_caches_live_mocked(self):
        """Directly test the cache path for a live game using a mocked session."""
        mock_game = MagicMock(spec=Game)
        mock_game.id = "live_mock"
        mock_game.home_team = "BOS"
        mock_game.away_team = "LAL"
        mock_game.home_score = 60
        mock_game.away_score = 55
        mock_game.status = "live"
        mock_game.quarter = 3
        mock_game.clock = "4:00"
        mock_game.start_time = datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc)
        mock_game.venue = "TD Garden"
        mock_game.updated_at = None
        mock_game.home_team_ref = None
        mock_game.away_team_ref = None

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_game
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_cache = AsyncMock()
        with (
            patch(
                "src.services.game_service.get_cached_game_state",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("src.services.game_service.cache_game_state", mock_cache),
        ):
            result = await get_game(mock_session, "live_mock")
            assert result is not None
            assert result["id"] == "live_mock"
            assert result["status"] == "live"
            mock_cache.assert_called_once_with("live_mock", result)


# ── _query_pg ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestQueryPg:
    async def test_finds_game_in_window(self, game_session):
        # Feb 17 ET window: Feb 17 05:00 UTC to Feb 18 04:59 UTC
        # Game g1 start: Feb 18 00:30 UTC — should be in window
        rows = await _query_pg(game_session, date(2026, 2, 17))
        assert len(rows) == 1
        assert rows[0]["id"] == "g1"

    async def test_no_games_outside_window(self, game_session):
        rows = await _query_pg(game_session, date(2020, 1, 1))
        assert rows == []

    async def test_different_date(self, game_session):
        # Game g2: Feb 20 03:00 UTC = Feb 19 10pm ET -> Feb 19 ET
        rows = await _query_pg(game_session, date(2026, 2, 19))
        assert len(rows) >= 1
        game_ids = [r["id"] for r in rows]
        assert "g2" in game_ids

    async def test_returns_dict_with_all_fields(self, game_session):
        rows = await _query_pg(game_session, date(2026, 2, 17))
        assert len(rows) == 1
        row = rows[0]
        assert row["id"] == "g1"
        assert row["home_team"] == "BOS"
        assert row["away_team"] == "LAL"
        assert row["home_score"] == 110
        assert row["away_score"] == 105
        assert row["status"] == "final"
        assert row["quarter"] == 4
        assert row["clock"] == "0:00"
        assert row["venue"] == "TD Garden"
        assert row["start_time"] is not None

    async def test_orders_by_start_time(self, game_session):
        """Games returned should be ordered by start_time."""
        rows = await _query_pg(game_session, date(2026, 2, 19))
        if len(rows) > 1:
            for i in range(len(rows) - 1):
                assert rows[i]["start_time"] <= rows[i + 1]["start_time"]

    async def test_multiple_games_same_date(self, game_session):
        """Feb 19 ET window should contain both g2 and g3."""
        rows = await _query_pg(game_session, date(2026, 2, 19))
        game_ids = {r["id"] for r in rows}
        assert "g2" in game_ids
        assert "g3" in game_ids


# ── _fetch_and_upsert_espn ────────────────────────────────────────────


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

    async def test_skips_bad_competitors_count(self, session):
        """Events with != 2 competitors are skipped."""
        bad_event = {
            "id": "999",
            "competitions": [{"competitors": [{"team": {"abbreviation": "BOS"}}]}],
            "status": {"type": {"state": "pre"}},
        }
        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [bad_event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 20))
            assert result == []

    async def test_parses_final_game(self, session):
        """A post-state game should be parsed as 'final'."""
        # Need teams in DB for foreign key
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        event = _make_espn_event(
            game_id="401610001",
            home_abbrev="BOS",
            away_abbrev="LAL",
            home_score="110",
            away_score="105",
            state="post",
            description="Final",
            start_date="2026-02-18T00:30Z",
            venue="TD Garden",
        )

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 1
        row = result[0]
        assert row["id"] == "401610001"
        assert row["status"] == "final"
        assert row["home_team"] == "BOS"
        assert row["away_team"] == "LAL"
        assert row["home_score"] == 110
        assert row["away_score"] == 105
        assert row["venue"] == "TD Garden"
        assert row["quarter"] is None  # final games don't set quarter
        assert row["clock"] is None

    async def test_parses_live_game(self, session):
        """An in-progress game should be parsed as 'live'."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        event = _make_espn_event(
            game_id="401610002",
            home_abbrev="BOS",
            away_abbrev="LAL",
            home_score="55",
            away_score="48",
            state="in",
            description="In Progress",
            period=3,
            display_clock="5:30",
        )

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 1
        row = result[0]
        assert row["status"] == "live"
        assert row["quarter"] == 3
        assert row["clock"] == "5:30"
        assert row["home_score"] == 55
        assert row["away_score"] == 48

    async def test_parses_halftime_game(self, session):
        """A game at halftime should be parsed as 'halftime'."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        event = _make_espn_event(
            game_id="401610003",
            state="in",
            description="Halftime",
            period=2,
            display_clock="0:00",
        )

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 1
        assert result[0]["status"] == "halftime"
        assert result[0]["quarter"] == 2

    async def test_parses_scheduled_game(self, session):
        """A pre-state game should be parsed as 'scheduled'."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        event = _make_espn_event(
            game_id="401610004",
            home_score="0",
            away_score="0",
            state="pre",
            description="Scheduled",
        )

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 1
        assert result[0]["status"] == "scheduled"
        assert result[0]["home_score"] == 0
        assert result[0]["away_score"] == 0
        assert result[0]["quarter"] is None
        assert result[0]["clock"] is None

    async def test_parses_multiple_events(self, session):
        """Multiple events in a single scoreboard response."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
                Team(abbrev="MIA", name="Miami Heat"),
                Team(abbrev="CHI", name="Chicago Bulls"),
            ]
        )
        await session.flush()

        event1 = _make_espn_event(game_id="multi_1")
        event2 = _make_espn_event(
            game_id="multi_2",
            home_abbrev="MIA",
            away_abbrev="CHI",
            home_score="90",
            away_score="88",
        )

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event1, event2]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 2
        ids = {r["id"] for r in result}
        assert ids == {"multi_1", "multi_2"}

    async def test_skips_missing_home_team(self, session):
        """Events where home team can't be determined are skipped."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        # Both competitors marked as 'away'
        event = {
            "id": "no_home",
            "competitions": [
                {
                    "date": "2026-02-18T00:30Z",
                    "competitors": [
                        {
                            "homeAway": "away",
                            "team": {"abbreviation": "BOS"},
                            "score": "50",
                        },
                        {
                            "homeAway": "away",
                            "team": {"abbreviation": "LAL"},
                            "score": "48",
                        },
                    ],
                    "venue": {"fullName": "Arena"},
                }
            ],
            "status": {"type": {"state": "pre"}},
        }

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert result == []

    async def test_skips_missing_away_team(self, session):
        """Events where away team can't be determined are skipped."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        # Both competitors marked as 'home'
        event = {
            "id": "no_away",
            "competitions": [
                {
                    "date": "2026-02-18T00:30Z",
                    "competitors": [
                        {
                            "homeAway": "home",
                            "team": {"abbreviation": "BOS"},
                            "score": "50",
                        },
                        {
                            "homeAway": "home",
                            "team": {"abbreviation": "LAL"},
                            "score": "48",
                        },
                    ],
                    "venue": {"fullName": "Arena"},
                }
            ],
            "status": {"type": {"state": "pre"}},
        }

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert result == []

    async def test_handles_null_score(self, session):
        """Score can be None or empty string — should default to 0."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        event = _make_espn_event(
            game_id="null_score",
            home_score="",
            away_score=None,
            state="pre",
        )
        # Override score values in competitors directly for the None case
        event["competitions"][0]["competitors"][1]["score"] = None

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 1
        assert result[0]["home_score"] == 0
        assert result[0]["away_score"] == 0

    async def test_date_format_passed_to_espn(self, session):
        """ESPN receives date in YYYYMMDD format."""
        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value=None)
            await _fetch_and_upsert_espn(session, date(2026, 3, 15))
            mock.get_scoreboard.assert_called_once_with("20260315")

    async def test_event_with_no_venue(self, session):
        """Events without venue info should still parse."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        event = _make_espn_event(game_id="no_venue", state="pre")
        # Remove venue from competition
        event["competitions"][0].pop("venue", None)

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 1
        assert result[0]["venue"] == ""

    async def test_event_with_no_date_uses_event_date(self, session):
        """When competition has no date, falls back to event date."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        event = _make_espn_event(game_id="fallback_date", state="pre")
        # Remove date from competition but keep event-level date
        del event["competitions"][0]["date"]

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 1
        assert result[0]["start_time"] is not None

    async def test_event_with_no_date_at_all(self, session):
        """When neither competition nor event has a date, use now()."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        event = _make_espn_event(game_id="no_date_at_all", state="pre")
        del event["competitions"][0]["date"]
        del event["date"]

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 1
        # start_time should still be a valid ISO string
        assert result[0]["start_time"] is not None

    async def test_error_in_one_event_skips_it(self, session):
        """An exception parsing one event shouldn't crash the whole batch."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        # First event is malformed (missing 'id' key to trigger KeyError)
        bad_event = {"competitions": []}
        good_event = _make_espn_event(game_id="good_after_bad", state="pre")

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [bad_event, good_event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        # Bad event skipped, good event parsed
        assert len(result) == 1
        assert result[0]["id"] == "good_after_bad"

    async def test_upsert_updates_existing_game(self, session):
        """Upserting a game that already exists should update scores."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        # Insert initial game
        session.add(
            Game(
                id="upsert_test",
                home_team="BOS",
                away_team="LAL",
                status="scheduled",
                home_score=0,
                away_score=0,
                start_time=datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc),
                venue="TD Garden",
            )
        )
        await session.commit()

        # ESPN returns updated scores
        event = _make_espn_event(
            game_id="upsert_test",
            home_score="85",
            away_score="79",
            state="in",
            description="In Progress",
            period=3,
            display_clock="4:00",
        )

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 1
        assert result[0]["home_score"] == 85
        assert result[0]["away_score"] == 79
        assert result[0]["status"] == "live"

    async def test_espn_abbreviation_mapping(self, session):
        """ESPN abbreviations like UTAH should be mapped to PBP format."""
        session.add_all(
            [
                Team(abbrev="UTA", name="Utah Jazz"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        event = _make_espn_event(
            game_id="abbrev_map",
            home_abbrev="UTAH",  # ESPN uses UTAH
            away_abbrev="LAL",
            state="pre",
        )

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 1
        assert result[0]["home_team"] == "UTA"  # Mapped from UTAH

    async def test_start_time_iso_format_in_result(self, session):
        """start_time in result should be ISO format string."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        event = _make_espn_event(
            game_id="iso_test",
            start_date="2026-02-18T00:30Z",
            state="pre",
        )

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert len(result) == 1
        assert "2026-02-18" in result[0]["start_time"]

    async def test_updated_at_is_none_in_result(self, session):
        """ESPN-parsed results should have updated_at=None."""
        session.add_all(
            [
                Team(abbrev="BOS", name="Boston Celtics"),
                Team(abbrev="LAL", name="Los Angeles Lakers"),
            ]
        )
        await session.flush()

        event = _make_espn_event(game_id="updated_at_test", state="pre")

        with patch("src.services.game_service.espn_client") as mock:
            mock.get_scoreboard = AsyncMock(return_value={"events": [event]})
            result = await _fetch_and_upsert_espn(session, date(2026, 2, 17))

        assert result[0]["updated_at"] is None


# ── _game_to_dict ─────────────────────────────────────────────────────


class TestGameToDict:
    def test_basic_dict(self):
        game = Game(
            id="g1",
            home_team="BOS",
            away_team="LAL",
            status="live",
            home_score=55,
            away_score=48,
            quarter=3,
            clock="8:30",
            start_time=datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc),
            venue="TD Garden",
        )
        d = _game_to_dict(game)
        assert d["id"] == "g1"
        assert d["home_team"] == "BOS"
        assert d["away_team"] == "LAL"
        assert d["home_score"] == 55
        assert d["away_score"] == 48
        assert d["status"] == "live"
        assert d["quarter"] == 3
        assert d["clock"] == "8:30"
        assert "2026-02-18" in d["start_time"]
        assert d["venue"] == "TD Garden"

    def test_none_start_time(self):
        game = Game(
            id="g2",
            home_team="BOS",
            away_team="LAL",
            status="scheduled",
            start_time=None,
        )
        d = _game_to_dict(game)
        assert d["start_time"] is None

    def test_none_updated_at(self):
        game = Game(
            id="g3",
            home_team="BOS",
            away_team="LAL",
            status="scheduled",
            start_time=datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc),
            updated_at=None,
        )
        d = _game_to_dict(game)
        assert d["updated_at"] is None

    def test_with_updated_at(self):
        ts = datetime(2026, 2, 18, 1, 0, tzinfo=timezone.utc)
        game = Game(
            id="g4",
            home_team="BOS",
            away_team="LAL",
            status="live",
            start_time=datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc),
            updated_at=ts,
        )
        d = _game_to_dict(game)
        assert d["updated_at"] == ts.isoformat()

    def test_with_team_refs(self):
        """When team relationships are loaded, full names are included."""
        game = Game(
            id="g5",
            home_team="BOS",
            away_team="LAL",
            status="live",
            start_time=datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc),
        )
        game.home_team_ref = Team(abbrev="BOS", name="Boston Celtics")
        game.away_team_ref = Team(abbrev="LAL", name="Los Angeles Lakers")

        d = _game_to_dict(game)
        assert d["home_team_full"] == "Boston Celtics"
        assert d["away_team_full"] == "Los Angeles Lakers"

    def test_without_team_refs(self):
        """When team relationships are None, no full name keys are added."""
        game = Game(
            id="g6",
            home_team="BOS",
            away_team="LAL",
            status="live",
            start_time=datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc),
        )
        game.home_team_ref = None
        game.away_team_ref = None

        d = _game_to_dict(game)
        assert "home_team_full" not in d
        assert "away_team_full" not in d

    def test_partial_team_refs(self):
        """Only one team relationship loaded."""
        game = Game(
            id="g7",
            home_team="BOS",
            away_team="LAL",
            status="live",
            start_time=datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc),
        )
        game.home_team_ref = Team(abbrev="BOS", name="Boston Celtics")
        game.away_team_ref = None

        d = _game_to_dict(game)
        assert d["home_team_full"] == "Boston Celtics"
        assert "away_team_full" not in d
