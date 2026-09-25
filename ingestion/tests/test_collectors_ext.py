"""Extended collector tests — scoreboard and playbyplay poll/collect methods."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
import respx

from src.collectors.playbyplay import PlayByPlayCollector
from src.collectors.scoreboard import ScoreboardCollector
from src.http.espn import EspnHttp
from src.resilience.circuit_breaker import CircuitOpenError

BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"


@pytest.fixture
def mock_settings():
    s = MagicMock()
    s.espn_date = None
    s.espn_base_url = BASE_URL
    s.espn_poll_interval_seconds = 30
    return s


@pytest.fixture
def mock_sink():
    """EventSink fake: sync produce(), async flush()/close()."""
    sink = MagicMock()
    sink.flush = AsyncMock()
    sink.close = AsyncMock()
    return sink


@pytest.fixture
def mock_http():
    """Shared EspnHttp fake: async get()/aclose()."""
    return AsyncMock()


def _json_response(url: str, payload: dict, status: int = 200) -> httpx.Response:
    return httpx.Response(status, json=payload, request=httpx.Request("GET", url))


# ── Scoreboard Collector ──────────────────────────────────────────────


class TestScoreboardCollectorInit:
    def test_init(self, mock_settings, mock_sink, mock_http):
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
        assert collector is not None

    def test_keeps_the_shared_sink_and_http(self, mock_settings, mock_sink, mock_http):
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
        assert collector.sink is mock_sink
        assert collector.http is mock_http

    @pytest.mark.asyncio
    async def test_close_only_flushes_and_never_closes_shared_http(
        self, mock_settings, mock_sink, mock_http
    ):
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
        await collector.close()
        mock_sink.flush.assert_awaited_once()
        mock_sink.close.assert_not_awaited()
        mock_http.aclose.assert_not_awaited()


@pytest.mark.asyncio
class TestScoreboardCollect:
    async def test_collect_parses_response(self, mock_settings, mock_sink, mock_http):
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
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

    async def test_poll_produces_to_sink_and_awaits_flush(
        self, mock_settings, mock_sink, mock_http
    ):
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
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
        mock_sink.produce.assert_called_once()
        kwargs = mock_sink.produce.call_args.kwargs
        assert kwargs["topic"] == "raw.scoreboard"
        assert kwargs["key"] == "401810001"
        assert kwargs["value"]["status"] == "final"
        mock_sink.flush.assert_awaited_once()

    async def test_poll_with_no_games_still_flushes(self, mock_settings, mock_sink, mock_http):
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value={}):
            await collector.poll()
        mock_sink.produce.assert_not_called()
        mock_sink.flush.assert_awaited_once()

    async def test_poll_propagates_a_sink_flush_failure(self, mock_settings, mock_sink, mock_http):
        """A flush error is the orchestrator's to log; the collector must not
        swallow it (the sink keeps/requeues its own buffer)."""
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
        mock_sink.flush.side_effect = RuntimeError("db down")
        with (
            patch.object(collector, "_fetch", new_callable=AsyncMock, return_value={}),
            pytest.raises(RuntimeError, match="db down"),
        ):
            await collector.poll()

    async def test_poll_handles_circuit_open(self, mock_settings, mock_sink, mock_http, capsys):
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
        with patch.object(
            collector, "_fetch", new_callable=AsyncMock, side_effect=CircuitOpenError("open")
        ):
            await collector.poll()
        mock_sink.produce.assert_not_called()
        mock_sink.flush.assert_not_awaited()
        assert "scoreboard.circuit_open" in capsys.readouterr().out


# ── PlayByPlay Collector ──────────────────────────────────────────────


class TestPlayByPlayCollectorInit:
    def test_init(self, mock_settings, mock_sink, mock_http):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        assert collector is not None
        assert collector.game_id == "401810001"

    def test_keeps_the_shared_sink_and_http(self, mock_settings, mock_sink, mock_http):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        assert collector.sink is mock_sink
        assert collector.http is mock_http

    def test_accepts_keyword_arguments(self, mock_settings, mock_sink, mock_http):
        collector = PlayByPlayCollector(
            settings=mock_settings, sink=mock_sink, game_id="401810001", http=mock_http
        )
        assert (collector.game_id, collector.http) == ("401810001", mock_http)

    @pytest.mark.asyncio
    async def test_close_only_flushes_and_never_closes_shared_http(
        self, mock_settings, mock_sink, mock_http
    ):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        await collector.close()
        mock_sink.flush.assert_awaited_once()
        mock_sink.close.assert_not_awaited()
        mock_http.aclose.assert_not_awaited()


@pytest.mark.asyncio
class TestPlayByPlayPoll:
    async def test_poll_with_plays(self, mock_settings, mock_sink, mock_http):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
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
        mock_sink.produce.assert_called_once()
        kwargs = mock_sink.produce.call_args.kwargs
        assert (kwargs["topic"], kwargs["key"]) == ("raw.plays", "401810001")
        assert kwargs["value"]["sequence_number"] == 10
        mock_sink.flush.assert_awaited_once()
        assert collector.new_play_count == 11

    async def test_poll_no_data(self, mock_settings, mock_sink, mock_http):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        # Return empty dict instead of None (collect() expects dict with .get)
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value={}):
            await collector.poll()
        mock_sink.produce.assert_not_called()
        mock_sink.flush.assert_not_awaited()  # nothing new → no flush round-trip

    async def test_poll_empty_plays(self, mock_settings, mock_sink, mock_http):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
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
        mock_sink.flush.assert_not_awaited()

    async def test_parse_returning_none_is_skipped_and_advances(
        self, mock_settings, mock_sink, mock_http, capsys
    ):
        """_parse_play returning None is treated like any unparseable play:
        warned, skipped, and the high-water mark moves past it."""
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        response_data = {"plays": [{"id": "1", "sequenceNumber": "3"}]}
        with (
            patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=response_data),
            patch("src.collectors.playbyplay._parse_play", return_value=None),
        ):
            assert await collector.collect() == []
        assert collector.new_play_count == 4
        out = capsys.readouterr().out
        assert "pbp.play_skipped" in out and "sequence=3" in out

    async def test_malformed_play_is_skipped_and_later_plays_still_flow(
        self, mock_settings, mock_sink, mock_http, capsys
    ):
        """A play whose text is null (str field) must not block the game:
        it is skipped with a warning and the plays around it are produced."""
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)

        def play(seq, text="Jayson Tatum makes layup"):
            return {
                "id": f"p{seq}",
                "sequenceNumber": str(seq),
                "type": {"text": "Layup"},
                "text": text,
            }

        first = {"plays": [play(1), play(2, text=None), play(3)]}
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=first):
            await collector.poll()
        produced = [c.kwargs["value"]["sequence_number"] for c in mock_sink.produce.call_args_list]
        assert produced == [1, 3]
        out = capsys.readouterr().out
        assert "pbp.play_skipped" in out
        assert "game_id=401810001" in out and "sequence=2" in out

        # Next cycle: the malformed play is still in ESPN's feed, but it is
        # behind the high-water mark now — only the new play is produced
        # and nothing is re-warned.
        second = {"plays": [*first["plays"], play(4)]}
        mock_sink.produce.reset_mock()
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=second):
            await collector.poll()
        produced = [c.kwargs["value"]["sequence_number"] for c in mock_sink.produce.call_args_list]
        assert produced == [4]
        assert "pbp.play_skipped" not in capsys.readouterr().out

    async def test_malformed_highest_play_still_advances_high_water_mark(
        self, mock_settings, mock_sink, mock_http
    ):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        data = {"plays": [{"id": "p9", "sequenceNumber": "9", "period": None}]}
        with patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=data):
            assert await collector.collect() == []
        assert collector.new_play_count == 10  # skipped play 9 is never re-parsed

    async def test_poll_propagates_a_sink_flush_failure(self, mock_settings, mock_sink, mock_http):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        mock_sink.flush.side_effect = RuntimeError("db down")
        response_data = {"plays": [{"id": "1", "sequenceNumber": "1", "type": {"text": "x"}}]}
        with (
            patch.object(collector, "_fetch", new_callable=AsyncMock, return_value=response_data),
            pytest.raises(RuntimeError, match="db down"),
        ):
            await collector.poll()
        mock_sink.produce.assert_called_once()  # the play is in the sink's buffer


# ── _fetch() goes through the shared EspnHttp ──────────────────────────


@pytest.mark.asyncio
class TestScoreboardFetchViaSharedHttp:
    async def test_fetch_without_espn_date(self, mock_settings, mock_sink, mock_http):
        mock_settings.espn_date = None
        url = f"{BASE_URL}/scoreboard"
        mock_http.get.return_value = _json_response(url, {"events": []})
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
        assert await collector._fetch() == {"events": []}
        # No dates= → ESPN picks its own current slate (no local "today").
        mock_http.get.assert_awaited_once_with(url, params={})

    async def test_fetch_with_espn_date(self, mock_settings, mock_sink, mock_http):
        mock_settings.espn_date = "20260220"
        url = f"{BASE_URL}/scoreboard"
        mock_http.get.return_value = _json_response(url, {"events": []})
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
        assert await collector._fetch() == {"events": []}
        mock_http.get.assert_awaited_once_with(url, params={"dates": "20260220"})

    async def test_fetch_raises_on_http_error_status(self, mock_settings, mock_sink, mock_http):
        url = f"{BASE_URL}/scoreboard"
        mock_http.get.return_value = _json_response(url, {}, status=404)
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
        with pytest.raises(httpx.HTTPStatusError):
            await collector._fetch()


@pytest.mark.asyncio
class TestPlayByPlayFetchViaSharedHttp:
    async def test_fetch_hits_summary_endpoint_with_game_id(
        self, mock_settings, mock_sink, mock_http
    ):
        url = f"{BASE_URL}/summary"
        mock_http.get.return_value = _json_response(url, {"plays": []})
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        assert await collector._fetch() == {"plays": []}
        mock_http.get.assert_awaited_once_with(url, params={"event": "401810001"})


@pytest.mark.asyncio
class TestCollectorsWithRealEspnHttp:
    """Compose the collectors with a real EspnHttp over respx (no network)."""

    async def test_blocked_without_proxy_skips_cycle_without_crashing(
        self, mock_settings, mock_sink, capsys
    ):
        http = EspnHttp("")  # no proxy configured
        try:
            with respx.mock(assert_all_called=True) as router:
                route = router.get(f"{BASE_URL}/scoreboard").mock(return_value=httpx.Response(403))
                collector = ScoreboardCollector(mock_settings, mock_sink, http)
                await collector.poll()
            assert route.call_count == 1  # 4xx is not retried: no tight loop
        finally:
            await http.aclose()
        mock_sink.produce.assert_not_called()
        assert "scoreboard.http_error" in capsys.readouterr().out

    async def test_two_pbp_collectors_share_one_http(self, mock_settings, mock_sink):
        http = EspnHttp("")
        try:
            with respx.mock(assert_all_called=True) as router:
                route = router.get(f"{BASE_URL}/summary").mock(
                    side_effect=lambda req: httpx.Response(
                        200,
                        json={
                            "plays": [
                                {
                                    "id": req.url.params["event"] + "-1",
                                    "sequenceNumber": "1",
                                    "type": {"text": "Jump Ball"},
                                    "text": "",
                                }
                            ]
                        },
                    )
                )
                a = PlayByPlayCollector(mock_settings, mock_sink, "g1", http)
                b = PlayByPlayCollector(mock_settings, mock_sink, "g2", http)
                await asyncio.gather(a.poll(), b.poll())
                await a.close()
                # Closing one collector must leave the shared client usable.
                await b.poll()
            assert route.call_count == 3
        finally:
            await http.aclose()
        keys = sorted(c.kwargs["key"] for c in mock_sink.produce.call_args_list)
        assert keys == ["g1", "g2"]


# ── poll() error branches (scoreboard) ──────────────────────────────────


@pytest.mark.asyncio
class TestScoreboardPollErrorBranches:
    async def test_http_status_error_skips_cycle(self, mock_settings, mock_sink, mock_http, capsys):
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
        request = httpx.Request("GET", "https://example.com/scoreboard")
        response = httpx.Response(500, request=request)
        exc = httpx.HTTPStatusError("server error", request=request, response=response)
        with patch.object(collector, "_fetch", new_callable=AsyncMock, side_effect=exc):
            await collector.poll()
        mock_sink.produce.assert_not_called()
        assert "scoreboard.http_error" in capsys.readouterr().out

    async def test_request_error_skips_cycle(self, mock_settings, mock_sink, mock_http, capsys):
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
        exc = httpx.ConnectError("connection refused")
        with patch.object(collector, "_fetch", new_callable=AsyncMock, side_effect=exc):
            await collector.poll()
        mock_sink.produce.assert_not_called()
        assert "scoreboard.request_error" in capsys.readouterr().out


# ── collect() branch: some events fail to parse ─────────────────────────


@pytest.mark.asyncio
class TestScoreboardCollectMixedResults:
    async def test_events_without_competitions_are_dropped(
        self, mock_settings, mock_sink, mock_http
    ):
        collector = ScoreboardCollector(mock_settings, mock_sink, mock_http)
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
    def test_zero_before_any_play_seen(self, mock_settings, mock_sink, mock_http):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        assert collector.new_play_count == 0

    @pytest.mark.asyncio
    async def test_reflects_max_sequence_after_collect(self, mock_settings, mock_sink, mock_http):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
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
    async def test_malformed_sequence_number_is_skipped(self, mock_settings, mock_sink, mock_http):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
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
        self, mock_settings, mock_sink, mock_http
    ):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
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
    async def test_circuit_open_skips_cycle(self, mock_settings, mock_sink, mock_http, capsys):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        with patch.object(
            collector, "_fetch", new_callable=AsyncMock, side_effect=CircuitOpenError("open")
        ):
            await collector.poll()
        mock_sink.produce.assert_not_called()
        assert "playbyplay.circuit_open" in capsys.readouterr().out

    async def test_http_status_error_skips_cycle(self, mock_settings, mock_sink, mock_http, capsys):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        request = httpx.Request("GET", "https://example.com/summary")
        response = httpx.Response(500, request=request)
        exc = httpx.HTTPStatusError("server error", request=request, response=response)
        with patch.object(collector, "_fetch", new_callable=AsyncMock, side_effect=exc):
            await collector.poll()
        mock_sink.produce.assert_not_called()
        assert "playbyplay.http_error" in capsys.readouterr().out

    async def test_request_error_skips_cycle(self, mock_settings, mock_sink, mock_http, capsys):
        collector = PlayByPlayCollector(mock_settings, mock_sink, "401810001", mock_http)
        exc = httpx.ConnectError("connection refused")
        with patch.object(collector, "_fetch", new_callable=AsyncMock, side_effect=exc):
            await collector.poll()
        mock_sink.produce.assert_not_called()
        assert "playbyplay.request_error" in capsys.readouterr().out
