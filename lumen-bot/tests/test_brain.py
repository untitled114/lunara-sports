"""Characterization tests for brain.py — CephalonBrain / Anthropic integration."""

import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock

import time_machine

sys.path.insert(0, str(Path(__file__).parent.parent))

import brain  # noqa: E402
from brain import BotIdentity, CephalonBrain, ConversationHistory, RateLimiter  # noqa: E402

# ---------------------------------------------------------------------------
# ConversationHistory
# ---------------------------------------------------------------------------


class TestConversationHistory:
    def test_get_messages_empty_for_unknown_user(self):
        h = ConversationHistory()
        assert h.get_messages(1) == []

    def test_add_and_get(self):
        h = ConversationHistory()
        h.add_exchange(1, "hi", "hello")
        msgs = h.get_messages(1)
        assert msgs == [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
        ]

    def test_max_turns_trim(self):
        h = ConversationHistory(max_turns=2)
        for i in range(5):
            h.add_exchange(1, f"u{i}", f"a{i}")
        msgs = h.get_messages(1)
        assert len(msgs) == 4  # 2 turns * 2 messages
        assert msgs[0] == {"role": "user", "content": "u3"}
        assert msgs[-1] == {"role": "assistant", "content": "a4"}

    def test_ttl_expiry(self):
        h = ConversationHistory(ttl_seconds=60)
        with time_machine.travel(datetime(2026, 1, 1, tzinfo=timezone.utc)):
            h.add_exchange(1, "hi", "hello")
        with time_machine.travel(datetime(2026, 1, 1, 0, 2, tzinfo=timezone.utc)):  # +120s
            assert h.get_messages(1) == []
            assert 1 not in h._convos

    def test_clear(self):
        h = ConversationHistory()
        h.add_exchange(1, "hi", "hello")
        h.clear(1)
        assert h.get_messages(1) == []

    def test_clear_unknown_user_is_a_noop(self):
        h = ConversationHistory()
        h.add_exchange(1, "hi", "hello")  # unrelated user's history present
        h.clear(999)  # user_id not tracked — must not raise or touch user 1
        assert h.get_messages(1) == [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
        ]
        assert 999 not in h._convos


# ---------------------------------------------------------------------------
# RateLimiter
# ---------------------------------------------------------------------------


class TestRateLimiter:
    def test_first_use_allowed(self):
        limiter = RateLimiter(cooldown_seconds=5, daily_limit=50)
        assert limiter.check(1) is None

    def test_cooldown_message(self):
        limiter = RateLimiter(cooldown_seconds=5, daily_limit=50)
        limiter.record(1)
        msg = limiter.check(1)
        assert msg is not None
        assert msg.startswith("Cooldown active.")

    def test_cooldown_expires(self, monkeypatch):
        limiter = RateLimiter(cooldown_seconds=5, daily_limit=50)
        limiter.record(1)
        future = time.time() + 10
        monkeypatch.setattr(time, "time", lambda: future)
        assert limiter.check(1) is None

    def test_daily_limit_message(self):
        limiter = RateLimiter(cooldown_seconds=0, daily_limit=1)
        # check() must run first to seed _day_key — record() alone doesn't set
        # it, so calling record() before any check() would let the next
        # check()'s day-key mismatch wipe the count back to 0.
        assert limiter.check(1) is None
        limiter.record(1)
        msg = limiter.check(1)
        assert msg == (
            "Daily limit reached. My systems need to cool down, Operator. Try again tomorrow."
        )

    def test_reset_on_new_day(self, monkeypatch):
        limiter = RateLimiter(cooldown_seconds=0, daily_limit=1)
        monkeypatch.setattr(brain.time, "strftime", lambda fmt: "2026-01-01")
        assert limiter.check(1) is None
        limiter.record(1)
        assert limiter.check(1) is not None  # daily limit hit

        monkeypatch.setattr(brain.time, "strftime", lambda fmt: "2026-01-02")
        assert limiter.check(1) is None  # new day, counter reset


# ---------------------------------------------------------------------------
# CephalonBrain — construction / availability
# ---------------------------------------------------------------------------


def _identity(**overrides) -> BotIdentity:
    async def ctx_fn() -> str:
        return "LIVE"

    defaults = dict(name="Lumen", system_prompt="You are Lumen.", context_fn=ctx_fn)
    defaults.update(overrides)
    return BotIdentity(**defaults)


class TestCephalonBrainInit:
    def test_unavailable_without_api_key(self, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        b = CephalonBrain(_identity())
        assert b.available is False

    def test_available_with_api_key(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
        b = CephalonBrain(_identity())
        assert b.available is True

    def test_import_error_leaves_unavailable(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
        monkeypatch.setitem(sys.modules, "anthropic", None)
        b = CephalonBrain(_identity())
        assert b.available is False

    def test_client_construction_error_leaves_unavailable(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
        import anthropic

        def boom(**kwargs):
            raise RuntimeError("bad key")

        monkeypatch.setattr(anthropic, "AsyncAnthropic", boom)
        b = CephalonBrain(_identity())
        assert b.available is False


# ---------------------------------------------------------------------------
# CephalonBrain.respond
# ---------------------------------------------------------------------------


class FakeBlock:
    def __init__(self, type_, text=None, name=None, input=None, id=None):
        self.type = type_
        if text is not None:
            self.text = text
        self.name = name
        self.input = input
        self.id = id


class FakeResponse:
    def __init__(self, content, stop_reason):
        self.content = content
        self.stop_reason = stop_reason


def _make_brain(monkeypatch, **identity_overrides) -> CephalonBrain:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    b = CephalonBrain(_identity(**identity_overrides))
    assert b.available
    return b


class TestRespond:
    async def test_unavailable_brain_returns_offline_message(self, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        b = CephalonBrain(_identity())
        reply = await b.respond(1, "hello")
        assert "offline" in reply
        assert "Lumen" in reply

    async def test_rate_limited_returns_limiter_message(self, monkeypatch):
        b = _make_brain(monkeypatch)
        b.limiter.check = lambda user_id: "Cooldown active. Wait 3s, Operator."
        reply = await b.respond(1, "hello")
        assert reply == "Cooldown active. Wait 3s, Operator."

    async def test_plain_text_reply(self, monkeypatch):
        b = _make_brain(monkeypatch)
        response = FakeResponse([FakeBlock("text", text="Hi Operator.")], "end_turn")
        b._client.messages.create = AsyncMock(return_value=response)

        reply = await b.respond(1, "hello", user_name="Lotus")

        assert reply == "Hi Operator."
        assert b.history.get_messages(1) == [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "Hi Operator."},
        ]

    async def test_tool_use_turn_then_text(self, monkeypatch):
        called = {}

        def handler(name, inputs, user_id):
            called["name"] = name
            called["inputs"] = inputs
            called["user_id"] = user_id
            return "tool result text"

        b = _make_brain(monkeypatch, tools=[{"name": "get_x"}], tool_handler=handler)

        tool_response = FakeResponse(
            [
                FakeBlock("text", text="Let me check that."),  # non tool_use block in the mix
                FakeBlock("tool_use", name="get_x", input={"a": 1}, id="tool_1"),
            ],
            "tool_use",
        )
        final_response = FakeResponse([FakeBlock("text", text="Here you go.")], "end_turn")
        b._client.messages.create = AsyncMock(side_effect=[tool_response, final_response])

        reply = await b.respond(7, "what's the status")

        assert reply == "Here you go."
        assert called == {"name": "get_x", "inputs": {"a": 1}, "user_id": 7}

    async def test_tool_handler_exception_becomes_tool_error_result(self, monkeypatch):
        def handler(name, inputs, user_id):
            raise ValueError("boom")

        b = _make_brain(monkeypatch, tools=[{"name": "get_x"}], tool_handler=handler)

        tool_response = FakeResponse(
            [FakeBlock("tool_use", name="get_x", input={}, id="tool_1")],
            "tool_use",
        )
        final_response = FakeResponse([FakeBlock("text", text="ok")], "end_turn")
        create = AsyncMock(side_effect=[tool_response, final_response])
        b._client.messages.create = create

        reply = await b.respond(1, "hi")

        assert reply == "ok"
        second_call_kwargs = create.await_args_list[1].kwargs
        tool_result_msg = second_call_kwargs["messages"][-1]
        assert tool_result_msg["content"][0]["content"] == "Tool error: boom"

    async def test_max_tool_turns_exhausted(self, monkeypatch):
        b = _make_brain(
            monkeypatch,
            tools=[{"name": "get_x"}],
            tool_handler=lambda name, inputs, user_id: "r",
        )

        def always_tool_use(**kwargs):
            return FakeResponse(
                [FakeBlock("tool_use", name="get_x", input={}, id="t")],
                "tool_use",
            )

        b._client.messages.create = AsyncMock(side_effect=always_tool_use)

        reply = await b.respond(1, "loop forever")

        assert reply == "I wasn't able to formulate a response."
        assert b._client.messages.create.await_count == brain.MAX_TOOL_TURNS + 1

    async def test_api_exception_returns_fallback(self, monkeypatch):
        b = _make_brain(monkeypatch)
        b._client.messages.create = AsyncMock(side_effect=RuntimeError("network down"))

        reply = await b.respond(1, "hello")

        assert reply == "A transient error in my neural link. Please try again, Operator."


class TestClearHistory:
    async def test_clear_history_delegates_to_history(self, monkeypatch):
        b = _make_brain(monkeypatch)
        response = FakeResponse([FakeBlock("text", text="hi")], "end_turn")
        b._client.messages.create = AsyncMock(return_value=response)
        await b.respond(1, "hello")
        assert b.history.get_messages(1) != []
        b.clear_history(1)
        assert b.history.get_messages(1) == []


# ---------------------------------------------------------------------------
# _extract_text
# ---------------------------------------------------------------------------


class TestExtractText:
    def test_mixed_content_blocks(self):
        response = FakeResponse(
            [
                FakeBlock("text", text="Hello"),
                FakeBlock("tool_use", name="foo", input={}, id="1"),
                FakeBlock("text", text="World"),
            ],
            "end_turn",
        )
        assert CephalonBrain._extract_text(response) == "Hello\nWorld"

    def test_no_text_blocks_returns_fallback(self):
        response = FakeResponse([FakeBlock("tool_use", name="foo", input={}, id="1")], "tool_use")
        assert CephalonBrain._extract_text(response) == "I wasn't able to formulate a response."


# ---------------------------------------------------------------------------
# _build_system
# ---------------------------------------------------------------------------


class TestBuildSystem:
    async def test_includes_identity_and_context_and_extras(self, monkeypatch):
        b = _make_brain(monkeypatch)
        system = await b._build_system(extra_context="EXTRA STUFF", user_name="Lotus")
        assert "You are Lumen." in system
        assert "CURRENT OPERATOR: Lotus" in system
        assert "LIVE DATA" in system
        assert "LIVE" in system
        assert "ADDITIONAL CONTEXT" in system
        assert "EXTRA STUFF" in system

    async def test_no_user_name_or_extra_context(self, monkeypatch):
        b = _make_brain(monkeypatch)
        system = await b._build_system()
        assert "CURRENT OPERATOR" not in system
        assert "ADDITIONAL CONTEXT" not in system

    async def test_context_fn_returning_falsy_skips_live_section(self, monkeypatch):
        async def empty_ctx() -> str:
            return ""

        b = _make_brain(monkeypatch, context_fn=empty_ctx)
        system = await b._build_system()
        assert "--- LIVE DATA ---" not in system

    async def test_context_fn_exception_is_swallowed(self, monkeypatch):
        async def broken_ctx() -> str:
            raise RuntimeError("engine offline")

        b = _make_brain(monkeypatch, context_fn=broken_ctx)
        system = await b._build_system()  # must not raise
        assert "You are Lumen." in system
