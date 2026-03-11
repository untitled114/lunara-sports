"""WebSocket listener for Lunara's live pick feed.

Polls /picks/today to discover active games, then opens a WebSocket
per game to receive pick_update messages. Triggers DM alerts based
on pick state transitions.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Callable

import httpx
import websockets

from formatter import PickFormatter

log = logging.getLogger("lumen.ws")

# How often to re-poll /picks/today for new games
POLL_INTERVAL = 300  # 5 minutes
# How often to retry a failed WS connection
WS_RETRY_DELAY = 10


class PickState:
    """Tracks per-pick state to prevent duplicate alerts."""

    __slots__ = ("pick_id", "last_actual", "is_hit", "approach_alerted", "mid_game_hit_alerted")

    def __init__(self, pick_id: int):
        self.pick_id = pick_id
        self.last_actual: float | None = None
        self.is_hit: bool | None = None
        self.approach_alerted: bool = False
        self.mid_game_hit_alerted: bool = False


class WSListener:
    def __init__(
        self,
        api_url: str,
        ws_url: str,
        alert_cfg: dict,
        send_dm: Callable,
        formatter: PickFormatter,
    ) -> None:
        self.api_url = api_url.rstrip("/")
        self.ws_url = ws_url.rstrip("/")
        self.alert_cfg = alert_cfg
        self.send_dm = send_dm
        self.formatter = formatter
        self._running = True
        self._pick_states: dict[int, PickState] = {}
        self._active_games: set[str] = set()
        self._game_tasks: dict[str, asyncio.Task] = {}
        self._all_picks: list[dict] = []

    async def run(self) -> None:
        """Main loop: poll for picks, manage WS connections per game."""
        while self._running:
            try:
                await self._poll_and_subscribe()
            except Exception:
                log.exception("Poll cycle error")
            await asyncio.sleep(POLL_INTERVAL)

    async def stop(self) -> None:
        self._running = False
        for task in self._game_tasks.values():
            task.cancel()
        self._game_tasks.clear()

    async def _poll_and_subscribe(self) -> None:
        """Fetch today's picks, send summary if new, subscribe to games."""
        picks = await self._fetch_picks()
        if picks is None:
            return

        # Initialize state for new picks
        for pick in picks:
            if pick["id"] not in self._pick_states:
                self._pick_states[pick["id"]] = PickState(pick["id"])

        self._all_picks = picks

        # Subscribe to game WebSockets
        game_ids = {p["game_id"] for p in picks if p.get("is_hit") is None}
        for game_id in game_ids:
            if game_id not in self._game_tasks or self._game_tasks[game_id].done():
                self._game_tasks[game_id] = asyncio.create_task(self._listen_game(game_id))

        # Clean up finished games
        for gid in list(self._game_tasks):
            if gid not in game_ids:
                self._game_tasks[gid].cancel()
                del self._game_tasks[gid]

    async def _fetch_picks(self) -> list[dict] | None:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self.api_url}/picks/today")
                if resp.status_code != 200:
                    log.warning("Failed to fetch picks: %d", resp.status_code)
                    return None
                data = resp.json()
                return data.get("picks", data) if isinstance(data, dict) else data
        except Exception:
            log.exception("Error fetching picks")
            return None

    async def _listen_game(self, game_id: str) -> None:
        """Connect to WS for a game and process pick_update messages."""
        url = f"{self.ws_url}/{game_id}"
        while self._running:
            try:
                async with websockets.connect(url) as ws:
                    log.info("Connected to WS: %s", game_id)
                    async for raw in ws:
                        try:
                            msg = json.loads(raw)
                            if msg.get("type") == "pick_update":
                                await self._handle_pick_updates(msg["data"]["picks"])
                        except (json.JSONDecodeError, KeyError):
                            continue
            except websockets.ConnectionClosed:
                log.info("WS disconnected: %s — reconnecting", game_id)
            except Exception:
                log.exception("WS error for %s", game_id)
            await asyncio.sleep(WS_RETRY_DELAY)

    async def _handle_pick_updates(self, picks: list[dict]) -> None:
        """Process pick updates and trigger DM alerts."""
        threshold = self.alert_cfg.get("approach_threshold", 2.0)

        for pick in picks:
            pid = pick.get("id")
            if pid is None:
                continue

            state = self._pick_states.get(pid)
            if state is None:
                state = PickState(pid)
                self._pick_states[pid] = state

            actual = pick.get("actual_value")
            is_hit = pick.get("is_hit")
            line = pick.get("line")

            # Hit/miss alert (game final)
            if is_hit is not None and state.is_hit is None:
                state.is_hit = is_hit
                if self.alert_cfg.get("hit_miss", True):
                    embed = self.formatter.result_embed(pick)
                    await self.send_dm(embed=embed)
                    log.info(
                        "Result alert: %s %s %.1f — %s",
                        pick.get("player_name"),
                        pick.get("market"),
                        actual or 0,
                        "HIT" if is_hit else "MISS",
                    )
                continue

            # Mid-game hit detection (OVER cleared before game final)
            if (
                actual is not None
                and line is not None
                and is_hit is None
                and not state.mid_game_hit_alerted
            ):
                prediction = pick.get("prediction", "").upper()
                cleared = (prediction == "OVER" and actual > line) or (
                    prediction == "UNDER" and actual < line
                )
                if cleared:
                    state.mid_game_hit_alerted = True
                    state.approach_alerted = True  # skip approaching alert
                    embed = self.formatter.mid_game_hit_embed(pick)
                    await self.send_dm(embed=embed)
                    log.info(
                        "Mid-game hit: %s %s %.1f (line: %.1f)",
                        pick.get("player_name"),
                        prediction,
                        actual,
                        line,
                    )
                    state.last_actual = actual
                    continue

            # Approaching line alert (live game)
            if (
                actual is not None
                and line is not None
                and is_hit is None
                and not state.approach_alerted
                and self.alert_cfg.get("approaching_line", True)
            ):
                diff = abs(actual - line)
                if diff <= threshold and actual != state.last_actual:
                    state.approach_alerted = True
                    embed = self.formatter.approaching_embed(pick)
                    await self.send_dm(embed=embed)
                    log.info(
                        "Approaching alert: %s at %.1f (line: %.1f)",
                        pick.get("player_name"),
                        actual,
                        line,
                    )

            state.last_actual = actual
