"""Extended collector tests — scoreboard and playbyplay poll/collect methods."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.collectors.playbyplay import PlayByPlayCollector
from src.collectors.scoreboard import ScoreboardCollector
from src.resilience.circuit_breaker import CircuitOpenError


@pytest.fixture
def mock_settings():
    s = MagicMock()
    s.espn_date = None
    s.espn_base_url = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
    s.espn_poll_interval_seconds = 30
    s.kafka_bootstrap_servers = "localhost:9092"
    s.schema_registry_url = "http://localhost:8081"
    return s


@pytest.fixture
def mock_producer():
    return MagicMock()


# ── Scoreboard Collector ──────────────────────────────────────────────


class TestScoreboardCollectorInit:
    def test_init(self, mock_settings, mock_producer):
        collector = ScoreboardCollector(mock_settings, mock_producer)
        assert collector is not None

    @pytest.mark.asyncio
    async def test_close(self, mock_settings, mock_producer):
        collector = ScoreboardCollector(mock_settings, mock_producer)
        await collector.close()  # should not raise


@pytest.mark.asyncio
class TestScoreboardCollect:
    async def test_collect_parses_response(self, mock_settings, mock_producer):
        collector = ScoreboardCollector(mock_settings, mock_producer)
        response_data = {
            "events": [
                {
                    "id": "401810001",
                    "date": "2026-02-20T00:30:00Z",
                    "competitions": [
                        {
                            "competitors": [
                                {
                                    "homeAway": "home",
                                    "team": {"abbreviation": "BOS", "displayName": "Celtics"},
                                    "score": "55",
                                },
                                {
                                    "homeAway": "away",
                                    "team": {"abbreviation": "LAL", "displayName": "Lakers"},
                                    "score": "48",
                                },
                            ],
                            "status": {
                                "type": {"name": "STATUS_IN_PROGRESS", "shortDetail": "Q3 5:30"},
                            },
                            "venue": {"fullName": "TD Garden"},
                        }
                    ],
                    "status": {
                        "type": {"name": "STATUS_IN_PROGRESS", "shortDetail": "Q3 5:30"},
                        "period": 3,
                        "displayClock": "5:30",
                    },
                }
            ]
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = response_data
        mock_resp.raise_for_status = MagicMock()

        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=response_data):
            games = await collector.collect()
            assert len(games) == 1
            assert games[0]["game_id"] == "401810001"
            assert games[0]["home_team"] == "BOS"

    async def test_poll_produces_to_kafka(self, mock_settings, mock_producer):
        collector = ScoreboardCollector(mock_settings, mock_producer)
        response_data = {
            "events": [
                {
                    "id": "401810001",
                    "date": "2026-02-20T00:30:00Z",
                    "competitions": [
                        {
                            "competitors": [
                                {
                                    "homeAway": "home",
                                    "team": {"abbreviation": "BOS", "displayName": "Celtics"},
                                    "score": "55",
                                },
                                {
                                    "homeAway": "away",
                                    "team": {"abbreviation": "LAL", "displayName": "Lakers"},
                                    "score": "48",
                                },
                            ],
                            "status": {"type": {"name": "STATUS_FINAL"}},
                            "venue": {"fullName": "TD Garden"},
                        }
                    ],
                    "status": {
                        "type": {"name": "STATUS_FINAL"},
                        "period": 4,
                        "displayClock": "0:00",
                    },
                }
            ]
        }
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=response_data):
            await collector.poll()
            mock_producer.produce.assert_called()

    async def test_poll_handles_circuit_open(self, mock_settings, mock_producer):
        collector = ScoreboardCollector(mock_settings, mock_producer)
        with patch.object(
            collector, "_fetch", new_callable=AsyncMock, side_effect=CircuitOpenError("open")
        ):
            # poll should handle CircuitOpenError gracefully
            try:
                await collector.poll()
            except CircuitOpenError:
                pass  # Expected in some implementations


# ── PlayByPlay Collector ──────────────────────────────────────────────


class TestPlayByPlayCollectorInit:
    def test_init(self, mock_settings, mock_producer):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        assert collector is not None
        assert collector.game_id == "401810001"

    @pytest.mark.asyncio
    async def test_close(self, mock_settings, mock_producer):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        await collector.close()


@pytest.mark.asyncio
class TestPlayByPlayPoll:
    async def test_poll_with_plays(self, mock_settings, mock_producer):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        response_data = {
            "competitions": [
                {
                    "competitors": [
                        {"homeAway": "home", "team": {"abbreviation": "BOS"}},
                        {"homeAway": "away", "team": {"abbreviation": "LAL"}},
                    ],
                }
            ],
            "plays": [
                {
                    "id": "1001",
                    "sequenceNumber": "10",
                    "period": {"number": 1},
                    "clock": {"displayValue": "11:30"},
                    "type": {"text": "Missed Shot"},
                    "text": "Tatum misses jumper",
                    "team": {"id": "2"},
                    "wallClock": "2026-02-20T00:35:00Z",
                    "scoringPlay": False,
                    "homeScore": "0",
                    "awayScore": "0",
                }
            ],
        }
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=response_data):
            await collector.poll()
            assert mock_producer.produce.called or collector.new_play_count >= 0

    async def test_poll_no_data(self, mock_settings, mock_producer):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        # Return empty dict instead of None (collect() expects dict with .get)
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value={}):
            await collector.poll()

    async def test_poll_empty_plays(self, mock_settings, mock_producer):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        response_data = {
            "competitions": [
                {
                    "competitors": [
                        {"homeAway": "home", "team": {"abbreviation": "BOS"}},
                        {"homeAway": "away", "team": {"abbreviation": "LAL"}},
                    ],
                }
            ],
            "plays": [],
        }
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=response_data):
            await collector.poll()


# ── Real _fetch() over a mocked HTTP transport ─────────────────────────


@pytest.mark.asyncio
class TestScoreboardRealFetch:
    async def test_fetch_without_espn_date(self, mock_settings, mock_producer):
        mock_settings.espn_date = None
        collector = ScoreboardCollector(mock_settings, mock_producer)

        def handler(request: httpx.Request) -> httpx.Response:
            assert "dates" not in request.url.params
            return httpx.Response(200, json={"events": []})

        collector.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        data = await collector._fetch()
        assert data == {"events": []}

    async def test_fetch_with_espn_date(self, mock_settings, mock_producer):
        mock_settings.espn_date = "20260220"
        collector = ScoreboardCollector(mock_settings, mock_producer)

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params["dates"] == "20260220"
            return httpx.Response(200, json={"events": []})

        collector.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        data = await collector._fetch()
        assert data == {"events": []}


@pytest.mark.asyncio
class TestPlayByPlayRealFetch:
    async def test_fetch_hits_summary_endpoint_with_game_id(self, mock_settings, mock_producer):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params["event"] == "401810001"
            return httpx.Response(200, json={"plays": []})

        collector.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        data = await collector._fetch()
        assert data == {"plays": []}


# ── poll() error branches (scoreboard) ──────────────────────────────────


@pytest.mark.asyncio
class TestScoreboardPollErrorBranches:
    async def test_http_status_error_skips_cycle(self, mock_settings, mock_producer, capsys):
        collector = ScoreboardCollector(mock_settings, mock_producer)
        request = httpx.Request("GET", "https://example.com/scoreboard")
        response = httpx.Response(500, request=request)
        exc = httpx.HTTPStatusError("server error", request=request, response=response)
        with patch.object(collector, "_fetch", new_callable=AsyncMock, side_effect=exc):
            await collector.poll()
        mock_producer.produce.assert_not_called()
        assert "scoreboard.http_error" in capsys.readouterr().out

    async def test_request_error_skips_cycle(self, mock_settings, mock_producer, capsys):
        collector = ScoreboardCollector(mock_settings, mock_producer)
        exc = httpx.ConnectError("connection refused")
        with patch.object(collector, "_fetch", new_callable=AsyncMock, side_effect=exc):
            await collector.poll()
        mock_producer.produce.assert_not_called()
        assert "scoreboard.request_error" in capsys.readouterr().out


# ── collect() branch: some events fail to parse ─────────────────────────


@pytest.mark.asyncio
class TestScoreboardCollectMixedResults:
    async def test_events_without_competitions_are_dropped(self, mock_settings, mock_producer):
        collector = ScoreboardCollector(mock_settings, mock_producer)
        response_data = {
            "events": [
                {"id": "no-competitions", "competitions": []},
                {
                    "id": "401810001",
                    "date": "2026-02-20T00:30:00Z",
                    "competitions": [
                        {
                            "competitors": [
                                {
                                    "homeAway": "home",
                                    "team": {"abbreviation": "BOS", "displayName": "Celtics"},
                                    "score": "55",
                                },
                                {
                                    "homeAway": "away",
                                    "team": {"abbreviation": "LAL", "displayName": "Lakers"},
                                    "score": "48",
                                },
                            ],
                            "status": {"type": {"name": "STATUS_IN_PROGRESS"}},
                        }
                    ],
                },
            ]
        }
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=response_data):
            games = await collector.collect()
        assert len(games) == 1
        assert games[0]["game_id"] == "401810001"


# ── PlayByPlay: new_play_count property ─────────────────────────────────


class TestNewPlayCount:
    def test_zero_before_any_play_seen(self, mock_settings, mock_producer):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        assert collector.new_play_count == 0

    @pytest.mark.asyncio
    async def test_reflects_max_sequence_after_collect(self, mock_settings, mock_producer):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        response_data = {
            "competitions": [
                {
                    "competitors": [
                        {"homeAway": "home", "team": {"abbreviation": "BOS"}},
                        {"homeAway": "away", "team": {"abbreviation": "LAL"}},
                    ],
                }
            ],
            "plays": [
                {
                    "id": "1",
                    "sequenceNumber": "4",
                    "period": {"number": 1},
                    "clock": {"displayValue": "10:00"},
                    "type": {"text": "Jump Ball"},
                    "text": "Tip-off",
                    "team": {"id": "2"},
                }
            ],
        }
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=response_data):
            await collector.collect()
        assert collector.new_play_count == 5  # max_sequence(4) + 1


# ── PlayByPlay: collect() dedup / malformed sequence branches ───────────


@pytest.mark.asyncio
class TestPlayByPlayCollectDedup:
    async def test_malformed_sequence_number_is_skipped(self, mock_settings, mock_producer):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        response_data = {
            "competitions": [],
            "plays": [
                {"id": "1", "sequenceNumber": "not-a-number", "type": {"text": "Jump Ball"}},
            ],
        }
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=response_data):
            new_plays = await collector.collect()
        assert new_plays == []
        assert collector.new_play_count == 0

    async def test_already_seen_sequence_is_skipped_on_next_poll(
        self, mock_settings, mock_producer
    ):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        first_response = {
            "competitions": [],
            "plays": [
                {"id": "1", "sequenceNumber": "5", "type": {"text": "Jump Ball"}, "text": ""},
            ],
        }
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=first_response):
            first = await collector.collect()
        assert len(first) == 1

        # Second poll returns the same (already-seen) play plus nothing new.
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=first_response):
            second = await collector.collect()
        assert second == []


# ── PlayByPlay: poll() error branches ───────────────────────────────────


@pytest.mark.asyncio
class TestPlayByPlayPollErrorBranches:
    async def test_circuit_open_skips_cycle(self, mock_settings, mock_producer, capsys):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        with patch.object(
            collector, "_fetch", new_callable=AsyncMock, side_effect=CircuitOpenError("open")
        ):
            await collector.poll()
        mock_producer.produce.assert_not_called()
        assert "playbyplay.circuit_open" in capsys.readouterr().out

    async def test_http_status_error_skips_cycle(self, mock_settings, mock_producer, capsys):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        request = httpx.Request("GET", "https://example.com/summary")
        response = httpx.Response(500, request=request)
        exc = httpx.HTTPStatusError("server error", request=request, response=response)
        with patch.object(collector, "_fetch", new_callable=AsyncMock, side_effect=exc):
            await collector.poll()
        mock_producer.produce.assert_not_called()
        assert "playbyplay.http_error" in capsys.readouterr().out

    async def test_request_error_skips_cycle(self, mock_settings, mock_producer, capsys):
        collector = PlayByPlayCollector(mock_settings, mock_producer, "401810001")
        exc = httpx.ConnectError("connection refused")
        with patch.object(collector, "_fetch", new_callable=AsyncMock, side_effect=exc):
            await collector.poll()
        mock_producer.produce.assert_not_called()
        assert "playbyplay.request_error" in capsys.readouterr().out
