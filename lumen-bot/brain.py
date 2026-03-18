"""CephalonBrain — Claude API integration for Lumen.

Self-contained adaptation of the shared Cephalon brain module.
Handles: async Anthropic client, per-user conversation history,
rate limiting, and tool_use loop (up to 5 rounds).
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional

log = logging.getLogger("lumen.brain")

MODEL = "claude-sonnet-4-5-20250929"
MAX_TOOL_TURNS = 5


# ---------------------------------------------------------------------------
# Conversation history (in-memory, per-user, with TTL)
# ---------------------------------------------------------------------------


class ConversationHistory:
    """Per-user conversation history with TTL and turn limit."""

    def __init__(self, max_turns: int = 20, ttl_seconds: int = 3600) -> None:
        self.max_turns = max_turns
        self.ttl_seconds = ttl_seconds
        self._convos: dict[int, dict] = {}  # user_id -> {"messages": [...], "last_active": float}

    def get_messages(self, user_id: int) -> list[dict]:
        convo = self._convos.get(user_id)
        if not convo:
            return []
        if time.time() - convo["last_active"] > self.ttl_seconds:
            self._convos.pop(user_id, None)
            return []
        return list(convo["messages"])

    def add_exchange(self, user_id: int, user_msg: str, assistant_msg: str) -> None:
        convo = self._convos.setdefault(user_id, {"messages": [], "last_active": 0.0})
        convo["messages"].append({"role": "user", "content": user_msg})
        convo["messages"].append({"role": "assistant", "content": assistant_msg})
        if len(convo["messages"]) > self.max_turns * 2:
            convo["messages"] = convo["messages"][-(self.max_turns * 2) :]
        convo["last_active"] = time.time()

    def clear(self, user_id: int) -> None:
        self._convos.pop(user_id, None)


# ---------------------------------------------------------------------------
# Rate limiter (per-user cooldown + daily cap)
# ---------------------------------------------------------------------------


class RateLimiter:
    """Per-user cooldown and daily message limits."""

    def __init__(self, cooldown_seconds: int = 5, daily_limit: int = 50) -> None:
        self.cooldown_seconds = cooldown_seconds
        self.daily_limit = daily_limit
        self._last_use: dict[int, float] = {}
        self._daily_counts: dict[int, int] = {}
        self._day_key: dict[int, str] = {}

    def check(self, user_id: int) -> str | None:
        now = time.time()
        today = time.strftime("%Y-%m-%d")

        if self._day_key.get(user_id) != today:
            self._daily_counts[user_id] = 0
            self._day_key[user_id] = today

        if self._daily_counts.get(user_id, 0) >= self.daily_limit:
            return (
                "Daily limit reached. My systems need to cool down, Operator. Try again tomorrow."
            )

        last = self._last_use.get(user_id, 0)
        remaining = self.cooldown_seconds - (now - last)
        if remaining > 0:
            return f"Cooldown active. Wait {remaining:.0f}s, Operator."

        return None

    def record(self, user_id: int) -> None:
        self._last_use[user_id] = time.time()
        self._daily_counts[user_id] = self._daily_counts.get(user_id, 0) + 1


# ---------------------------------------------------------------------------
# Bot identity
# ---------------------------------------------------------------------------


@dataclass
class BotIdentity:
    """Configuration for a Cephalon bot."""

    name: str
    system_prompt: str
    context_fn: Callable[[], Awaitable[str]]
    admin_ids: set[int] = field(default_factory=set)
    cooldown_seconds: int = 5
    daily_limit: int = 50
    tools: Optional[list[dict]] = None
    tool_handler: Optional[Callable[[str, dict[str, Any], int], str]] = None
    max_response_tokens: int = 1200


# ---------------------------------------------------------------------------
# CephalonBrain
# ---------------------------------------------------------------------------


class CephalonBrain:
    """Wraps Anthropic's async API with per-user history, rate limiting, and tool loop."""

    def __init__(self, identity: BotIdentity) -> None:
        self.identity = identity
        self.history = ConversationHistory(max_turns=20, ttl_seconds=3600)
        self.limiter = RateLimiter(
            cooldown_seconds=identity.cooldown_seconds,
            daily_limit=identity.daily_limit,
        )
        self._client = None
        self._available = False
        self._init_client()

    def _init_client(self) -> None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            log.warning("%s: ANTHROPIC_API_KEY not set — AI features disabled", self.identity.name)
            return

        try:
            import anthropic

            self._client = anthropic.AsyncAnthropic(api_key=api_key)
            self._available = True
            log.info("%s: AI brain initialized (model=%s)", self.identity.name, MODEL)
        except ImportError:
            log.warning(
                "%s: anthropic package not installed — AI features disabled", self.identity.name
            )
        except Exception as e:
            log.error("%s: Failed to init Anthropic client: %s", self.identity.name, e)

    @property
    def available(self) -> bool:
        return self._available

    async def respond(
        self,
        user_id: int,
        message: str,
        user_name: Optional[str] = None,
        extra_context: Optional[str] = None,
    ) -> str:
        """Generate a conversational response with history and live context."""
        if not self._available:
            return (
                f"My neural link is offline, Operator. "
                f"({self.identity.name} AI features are not configured.)"
            )

        error = self.limiter.check(user_id)
        if error:
            return error

        system = await self._build_system(extra_context=extra_context, user_name=user_name)
        history = self.history.get_messages(user_id)
        messages = history + [{"role": "user", "content": message}]

        try:
            reply = await self._call_with_tools(system, messages, user_id=user_id)
            self.history.add_exchange(user_id, message, reply)
            self.limiter.record(user_id)
            return reply
        except Exception as e:
            log.error("%s: API error for user %s: %s", self.identity.name, user_id, e)
            return "A transient error in my neural link. Please try again, Operator."

    def clear_history(self, user_id: int) -> None:
        self.history.clear(user_id)

    async def _call_with_tools(self, system: str, messages: list[dict], user_id: int = 0) -> str:
        """API call with optional tool_use loop (up to MAX_TOOL_TURNS rounds)."""
        has_tools = bool(self.identity.tools and self.identity.tool_handler)
        kwargs: dict[str, Any] = {
            "model": MODEL,
            "max_tokens": self.identity.max_response_tokens,
            "system": system,
            "messages": messages,
        }
        if has_tools:
            kwargs["tools"] = self.identity.tools

        response = None
        for turn in range(MAX_TOOL_TURNS + 1):
            response = await self._client.messages.create(**kwargs)

            if not has_tools or response.stop_reason != "tool_use":
                return self._extract_text(response)

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    log.info(
                        "%s: Tool call [%d/%d] %s(%s)",
                        self.identity.name,
                        turn + 1,
                        MAX_TOOL_TURNS,
                        block.name,
                        block.input,
                    )
                    try:
                        result = self.identity.tool_handler(block.name, block.input, user_id)
                    except Exception as e:
                        log.error("%s: Tool %s error: %s", self.identity.name, block.name, e)
                        result = f"Tool error: {e}"

                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result,
                        }
                    )

            kwargs["messages"] = messages + [
                {"role": "assistant", "content": response.content},
                {"role": "user", "content": tool_results},
            ]
            messages = kwargs["messages"]

        log.warning("%s: Exhausted %d tool turns", self.identity.name, MAX_TOOL_TURNS)
        return self._extract_text(response)

    @staticmethod
    def _extract_text(response) -> str:
        parts = []
        for block in response.content:
            if hasattr(block, "text"):
                parts.append(block.text)
        return "\n".join(parts) if parts else "I wasn't able to formulate a response."

    async def _build_system(
        self,
        extra_context: Optional[str] = None,
        user_name: Optional[str] = None,
    ) -> str:
        """Build system prompt: personality + live context."""
        parts = [self.identity.system_prompt]

        parts.append(
            "RESPONSE LENGTH: Keep every response under 1000 characters. "
            "Be direct — lead with the answer, skip preamble. "
            "LIVE DATA (below) = game state and pick tracking context. "
            "TOOLS = live queries for detailed pick/game data. "
            "Use tools proactively when the Operator asks about picks, pace, or games."
        )

        if user_name:
            parts.append(f"CURRENT OPERATOR: {user_name}")

        try:
            live = await self.identity.context_fn()
            if live:
                parts.append(f"\n--- LIVE DATA ---\n{live}")
        except Exception as e:
            log.warning("%s: Context fetch failed: %s", self.identity.name, e)

        if extra_context:
            parts.append(f"\n--- ADDITIONAL CONTEXT ---\n{extra_context}")

        return "\n\n".join(parts)
