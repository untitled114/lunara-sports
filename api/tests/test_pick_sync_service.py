"""Tests for pick_sync_service — file finding, pick parsing, field mapping,
game matching, and full sync orchestration."""

from __future__ import annotations

import json
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.pick_sync_service import (
    _parse_picks,
    fetch_picks_from_api,
    find_picks_file,
    match_picks_to_games,
    sync_picks,
)


# ---------------------------------------------------------------------------
# Helper: build a fake Game object for match_picks_to_games tests.
# We mock the session rather than using SQLite (which mishandles tz datetimes).
# ---------------------------------------------------------------------------
def _fake_game(game_id: str, home: str, away: str) -> MagicMock:
    g = MagicMock()
    g.id = game_id
    g.home_team = home
    g.away_team = away
    return g


def _mock_session_with_games(games: list) -> AsyncMock:
    """Return an AsyncSession mock whose execute() returns the given games."""
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = games

    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars

    session = AsyncMock()
    session.execute = AsyncMock(return_value=mock_result)
    return session


# ---------------------------------------------------------------------------
# TestFindPicksFile — file-based pick discovery
# ---------------------------------------------------------------------------
class TestFindPicksFile:
    def test_iso_date_format(self, tmp_path):
        p = tmp_path / "xl_picks_2026-02-20.json"
        p.write_text("[]")
        result = find_picks_file(str(tmp_path), date(2026, 2, 20))
        assert result == p

    def test_compact_date_format(self, tmp_path):
        p = tmp_path / "xl_picks_20260220.json"
        p.write_text("[]")
        result = find_picks_file(str(tmp_path), date(2026, 2, 20))
        assert result == p

    def test_iso_preferred_over_compact(self, tmp_path):
        iso = tmp_path / "xl_picks_2026-02-20.json"
        iso.write_text("[]")
        compact = tmp_path / "xl_picks_20260220.json"
        compact.write_text("[]")
        result = find_picks_file(str(tmp_path), date(2026, 2, 20))
        assert result == iso

    def test_returns_none_for_missing_file(self, tmp_path):
        result = find_picks_file(str(tmp_path), date(2026, 1, 1))
        assert result is None

    def test_returns_none_for_invalid_directory(self):
        result = find_picks_file("/nonexistent/path", date(2026, 1, 1))
        assert result is None


# ---------------------------------------------------------------------------
# TestParsePicks — raw Sport-suite JSON -> normalised row dicts
# ---------------------------------------------------------------------------
class TestParsePicks:
    def test_basic_pick_parsing(self):
        raw = [
            {
                "player_name": "LeBron James",
                "team": "LAL",
                "stat_type": "POINTS",
                "side": "OVER",
                "softest_line": 24.5,
                "softest_book": "DraftKings",
                "tier": "X",
                "edge_pct": 8.5,
                "line": 25.0,
                "model_version": "xl",
                "p_over": 0.85,
                "edge": 4.5,
                "reasoning": "Strong matchup",
                "confidence": "high",
                "line_spread": 2.5,
                "opponent_team": "WAS",
                "is_home": True,
            }
        ]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert len(picks) == 1
        p = picks[0]
        assert p["player_name"] == "LeBron James"
        assert p["team"] == "LAL"
        assert p["market"] == "POINTS"
        assert p["prediction"] == "OVER"
        assert p["line"] == 24.5
        assert p["book"] == "DraftKings"
        assert p["tier"] == "X"
        assert p["edge_pct"] == 8.5
        assert p["consensus_line"] == 25.0
        assert p["model_version"] == "xl"
        assert p["p_over"] == 0.85
        assert p["edge"] == 4.5
        assert p["reasoning"] == "Strong matchup"
        assert p["confidence"] == "high"
        assert p["line_spread"] == 2.5
        assert p["game_date"] == date(2026, 2, 20)
        assert p["is_home"] is True

    def test_sport_suite_abbrev_mapping(self):
        raw = [{"team": "GSW", "opponent_team": "WAS", "player_name": "Curry"}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["team"] == "GS"
        assert picks[0]["opponent_team"] == "WSH"

    def test_missing_team_defaults_to_empty(self):
        raw = [{"player_name": "Test", "opponent_team": "BOS"}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["team"] == ""

    def test_numeric_conversion(self):
        raw = [
            {
                "player_name": "Test",
                "softest_line": "22.5",
                "edge_pct": "8.0",
                "p_over": "0.85",
                "edge": "4.5",
                "line": "23.0",
                "line_spread": "2.0",
            }
        ]
        picks = _parse_picks(raw, date(2026, 2, 20))
        p = picks[0]
        assert p["line"] == 22.5
        assert p["edge_pct"] == 8.0
        assert p["p_over"] == 0.85

    def test_invalid_numeric_becomes_none(self):
        raw = [
            {
                "player_name": "Test",
                "softest_line": "invalid",
            }
        ]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["line"] is None

    def test_player_name_fallback_to_player_key(self):
        raw = [{"player": "Fallback Player"}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["player_name"] == "Fallback Player"

    def test_empty_raw_returns_empty(self):
        assert _parse_picks([], date(2026, 2, 20)) == []

    def test_multiple_picks(self):
        raw = [
            {"player_name": "A", "team": "BOS"},
            {"player_name": "B", "team": "LAL"},
            {"player_name": "C", "team": "NYK"},
        ]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert len(picks) == 3
        assert picks[2]["team"] == "NY"  # NYK -> NY mapping

    def test_sport_suite_id_captured(self):
        raw = [{"player_name": "Test", "id": "uuid-abc-123"}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["sport_suite_id"] == "uuid-abc-123"

    def test_sport_suite_id_none_when_absent(self):
        raw = [{"player_name": "Test"}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["sport_suite_id"] is None

    # ---- Goldmine / fallback field mapping ---------------------------------
    def test_goldmine_fallback_filter_tier(self):
        """Goldmine picks use filter_tier instead of tier."""
        raw = [{"player_name": "Test", "filter_tier": "META"}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["tier"] == "META"

    def test_goldmine_fallback_best_line(self):
        """Goldmine picks use best_line instead of softest_line."""
        raw = [{"player_name": "Test", "best_line": 22.5}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["line"] == 22.5

    def test_goldmine_fallback_best_book(self):
        """Goldmine picks use best_book instead of softest_book."""
        raw = [{"player_name": "Test", "best_book": "FanDuel"}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["book"] == "FanDuel"

    def test_goldmine_fallback_does_not_override_primary(self):
        """When both primary and fallback fields exist, primary wins."""
        raw = [
            {
                "player_name": "Test",
                "tier": "X",
                "filter_tier": "META",
                "softest_line": 24.5,
                "best_line": 22.5,
                "softest_book": "DraftKings",
                "best_book": "FanDuel",
            }
        ]
        picks = _parse_picks(raw, date(2026, 2, 20))
        p = picks[0]
        assert p["tier"] == "X"  # primary wins
        assert p["line"] == 24.5  # primary wins
        assert p["book"] == "DraftKings"  # primary wins

    def test_goldmine_fallback_skips_none_values(self):
        """Fallback fields with None value should not override."""
        raw = [{"player_name": "Test", "filter_tier": None}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert "tier" not in picks[0] or picks[0].get("tier") is None

    def test_rolling_stats_and_injury_status(self):
        """Enrichment fields from Phase 3 are captured."""
        raw = [
            {
                "player_name": "Test",
                "rolling_stats": {"ppg_L5": 25.0},
                "injury_status": "Probable",
            }
        ]
        picks = _parse_picks(raw, date(2026, 2, 20))
        assert picks[0]["rolling_stats"] == {"ppg_L5": 25.0}
        assert picks[0]["injury_status"] == "Probable"

    def test_all_sport_suite_abbreviation_mappings(self):
        """Cover all abbreviation mappings (GSW, WAS, NYK, NOP, NOR, SAS, PHO, UTH)."""
        mappings = [
            ("GSW", "GS"),
            ("WAS", "WSH"),
            ("NYK", "NY"),
            ("NOP", "NO"),
            ("NOR", "NO"),
            ("SAS", "SA"),
            ("PHO", "PHX"),
            ("UTH", "UTA"),
        ]
        for ss_abbrev, expected_pbp in mappings:
            raw = [{"player_name": "Test", "team": ss_abbrev}]
            picks = _parse_picks(raw, date(2026, 1, 1))
            assert picks[0]["team"] == expected_pbp, f"{ss_abbrev} should map to {expected_pbp}"

    def test_unmapped_team_passes_through(self):
        """Teams not in the mapping dict pass through unchanged."""
        raw = [{"player_name": "Test", "team": "BOS", "opponent_team": "LAL"}]
        picks = _parse_picks(raw, date(2026, 1, 1))
        assert picks[0]["team"] == "BOS"
        assert picks[0]["opponent_team"] == "LAL"

    def test_numeric_field_with_none_value(self):
        """Numeric fields that are explicitly None stay None."""
        raw = [{"player_name": "Test", "softest_line": None}]
        picks = _parse_picks(raw, date(2026, 2, 20))
        # line mapped from softest_line; None stays None (no conversion attempted)
        assert picks[0].get("line") is None


# ---------------------------------------------------------------------------
# TestFetchPicksFromApi — HTTP fetch from Sport-Suite API
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestFetchPicksFromApi:
    async def test_returns_picks_on_success(self):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "picks": [{"player_name": "LeBron James", "id": "uuid-1"}]
        }
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("src.services.pick_sync_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await fetch_picks_from_api(
                "https://api.sport-suite.internal", "key-123", date(2026, 3, 8)
            )

        assert len(result) == 1
        assert result[0]["player_name"] == "LeBron James"

    async def test_returns_empty_on_http_error(self):
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=Exception("connection refused"))

        with patch("src.services.pick_sync_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await fetch_picks_from_api(
                "https://api.sport-suite.internal", "key-123", date(2026, 3, 8)
            )

        assert result == []

    async def test_url_trailing_slash_stripped(self):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"picks": []}
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("src.services.pick_sync_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            await fetch_picks_from_api(
                "https://api.sport-suite.internal/", "key-123", date(2026, 3, 8)
            )

        call_args = mock_client.get.call_args
        assert call_args[0][0] == "https://api.sport-suite.internal/picks/2026-03-08"

    async def test_sends_bearer_token_header(self):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"picks": []}
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("src.services.pick_sync_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            await fetch_picks_from_api(
                "https://api.sport-suite.internal", "secret-key", date(2026, 3, 8)
            )

        call_kwargs = mock_client.get.call_args[1]
        assert call_kwargs["headers"]["Authorization"] == "Bearer secret-key"

    async def test_empty_picks_key_returns_empty_list(self):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"picks": []}
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("src.services.pick_sync_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await fetch_picks_from_api(
                "https://api.sport-suite.internal", "key-123", date(2026, 3, 8)
            )

        assert result == []

    async def test_missing_picks_key_returns_empty_list(self):
        """API returns JSON without 'picks' key."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"status": "ok"}
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("src.services.pick_sync_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await fetch_picks_from_api(
                "https://api.sport-suite.internal", "key-123", date(2026, 3, 8)
            )

        assert result == []


# ---------------------------------------------------------------------------
# TestMatchPicksToGames — matching picks to PBP games (mocked session)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestMatchPicksToGames:
    """Test match_picks_to_games using a mocked session to avoid SQLite
    timezone comparison issues with DateTime(timezone=True).
    """

    async def test_match_by_team_and_opponent(self):
        """Pick with both team and opponent matches the correct game."""
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [
            {
                "player_name": "Jayson Tatum",
                "team": "BOS",
                "opponent_team": "LAL",
                "is_home": True,
            }
        ]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert len(matched) == 1
        assert matched[0]["game_id"] == "g1"

    async def test_match_away_team_perspective(self):
        """Pick from the away team perspective still matches."""
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [
            {
                "player_name": "LeBron James",
                "team": "LAL",
                "opponent_team": "BOS",
                "is_home": False,
            }
        ]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert len(matched) == 1
        assert matched[0]["game_id"] == "g1"

    async def test_no_games_returns_empty(self):
        """If no games exist for the date, return empty list."""
        session = _mock_session_with_games([])
        picks = [{"player_name": "Test", "team": "BOS", "opponent_team": "LAL"}]
        matched = await match_picks_to_games(session, date(2025, 1, 1), picks)
        assert matched == []

    async def test_no_matching_opponent_skipped(self):
        """Pick with an opponent not in today's games is skipped."""
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [
            {
                "player_name": "Test",
                "team": "CHI",
                "opponent_team": "MIA",
            }
        ]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert matched == []

    async def test_opponent_only_last_resort(self):
        """Pick with no team but opponent should match via last-resort lookup."""
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [
            {
                "player_name": "Tatum",
                "team": "",
                "opponent_team": "LAL",
                "is_home": None,
            }
        ]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert len(matched) == 1
        assert matched[0]["game_id"] == "g1"

    async def test_opponent_only_backfills_team(self):
        """When team is empty and opponent matches, team is back-filled."""
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [
            {
                "player_name": "Tatum",
                "team": "",
                "opponent_team": "LAL",
                "is_home": None,
            }
        ]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert len(matched) == 1
        # Back-filled team should be the opposite of opponent
        assert matched[0]["team"] == "BOS"

    async def test_is_home_true_fallback(self):
        """When team is empty and is_home is True, uses home key lookup."""
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [
            {
                "player_name": "Test",
                "team": "",
                "opponent_team": "LAL",
                "is_home": True,
            }
        ]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert len(matched) == 1
        assert matched[0]["game_id"] == "g1"

    async def test_is_home_false_fallback(self):
        """When team is empty and is_home is False, uses away key lookup."""
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [
            {
                "player_name": "Test",
                "team": "",
                "opponent_team": "BOS",
                "is_home": False,
            }
        ]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert len(matched) == 1
        assert matched[0]["game_id"] == "g1"

    async def test_multiple_picks_partial_match(self):
        """Only picks that match a game are returned."""
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [
            {"player_name": "Tatum", "team": "BOS", "opponent_team": "LAL"},
            {"player_name": "Unknown", "team": "CHI", "opponent_team": "MIA"},
        ]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert len(matched) == 1
        assert matched[0]["player_name"] == "Tatum"

    async def test_multiple_games_correct_match(self):
        """Multiple games: each pick matches its correct game."""
        session = _mock_session_with_games(
            [
                _fake_game("g1", "BOS", "LAL"),
                _fake_game("g2", "CHI", "MIA"),
            ]
        )
        picks = [
            {"player_name": "LeBron", "team": "LAL", "opponent_team": "BOS"},
            {"player_name": "Butler", "team": "MIA", "opponent_team": "CHI"},
        ]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert len(matched) == 2
        assert matched[0]["game_id"] == "g1"
        assert matched[1]["game_id"] == "g2"

    async def test_pick_missing_keys_defaults(self):
        """Pick dict missing team/opponent keys uses empty defaults."""
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [{"player_name": "Incomplete"}]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert matched == []

    async def test_pick_with_no_team_no_opponent_skipped(self):
        """Pick with no team and no opponent cannot match any game."""
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [{"player_name": "Ghost", "team": "", "opponent_team": ""}]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert matched == []

    async def test_is_home_fallback_not_triggered_when_team_matches(self):
        """is_home fallback is skipped when direct team+opp lookup succeeds."""
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [
            {
                "player_name": "Tatum",
                "team": "BOS",
                "opponent_team": "LAL",
                "is_home": True,
            }
        ]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert len(matched) == 1
        # Direct lookup matched; fallback logic irrelevant
        assert matched[0]["game_id"] == "g1"

    async def test_backfill_skips_when_inferred_equals_opponent(self):
        """Back-fill logic skips entries where inferred team == opponent.

        The game_lookup has both (home, away) and (away, home) entries.
        The loop should find a key pair where inferred != opp.
        """
        session = _mock_session_with_games([_fake_game("g1", "BOS", "LAL")])
        picks = [
            {
                "player_name": "Tatum",
                "team": "",
                "opponent_team": "BOS",
            }
        ]
        matched = await match_picks_to_games(session, date(2026, 2, 17), picks)
        assert len(matched) == 1
        # team should be back-filled to LAL (opposite of BOS)
        assert matched[0]["team"] == "LAL"


# ---------------------------------------------------------------------------
# TestSyncPicks — full sync orchestration (API path, file path, edge cases)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestSyncPicks:
    """Test the sync_picks function end-to-end.

    Since sync_picks uses pg_insert (PostgreSQL-specific), we mock the
    database execute/commit calls to avoid SQLite dialect issues.
    """

    def _make_raw_picks(self) -> list[dict]:
        """Return a sample raw pick list as returned by the API."""
        return [
            {
                "id": "pick-001",
                "player_name": "Jayson Tatum",
                "team": "BOS",
                "opponent_team": "LAL",
                "is_home": True,
                "stat_type": "POINTS",
                "side": "OVER",
                "softest_line": 26.5,
                "softest_book": "DraftKings",
                "tier": "X",
                "edge_pct": 8.0,
                "line": 27.0,
                "model_version": "xl",
                "p_over": 0.88,
                "edge": 4.0,
                "reasoning": "Strong home performance",
                "confidence": "high",
                "line_spread": 2.5,
            }
        ]

    async def test_api_path_full_sync(self):
        """API path: fetch -> parse -> match -> upsert."""
        raw = self._make_raw_picks()

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=MagicMock())
        mock_session.commit = AsyncMock()

        with (
            patch(
                "src.services.pick_sync_service.fetch_picks_from_api",
                new_callable=AsyncMock,
                return_value=raw,
            ),
            patch(
                "src.services.pick_sync_service.match_picks_to_games",
                new_callable=AsyncMock,
                return_value=[
                    {
                        "game_id": "401810001",
                        "player_name": "Jayson Tatum",
                        "team": "BOS",
                        "market": "POINTS",
                        "prediction": "OVER",
                        "line": 26.5,
                        "book": "DraftKings",
                        "model_version": "xl",
                        "p_over": 0.88,
                        "edge": 4.0,
                        "tier": "X",
                        "edge_pct": 8.0,
                        "consensus_line": 27.0,
                        "opponent_team": "LAL",
                        "reasoning": "Strong home performance",
                        "is_home": True,
                        "confidence": "high",
                        "line_spread": 2.5,
                        "game_date": date(2026, 2, 17),
                        "sport_suite_id": "pick-001",
                        "rolling_stats": None,
                        "injury_status": None,
                    }
                ],
            ),
        ):
            count = await sync_picks(
                mock_session,
                predictions_dir="",
                pick_date=date(2026, 2, 17),
                api_url="https://api.sport-suite.internal",
                api_key="key-123",
            )

        assert count == 1
        mock_session.execute.assert_called_once()
        mock_session.commit.assert_awaited_once()

    async def test_file_path_full_sync(self, tmp_path):
        """File-based path: find file -> parse -> match -> upsert."""
        picks_file = tmp_path / "xl_picks_2026-02-17.json"
        picks_file.write_text(json.dumps(self._make_raw_picks()))

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=MagicMock())
        mock_session.commit = AsyncMock()

        with patch(
            "src.services.pick_sync_service.match_picks_to_games",
            new_callable=AsyncMock,
            return_value=[
                {
                    "game_id": "401810001",
                    "player_name": "Jayson Tatum",
                    "team": "BOS",
                    "market": "POINTS",
                    "prediction": "OVER",
                    "line": 26.5,
                    "model_version": "xl",
                    "game_date": date(2026, 2, 17),
                }
            ],
        ):
            count = await sync_picks(
                mock_session,
                predictions_dir=str(tmp_path),
                pick_date=date(2026, 2, 17),
                api_url="",
                api_key="",
            )

        assert count == 1
        mock_session.commit.assert_awaited_once()

    async def test_no_source_returns_zero(self):
        """Neither api_url nor predictions_dir set -> return 0."""
        mock_session = AsyncMock()
        count = await sync_picks(
            mock_session,
            predictions_dir="",
            pick_date=date(2026, 2, 17),
            api_url="",
            api_key="",
        )
        assert count == 0

    async def test_api_returns_empty_picks(self):
        """API returns no picks -> return 0 (no parse/match needed)."""
        mock_session = AsyncMock()

        with patch(
            "src.services.pick_sync_service.fetch_picks_from_api",
            new_callable=AsyncMock,
            return_value=[],
        ):
            count = await sync_picks(
                mock_session,
                predictions_dir="",
                pick_date=date(2026, 2, 17),
                api_url="https://api.sport-suite.internal",
                api_key="key-123",
            )

        assert count == 0

    async def test_match_returns_empty(self):
        """Picks parsed but no game matches -> return 0."""
        raw = self._make_raw_picks()
        mock_session = AsyncMock()

        with (
            patch(
                "src.services.pick_sync_service.fetch_picks_from_api",
                new_callable=AsyncMock,
                return_value=raw,
            ),
            patch(
                "src.services.pick_sync_service.match_picks_to_games",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            count = await sync_picks(
                mock_session,
                predictions_dir="",
                pick_date=date(2026, 2, 17),
                api_url="https://api.sport-suite.internal",
                api_key="key-123",
            )

        assert count == 0
        mock_session.commit.assert_not_awaited()

    async def test_file_not_found_returns_zero(self, tmp_path):
        """predictions_dir exists but no file for date -> return 0."""
        mock_session = AsyncMock()
        count = await sync_picks(
            mock_session,
            predictions_dir=str(tmp_path),
            pick_date=date(2026, 2, 17),
            api_url="",
            api_key="",
        )
        assert count == 0

    async def test_file_invalid_format_returns_zero(self, tmp_path):
        """File is not a list -> return 0."""
        picks_file = tmp_path / "xl_picks_2026-02-17.json"
        picks_file.write_text(json.dumps({"not": "a list"}))

        mock_session = AsyncMock()
        count = await sync_picks(
            mock_session,
            predictions_dir=str(tmp_path),
            pick_date=date(2026, 2, 17),
            api_url="",
            api_key="",
        )
        assert count == 0

    async def test_default_pick_date_is_today(self):
        """When pick_date is None, defaults to date.today()."""
        mock_session = AsyncMock()

        with (
            patch(
                "src.services.pick_sync_service.fetch_picks_from_api",
                new_callable=AsyncMock,
                return_value=[],
            ) as mock_fetch,
            patch("src.services.pick_sync_service.date") as mock_date,
        ):
            mock_date.today.return_value = date(2026, 3, 22)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            count = await sync_picks(
                mock_session,
                predictions_dir="",
                pick_date=None,
                api_url="https://api.sport-suite.internal",
                api_key="key-123",
            )

        assert count == 0
        mock_fetch.assert_awaited_once()
        call_date = mock_fetch.call_args[0][2]
        assert call_date == date(2026, 3, 22)

    async def test_multiple_picks_upserted(self):
        """Multiple matched picks each produce an execute call."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()

        matched = [
            {
                "game_id": "g1",
                "player_name": "Player A",
                "team": "BOS",
                "market": "POINTS",
                "model_version": "xl",
                "game_date": date(2026, 2, 17),
            },
            {
                "game_id": "g2",
                "player_name": "Player B",
                "team": "LAL",
                "market": "REBOUNDS",
                "model_version": "v3",
                "game_date": date(2026, 2, 17),
            },
        ]

        with (
            patch(
                "src.services.pick_sync_service.fetch_picks_from_api",
                new_callable=AsyncMock,
                return_value=[{"player_name": "A"}, {"player_name": "B"}],
            ),
            patch(
                "src.services.pick_sync_service.match_picks_to_games",
                new_callable=AsyncMock,
                return_value=matched,
            ),
        ):
            count = await sync_picks(
                mock_session,
                predictions_dir="",
                pick_date=date(2026, 2, 17),
                api_url="https://api.sport-suite.internal",
                api_key="key-123",
            )

        assert count == 2
        assert mock_session.execute.await_count == 2
        mock_session.commit.assert_awaited_once()

    async def test_upsert_values_are_correct(self):
        """Verify the values dict passed to pg_insert contains all expected fields."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()

        matched_pick = {
            "game_id": "401810001",
            "player_name": "Jayson Tatum",
            "team": "BOS",
            "market": "POINTS",
            "prediction": "OVER",
            "line": 26.5,
            "p_over": 0.88,
            "edge": 4.0,
            "book": "DraftKings",
            "model_version": "xl",
            "tier": "X",
            "edge_pct": 8.0,
            "consensus_line": 27.0,
            "opponent_team": "LAL",
            "reasoning": "Strong home performance",
            "is_home": True,
            "confidence": "high",
            "line_spread": 2.5,
            "game_date": date(2026, 2, 17),
            "sport_suite_id": "pick-001",
            "rolling_stats": {"ppg_L5": 28.0},
            "injury_status": None,
        }

        with (
            patch(
                "src.services.pick_sync_service.fetch_picks_from_api",
                new_callable=AsyncMock,
                return_value=[{"player_name": "Tatum"}],
            ),
            patch(
                "src.services.pick_sync_service.match_picks_to_games",
                new_callable=AsyncMock,
                return_value=[matched_pick],
            ),
            patch("src.services.pick_sync_service.pg_insert") as mock_pg_insert,
        ):
            mock_stmt = MagicMock()
            mock_stmt.on_conflict_do_update.return_value = mock_stmt
            mock_pg_insert.return_value.values.return_value = mock_stmt

            count = await sync_picks(
                mock_session,
                predictions_dir="",
                pick_date=date(2026, 2, 17),
                api_url="https://api.sport-suite.internal",
                api_key="key-123",
            )

        assert count == 1
        values_call = mock_pg_insert.return_value.values.call_args[1]
        assert values_call["game_id"] == "401810001"
        assert values_call["player_name"] == "Jayson Tatum"
        assert values_call["team"] == "BOS"
        assert values_call["market"] == "POINTS"
        assert values_call["line"] == 26.5
        assert values_call["prediction"] == "OVER"
        assert values_call["p_over"] == 0.88
        assert values_call["edge"] == 4.0
        assert values_call["book"] == "DraftKings"
        assert values_call["model_version"] == "xl"
        assert values_call["tier"] == "X"
        assert values_call["sport_suite_id"] == "pick-001"
        assert values_call["rolling_stats"] == {"ppg_L5": 28.0}

    async def test_api_url_preferred_over_file(self, tmp_path):
        """When both api_url and predictions_dir are set, API path is used."""
        picks_file = tmp_path / "xl_picks_2026-02-17.json"
        picks_file.write_text(json.dumps([{"player_name": "File Pick"}]))

        mock_session = AsyncMock()

        with patch(
            "src.services.pick_sync_service.fetch_picks_from_api",
            new_callable=AsyncMock,
            return_value=[],
        ) as mock_fetch:
            count = await sync_picks(
                mock_session,
                predictions_dir=str(tmp_path),
                pick_date=date(2026, 2, 17),
                api_url="https://api.sport-suite.internal",
                api_key="key-123",
            )

        mock_fetch.assert_awaited_once()
        assert count == 0

    async def test_pick_missing_optional_fields_uses_defaults(self):
        """Matched pick with minimal fields uses defaults for missing ones."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()

        matched = [
            {
                "game_id": "401810001",
                # No player_name, team, market, etc.
            }
        ]

        with (
            patch(
                "src.services.pick_sync_service.fetch_picks_from_api",
                new_callable=AsyncMock,
                return_value=[{"player_name": "X"}],
            ),
            patch(
                "src.services.pick_sync_service.match_picks_to_games",
                new_callable=AsyncMock,
                return_value=matched,
            ),
            patch("src.services.pick_sync_service.pg_insert") as mock_pg_insert,
        ):
            mock_stmt = MagicMock()
            mock_stmt.on_conflict_do_update.return_value = mock_stmt
            mock_pg_insert.return_value.values.return_value = mock_stmt

            count = await sync_picks(
                mock_session,
                predictions_dir="",
                pick_date=date(2026, 2, 17),
                api_url="https://api.sport-suite.internal",
                api_key="key-123",
            )

        assert count == 1
        values_call = mock_pg_insert.return_value.values.call_args[1]
        assert values_call["player_name"] == ""
        assert values_call["team"] == ""
        assert values_call["market"] == ""
        assert values_call["line"] == 0
        assert values_call["prediction"] == "OVER"
        assert values_call["p_over"] is None
        assert values_call["edge"] is None

    async def test_on_conflict_set_fields(self):
        """Verify the on_conflict_do_update set_ dict has the correct keys."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()

        matched = [
            {
                "game_id": "g1",
                "player_name": "Player",
                "team": "BOS",
                "market": "POINTS",
                "model_version": "xl",
                "line": 25.5,
                "prediction": "OVER",
                "p_over": 0.9,
                "edge": 5.0,
                "book": "DK",
                "tier": "X",
                "edge_pct": 10.0,
                "consensus_line": 26.0,
                "reasoning": "Great",
                "confidence": "high",
                "line_spread": 2.0,
                "sport_suite_id": "abc",
                "rolling_stats": {"ppg": 30},
                "injury_status": "Healthy",
                "game_date": date(2026, 2, 17),
            }
        ]

        with (
            patch(
                "src.services.pick_sync_service.fetch_picks_from_api",
                new_callable=AsyncMock,
                return_value=[{"player_name": "Player"}],
            ),
            patch(
                "src.services.pick_sync_service.match_picks_to_games",
                new_callable=AsyncMock,
                return_value=matched,
            ),
            patch("src.services.pick_sync_service.pg_insert") as mock_pg_insert,
        ):
            mock_values_stmt = MagicMock()
            mock_pg_insert.return_value.values.return_value = mock_values_stmt
            mock_values_stmt.on_conflict_do_update.return_value = mock_values_stmt

            await sync_picks(
                mock_session,
                predictions_dir="",
                pick_date=date(2026, 2, 17),
                api_url="https://api.sport-suite.internal",
                api_key="key",
            )

        on_conflict_call = mock_values_stmt.on_conflict_do_update.call_args
        set_dict = on_conflict_call[1]["set_"]
        expected_keys = {
            "line",
            "prediction",
            "p_over",
            "edge",
            "book",
            "tier",
            "edge_pct",
            "consensus_line",
            "reasoning",
            "confidence",
            "line_spread",
            "sport_suite_id",
            "rolling_stats",
            "injury_status",
        }
        assert set(set_dict.keys()) == expected_keys
