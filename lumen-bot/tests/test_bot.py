"""Characterization tests for bot.py — the Lumen discord.Client and entrypoint."""

import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import discord
import pytest
import time_machine

sys.path.insert(0, str(Path(__file__).parent.parent))

import bot  # noqa: E402
from bot import Lumen, _split_message  # noqa: E402


def _cfg(**overrides):
    cfg = {
        "discord": {"owner_id": 111},
        "lunara": {"api_url": "http://127.0.0.1:8010", "ws_url": "ws://127.0.0.1:8010/ws"},
        "alerts": {},
        "copilot": {},
    }
    cfg.update(overrides)
    return cfg


class _NullTyping:
    async def __aenter__(self):
        return None

    async def __aexit__(self, *a):
        return False


class FakeUser:
    def __init__(self, id_, name="Lotus"):
        self.id = id_
        self.name = name


class FakeMessage:
    def __init__(self, author_id, content, channel, reply=None):
        self.author = FakeUser(author_id)
        self.content = content
        self.channel = channel
        self.reply = reply or AsyncMock()


def _dm_channel():
    ch = Mock(spec=discord.DMChannel)
    ch.send = AsyncMock()
    ch.typing = Mock(return_value=_NullTyping())
    return ch


@pytest.fixture(autouse=True)
async def _cleanup_leftover_tasks():
    yield
    current = asyncio.current_task()
    leftovers = [t for t in asyncio.all_tasks() if t is not current and not t.done()]
    for t in leftovers:
        t.cancel()
    if leftovers:
        await asyncio.gather(*leftovers, return_exceptions=True)


# ---------------------------------------------------------------------------
# _split_message
# ---------------------------------------------------------------------------


class TestSplitMessage:
    def test_under_limit_unchanged(self):
        assert _split_message("hello", 2000) == ["hello"]

    def test_exactly_at_limit_is_one_chunk(self):
        text = "x" * 10
        assert _split_message(text, 10) == [text]

    def test_splits_on_newline_when_possible(self):
        text = "a" * 5 + "\n" + "b" * 5 + "\n" + "c" * 5
        assert _split_message(text, 11) == ["aaaaa", "bbbbb\nccccc"]

    def test_no_newline_falls_back_to_hard_limit(self):
        text = "a" * 25
        assert _split_message(text, 10) == ["a" * 10, "a" * 10, "a" * 5]

    def test_trailing_newlines_consumed_exactly_ends_loop_via_while_condition(self):
        # After the hard-limit split, the remainder is pure "\n" — lstrip("\n")
        # empties it, so the loop ends via `while text:` going false, not `break`.
        text = "a" * 10 + "\n" * 5
        assert _split_message(text, 10) == ["a" * 10]


# ---------------------------------------------------------------------------
# Lumen.__init__ — LUNARA_API_URL / LUNARA_WS_URL env override
# ---------------------------------------------------------------------------


class TestLunaraUrlOverride:
    def test_env_vars_override_config_urls(self, monkeypatch):
        monkeypatch.setenv("LUNARA_API_URL", "http://127.0.0.1:8010")
        monkeypatch.setenv("LUNARA_WS_URL", "ws://127.0.0.1:8010/ws")
        b = Lumen(_cfg(lunara={"api_url": "https://old.run.app", "ws_url": "wss://old.run.app/ws"}))
        assert b.api_url == "http://127.0.0.1:8010"
        assert b.ws_url == "ws://127.0.0.1:8010/ws"

    def test_config_used_when_env_absent(self, monkeypatch):
        monkeypatch.delenv("LUNARA_API_URL", raising=False)
        monkeypatch.delenv("LUNARA_WS_URL", raising=False)
        b = Lumen(_cfg())
        assert b.api_url == "http://127.0.0.1:8010"
        assert b.ws_url == "ws://127.0.0.1:8010/ws"


# ---------------------------------------------------------------------------
# Lumen.on_message
# ---------------------------------------------------------------------------


class TestOnMessage:
    async def test_ignores_messages_not_from_owner(self):
        b = Lumen(_cfg())
        msg = FakeMessage(author_id=999, content="status", channel=_dm_channel())
        await b.on_message(msg)
        msg.reply.assert_not_awaited()

    async def test_ignores_non_dm_messages_from_owner(self):
        b = Lumen(_cfg())
        msg = FakeMessage(author_id=111, content="status", channel=object())
        await b.on_message(msg)
        msg.reply.assert_not_awaited()

    @pytest.mark.parametrize("content", ["status", "!status"])
    async def test_status_command(self, monkeypatch, content):
        b = Lumen(_cfg())
        monkeypatch.setattr(b, "_send_status", AsyncMock())
        channel = _dm_channel()
        msg = FakeMessage(author_id=111, content=content, channel=channel)
        await b.on_message(msg)
        b._send_status.assert_awaited_once_with(channel)

    @pytest.mark.parametrize("content", ["picks", "!picks"])
    async def test_picks_command(self, monkeypatch, content):
        b = Lumen(_cfg())
        monkeypatch.setattr(b, "_send_current_picks", AsyncMock())
        channel = _dm_channel()
        msg = FakeMessage(author_id=111, content=content, channel=channel)
        await b.on_message(msg)
        b._send_current_picks.assert_awaited_once_with(channel)

    @pytest.mark.parametrize("content", ["recap", "!recap"])
    async def test_recap_command(self, monkeypatch, content):
        b = Lumen(_cfg())
        monkeypatch.setattr(b, "_send_recap", AsyncMock())
        channel = _dm_channel()
        msg = FakeMessage(author_id=111, content=content, channel=channel)
        await b.on_message(msg)
        b._send_recap.assert_awaited_once_with(channel)

    async def test_routes_free_text_to_brain_and_splits_reply(self, monkeypatch):
        b = Lumen(_cfg())
        fake_brain = Mock()
        fake_brain.available = True
        fake_brain.respond = AsyncMock(return_value="Hi Operator.")
        b._brain = fake_brain

        channel = _dm_channel()
        msg = FakeMessage(author_id=111, content="how's tatum doing", channel=channel)
        await b.on_message(msg)

        fake_brain.respond.assert_awaited_once_with(
            user_id=111, message="how's tatum doing", user_name="Lotus"
        )
        msg.reply.assert_awaited_once_with("Hi Operator.")

    async def test_free_text_with_no_brain_sends_nothing(self):
        b = Lumen(_cfg())
        assert b._brain is None
        channel = _dm_channel()
        msg = FakeMessage(author_id=111, content="hello", channel=channel)
        await b.on_message(msg)  # silently does nothing — characterized as-is
        msg.reply.assert_not_awaited()

    async def test_free_text_with_unavailable_brain_sends_nothing(self):
        b = Lumen(_cfg())
        fake_brain = Mock()
        fake_brain.available = False
        b._brain = fake_brain
        channel = _dm_channel()
        msg = FakeMessage(author_id=111, content="hello", channel=channel)
        await b.on_message(msg)
        msg.reply.assert_not_awaited()

    async def test_history_cleared_once_per_day(self, monkeypatch):
        b = Lumen(_cfg())
        fake_brain = Mock()
        fake_brain.available = True
        fake_brain.respond = AsyncMock(return_value="ok")
        fake_brain.clear_history = Mock()
        b._brain = fake_brain

        channel = _dm_channel()
        msg1 = FakeMessage(author_id=111, content="hi", channel=channel)
        await b.on_message(msg1)
        assert fake_brain.clear_history.call_count == 1

        msg2 = FakeMessage(author_id=111, content="hi again", channel=channel)
        await b.on_message(msg2)
        assert fake_brain.clear_history.call_count == 1  # same day: not cleared again

    async def test_history_clear_date_uses_eastern_time_not_utc(self, monkeypatch):
        """The day-boundary date recorded on `_last_history_clear_date` must be
        the Eastern calendar date, not the UTC date."""
        b = Lumen(_cfg())
        fake_brain = Mock()
        fake_brain.available = True
        fake_brain.respond = AsyncMock(return_value="ok")
        fake_brain.clear_history = Mock()
        b._brain = fake_brain

        channel = _dm_channel()
        msg = FakeMessage(author_id=111, content="hi", channel=channel)

        # 03:00 UTC on Jan 1 is still Dec 31 in Eastern time (EST, UTC-5).
        with time_machine.travel(datetime(2026, 1, 1, 3, 0, tzinfo=timezone.utc)):
            await b.on_message(msg)
        assert b._last_history_clear_date == "2025-12-31"
        assert fake_brain.clear_history.call_count == 1

        # Still Dec 31 ET a few hours later (04:00 UTC) — no second clear.
        msg2 = FakeMessage(author_id=111, content="hi again", channel=channel)
        with time_machine.travel(datetime(2026, 1, 1, 4, 0, tzinfo=timezone.utc)):
            await b.on_message(msg2)
        assert fake_brain.clear_history.call_count == 1

        # Past real ET midnight (05:00 UTC = 00:00 EST) — new ET day, clears again.
        msg3 = FakeMessage(author_id=111, content="hi once more", channel=channel)
        with time_machine.travel(datetime(2026, 1, 1, 5, 0, tzinfo=timezone.utc)):
            await b.on_message(msg3)
        assert b._last_history_clear_date == "2026-01-01"
        assert fake_brain.clear_history.call_count == 2


# ---------------------------------------------------------------------------
# _health_server
# ---------------------------------------------------------------------------


class TestHealthServer:
    async def test_responds_200_on_health(self, monkeypatch):
        monkeypatch.setenv("PORT", "0")
        real_start_server = asyncio.start_server
        servers = []

        async def spy_start_server(*args, **kwargs):
            srv = await real_start_server(*args, **kwargs)
            servers.append(srv)
            return srv

        monkeypatch.setattr(bot.asyncio, "start_server", spy_start_server)

        b = Lumen(_cfg())
        task = asyncio.create_task(b._health_server())
        try:
            for _ in range(200):
                if servers:
                    break
                await asyncio.sleep(0.005)
            assert servers, "server never bound"
            port = servers[0].sockets[0].getsockname()[1]

            reader, writer = await asyncio.open_connection("127.0.0.1", port)
            writer.write(b"GET /health HTTP/1.1\r\n\r\n")
            await writer.drain()
            data = await reader.read(2048)
            writer.close()
            await writer.wait_closed()
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

        assert b"200 OK" in data
        assert b'"status": "ok"' in data
        assert b'"service": "cephalon-lumen"' in data

    async def test_binds_localhost_by_default(self, monkeypatch):
        """R21: default bind must be 127.0.0.1, not 0.0.0.0 (which collided
        with Airflow on the box at the default PORT)."""
        monkeypatch.setenv("PORT", "0")
        monkeypatch.delenv("HEALTH_HOST", raising=False)
        captured = {}
        real_start_server = asyncio.start_server

        async def spy_start_server(handler, host, port, *args, **kwargs):
            captured["host"] = host
            return await real_start_server(handler, host, port, *args, **kwargs)

        monkeypatch.setattr(bot.asyncio, "start_server", spy_start_server)

        b = Lumen(_cfg())
        task = asyncio.create_task(b._health_server())
        try:
            for _ in range(200):
                if "host" in captured:
                    break
                await asyncio.sleep(0.005)
            assert captured.get("host") == "127.0.0.1"
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    async def test_binds_host_from_env_override(self, monkeypatch):
        """A distinct, non-bindable-by-coincidence host: distinguishes this
        from the pre-fix hardcoded "0.0.0.0" (which would have matched an
        override of "0.0.0.0" for the wrong reason). Stubs out the actual
        bind so an unroutable test address never touches a real socket."""
        monkeypatch.setenv("PORT", "0")
        monkeypatch.setenv("HEALTH_HOST", "192.0.2.1")  # TEST-NET-1, RFC 5737
        captured = {}

        class _FakeServer:
            sockets = []

            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc_info):
                return False

            async def serve_forever(self):
                await asyncio.sleep(3600)

        async def spy_start_server(handler, host, port, *args, **kwargs):
            captured["host"] = host
            return _FakeServer()

        monkeypatch.setattr(bot.asyncio, "start_server", spy_start_server)

        b = Lumen(_cfg())
        task = asyncio.create_task(b._health_server())
        try:
            for _ in range(200):
                if "host" in captured:
                    break
                await asyncio.sleep(0.005)
            assert captured.get("host") == "192.0.2.1"
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


# ---------------------------------------------------------------------------
# _atlas_heartbeat
# ---------------------------------------------------------------------------


class TestAtlasHeartbeat:
    async def test_posts_payload_with_secret(self, monkeypatch):
        import httpx
        import respx

        b = Lumen(_cfg())
        monkeypatch.setattr(b, "wait_until_ready", AsyncMock())
        monkeypatch.setenv("ATLAS_HEARTBEAT_SECRET", "s3cr3t")
        monkeypatch.setenv("ATLAS_HEARTBEAT_URL", "http://127.0.0.1:9999/heartbeat")

        calls = {"n": 0}

        def is_closed():
            calls["n"] += 1
            return calls["n"] > 1  # loop runs exactly once

        monkeypatch.setattr(b, "is_closed", is_closed)

        sleeps = []

        async def fake_sleep(secs):
            sleeps.append(secs)

        monkeypatch.setattr(bot.asyncio, "sleep", fake_sleep)

        with respx.mock:
            route = respx.post("http://127.0.0.1:9999/heartbeat").mock(
                return_value=httpx.Response(200)
            )
            await b._atlas_heartbeat()

        assert route.called
        request = route.calls[0].request
        import json as _json

        payload = _json.loads(request.content)
        assert payload["secret"] == "s3cr3t"
        assert payload["bot"] == "lumen"
        assert sleeps == [60]

    async def test_survives_request_errors(self, monkeypatch):
        import httpx
        import respx

        b = Lumen(_cfg())
        monkeypatch.setattr(b, "wait_until_ready", AsyncMock())
        monkeypatch.setenv("ATLAS_HEARTBEAT_SECRET", "s3cr3t")
        monkeypatch.setenv("ATLAS_HEARTBEAT_URL", "http://127.0.0.1:9999/heartbeat")

        calls = {"n": 0}

        def is_closed():
            calls["n"] += 1
            return calls["n"] > 1

        monkeypatch.setattr(b, "is_closed", is_closed)

        sleeps = []

        async def fake_sleep(secs):
            sleeps.append(secs)

        monkeypatch.setattr(bot.asyncio, "sleep", fake_sleep)

        with respx.mock:
            respx.post("http://127.0.0.1:9999/heartbeat").mock(
                side_effect=httpx.ConnectError("down")
            )
            await b._atlas_heartbeat()

        # The `except Exception: pass` swallowed the request failure and the
        # loop still reached the bottom `await asyncio.sleep(60)` — proof the
        # error didn't abort the loop.
        assert sleeps == [60]


# ---------------------------------------------------------------------------
# close()
# ---------------------------------------------------------------------------


class TestClose:
    async def test_stops_listener_and_cancels_task(self, monkeypatch):
        b = Lumen(_cfg())

        async def forever():
            await asyncio.sleep(3600)

        b._listener_task = asyncio.create_task(forever())
        fake_listener = Mock()
        fake_listener.stop = AsyncMock()
        b._ws_listener = fake_listener

        monkeypatch.setattr(discord.Client, "close", AsyncMock())

        await b.close()
        await asyncio.gather(b._listener_task, return_exceptions=True)

        assert b._listener_task.cancelled()
        fake_listener.stop.assert_awaited_once()
        discord.Client.close.assert_awaited_once()

    async def test_close_with_nothing_started_is_safe(self, monkeypatch):
        b = Lumen(_cfg())
        monkeypatch.setattr(discord.Client, "close", AsyncMock())
        await b.close()  # _listener_task and _ws_listener are both None
        discord.Client.close.assert_awaited_once()


# ---------------------------------------------------------------------------
# _send_status / _send_current_picks / _send_recap / _send_dm
# ---------------------------------------------------------------------------


class TestSendStatus:
    async def test_no_listener(self):
        b = Lumen(_cfg())
        channel = _dm_channel()
        await b._send_status(channel)
        channel.send.assert_awaited_once()
        embed = channel.send.await_args.kwargs["embed"]
        assert "0 picks" in embed.description

    async def test_with_listener(self):
        b = Lumen(_cfg())
        listener = Mock()
        listener._game_tasks = {"401": object()}
        engine = Mock()
        engine.games = {"401": SimpleNamespace(picks={1: object(), 2: object()})}
        engine._resolved_pick_ids = {1}
        listener.engine = engine
        b._ws_listener = listener

        channel = _dm_channel()
        await b._send_status(channel)
        embed = channel.send.await_args.kwargs["embed"]
        assert "2 picks (1 resolved)" in embed.description
        assert "Active Games:** 1" in embed.description


class TestSendCurrentPicks:
    async def test_no_listener_sends_nothing(self):
        b = Lumen(_cfg())
        assert b._ws_listener is None
        channel = _dm_channel()
        await b._send_current_picks(channel)  # no _ws_listener -> early return
        channel.send.assert_not_awaited()

    async def test_skips_empty_or_scheduled_games(self):
        from game_context import GameState

        b = Lumen(_cfg())
        listener = Mock()
        g1 = GameState(game_id="1", home_team="A", away_team="B", status="scheduled")
        g2 = GameState(game_id="2", home_team="C", away_team="D")  # no picks
        engine = Mock()
        engine.games = {"1": g1, "2": g2}
        listener.engine = engine
        b._ws_listener = listener

        channel = _dm_channel()
        await b._send_current_picks(channel)
        channel.send.assert_not_awaited()

    async def test_sends_embed_per_game_with_picks(self):
        from game_context import GameState

        b = Lumen(_cfg())
        listener = Mock()
        game = GameState(
            game_id="1", home_team="BOS", away_team="NYK", status="live", quarter=2, clock="5:00"
        )
        unresolved = _pick_ctx()
        unresolved.actual_value = 18.0
        resolved_hit = _pick_ctx(pick_id=2, player_name="Brown")
        resolved_hit.is_hit = True
        resolved_hit.actual_value = 30.0
        resolved_miss = _pick_ctx(pick_id=3, player_name="White")
        resolved_miss.is_hit = False
        game.picks = {1: unresolved, 2: resolved_hit, 3: resolved_miss}
        engine = Mock()
        engine.games = {"1": game}
        listener.engine = engine
        b._ws_listener = listener

        channel = _dm_channel()
        await b._send_current_picks(channel)
        channel.send.assert_awaited_once()
        embed = channel.send.await_args.kwargs["embed"]
        names = [f.name for f in embed.fields]
        assert any("Jayson Tatum" in n for n in names)
        assert any("Brown" in n for n in names)
        assert any("White" in n for n in names)

    async def test_default_quarter_zero_skips_ql_override(self):
        """A freshly-created GameState defaults to quarter=0 — `if game.quarter
        and game.clock:` is then false and `status` stays the plain upper-cased
        game.status instead of a 'Qn clock' string."""
        from game_context import GameState

        b = Lumen(_cfg())
        listener = Mock()
        game = GameState(game_id="1", home_team="BOS", away_team="NYK", status="live")
        game.picks = {1: _pick_ctx()}
        engine = Mock()
        engine.games = {"1": game}
        listener.engine = engine
        b._ws_listener = listener

        channel = _dm_channel()
        await b._send_current_picks(channel)
        embed = channel.send.await_args.kwargs["embed"]
        assert "LIVE" in embed.description


class TestSendRecap:
    async def test_no_listener(self):
        b = Lumen(_cfg())
        assert b._ws_listener is None
        channel = _dm_channel()
        await b._send_recap(channel)  # early return
        channel.send.assert_not_awaited()

    async def test_no_resolved_picks(self):
        b = Lumen(_cfg())
        listener = Mock()
        engine = Mock()
        engine.get_all_resolved_today = Mock(return_value=[])
        listener.engine = engine
        b._ws_listener = listener

        channel = _dm_channel()
        await b._send_recap(channel)
        channel.send.assert_awaited_once_with("No resolved picks yet today.")

    async def test_with_resolved_picks(self):
        b = Lumen(_cfg())
        listener = Mock()
        pick = _pick_ctx()
        pick.is_hit = True
        pick.actual_value = 30.0
        engine = Mock()
        engine.get_all_resolved_today = Mock(return_value=[pick])
        listener.engine = engine
        listener.formatter = bot.PickFormatter()
        b._ws_listener = listener

        channel = _dm_channel()
        await b._send_recap(channel)
        channel.send.assert_awaited_once()
        embed = channel.send.await_args.kwargs["embed"]
        assert "Daily Recap" in embed.title


class TestSendDm:
    async def test_sends_to_owner(self, monkeypatch):
        b = Lumen(_cfg())
        user = Mock()
        user.send = AsyncMock()
        monkeypatch.setattr(b, "fetch_user", AsyncMock(return_value=user))
        await b._send_dm(content="hi", embed=None)
        user.send.assert_awaited_once_with(content="hi", embed=None)

    async def test_forbidden_is_logged_not_raised(self, monkeypatch, caplog):
        b = Lumen(_cfg())

        async def raise_forbidden(_):
            raise discord.Forbidden(Mock(status=403), "no dms")

        monkeypatch.setattr(b, "fetch_user", raise_forbidden)
        with caplog.at_level(logging.WARNING, logger="lumen"):
            await b._send_dm(content="hi")  # must not raise

        assert "Cannot DM owner" in caplog.text

    async def test_generic_exception_is_logged_not_raised(self, monkeypatch, caplog):
        b = Lumen(_cfg())
        monkeypatch.setattr(b, "fetch_user", AsyncMock(side_effect=RuntimeError("boom")))
        with caplog.at_level(logging.ERROR, logger="lumen"):
            await b._send_dm(content="hi")  # must not raise

        assert "Failed to send DM" in caplog.text

    async def test_falsy_user_sends_nothing(self, monkeypatch):
        b = Lumen(_cfg())

        class FalsyUser:
            """Falsy stand-in for `if user:` — still trackable via .send."""

            def __bool__(self):
                return False

            def __init__(self):
                self.send = AsyncMock()

        falsy_user = FalsyUser()
        monkeypatch.setattr(b, "fetch_user", AsyncMock(return_value=falsy_user))
        await b._send_dm(content="hi")  # `if user:` false -> no .send() call, no raise
        falsy_user.send.assert_not_awaited()


def _pick_ctx(**overrides):
    from game_context import PickContext

    defaults = dict(
        pick_id=1,
        player_name="Jayson Tatum",
        team="BOS",
        opponent_team="NYK",
        market="POINTS",
        line=26.5,
        prediction="OVER",
        tier="X",
        model_version="v3",
        book="DraftKings",
        is_home=True,
    )
    defaults.update(overrides)
    return PickContext(**defaults)


# ---------------------------------------------------------------------------
# on_ready / _init_brain
# ---------------------------------------------------------------------------


class TestOnReady:
    async def _prep(self, monkeypatch, b, atlas_secret=None):
        monkeypatch.setattr(b, "change_presence", AsyncMock())
        b._connection.user = SimpleNamespace(id=999)

        async def forever():
            await asyncio.sleep(3600)

        monkeypatch.setattr(b, "_health_server", forever)
        monkeypatch.setattr(bot.WSListener, "run", lambda self: forever())
        monkeypatch.setattr(b, "_atlas_heartbeat", forever)
        if atlas_secret is not None:
            monkeypatch.setenv("ATLAS_HEARTBEAT_SECRET", atlas_secret)
        else:
            monkeypatch.delenv("ATLAS_HEARTBEAT_SECRET", raising=False)

    async def test_starts_listener_and_brain_without_atlas_secret(self, monkeypatch):
        b = Lumen(_cfg())
        await self._prep(monkeypatch, b, atlas_secret=None)

        await b.on_ready()

        assert b._ws_listener is not None
        assert b._listener_task is not None
        assert b._brain is not None
        b.change_presence.assert_awaited_once()

    async def test_starts_atlas_heartbeat_when_secret_present(self, monkeypatch):
        b = Lumen(_cfg())
        await self._prep(monkeypatch, b, atlas_secret="shh")
        heartbeat_started = asyncio.Event()

        async def marks_started():
            heartbeat_started.set()
            await asyncio.sleep(3600)

        monkeypatch.setattr(b, "_atlas_heartbeat", marks_started)

        await b.on_ready()
        await asyncio.wait_for(heartbeat_started.wait(), timeout=1)


class TestInitBrain:
    def test_wires_tools_and_builds_identity(self, monkeypatch):
        b = Lumen(_cfg())
        b._ws_listener = Mock()
        b._ws_listener.engine = Mock(games={})
        b._init_brain()
        assert b._brain is not None
        assert b._brain.identity.name == "Lumen"

    def test_without_ws_listener(self):
        b = Lumen(_cfg())
        assert b._ws_listener is None
        b._init_brain()  # init_tools guarded by `if self._ws_listener:`
        assert b._brain is not None

    async def test_lumen_context_no_listener(self):
        b = Lumen(_cfg())
        b._init_brain()
        ctx = await b._brain.identity.context_fn()
        assert "No listener active" in ctx

    async def test_lumen_context_current_time_is_eastern_not_utc(self):
        """The brain's CURRENT TIME line must be Eastern, never bare UTC
        (owner rule: never display bare UTC)."""
        b = Lumen(_cfg())
        listener = Mock()
        engine = Mock()
        engine.games = {}
        engine._resolved_pick_ids = set()
        engine.get_all_resolved_today = Mock(return_value=[])
        listener.engine = engine
        b._ws_listener = listener
        b._init_brain()

        # 20:00 UTC on Jan 15 is 15:00 EST (winter, UTC-5) in real ET.
        with time_machine.travel(datetime(2026, 1, 15, 20, 0, tzinfo=timezone.utc)):
            ctx = await b._brain.identity.context_fn()

        assert "CURRENT TIME: 2026-01-15 15:00 EST" in ctx
        assert "UTC" not in ctx

    async def test_lumen_context_no_games_tracked(self):
        b = Lumen(_cfg())
        listener = Mock()
        engine = Mock()
        engine.games = {}
        engine._resolved_pick_ids = set()
        engine.get_all_resolved_today = Mock(return_value=[])
        listener.engine = engine
        b._ws_listener = listener
        b._init_brain()

        ctx = await b._brain.identity.context_fn()
        assert "ACTIVE GAMES: None being tracked" in ctx
        assert "PICKS:" not in ctx
        assert "TODAY'S RECORD" not in ctx

    async def test_lumen_context_with_games_and_record(self):
        from game_context import GameState

        b = Lumen(_cfg())
        listener = Mock()
        g_live = GameState(
            game_id="1", home_team="BOS", away_team="NYK", status="live", quarter=2, clock="5:00"
        )
        g_final = GameState(game_id="2", home_team="LAL", away_team="GSW", status="final")
        g_half = GameState(game_id="3", home_team="MIA", away_team="PHI", status="halftime")
        g_sched = GameState(game_id="4", home_team="DAL", away_team="DEN", status="scheduled")
        pick = _pick_ctx()
        pick.is_hit = True
        g_live.picks = {1: pick}
        engine = Mock()
        engine.games = {"1": g_live, "2": g_final, "3": g_half, "4": g_sched}
        engine._resolved_pick_ids = {1}
        engine.get_all_resolved_today = Mock(return_value=[pick])
        listener.engine = engine
        b._ws_listener = listener
        b._init_brain()

        ctx = await b._brain.identity.context_fn()
        assert "ACTIVE GAMES" in ctx
        assert "FINAL" in ctx
        assert "Halftime" in ctx
        assert "Scheduled" in ctx
        assert "PICKS: 1 tracked, 1 resolved" in ctx
        assert "TODAY'S RECORD: 1W-0L" in ctx


# ---------------------------------------------------------------------------
# setup_logging
# ---------------------------------------------------------------------------


def test_setup_logging_configures_root_handler():
    bot.setup_logging()
    import logging

    root = logging.getLogger()
    assert any(isinstance(h, logging.StreamHandler) for h in root.handlers)


# ---------------------------------------------------------------------------
# main()
# ---------------------------------------------------------------------------


class TestMain:
    def test_exits_without_token(self, monkeypatch):
        monkeypatch.delenv("DISCORD_TOKEN", raising=False)
        with pytest.raises(SystemExit) as exc_info:
            bot.main()
        assert exc_info.value.code == 1

    def test_starts_bot_when_token_present(self, monkeypatch):
        monkeypatch.setenv("DISCORD_TOKEN", "fake-token")
        run_mock = Mock()
        monkeypatch.setattr(bot.Lumen, "run", run_mock)
        bot.main()
        run_mock.assert_called_once()
        args, kwargs = run_mock.call_args
        assert args[0] == "fake-token"
        assert kwargs["log_handler"] is None
