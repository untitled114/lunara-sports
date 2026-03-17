"""WebSocket listener — Lumen's real-time nervous system.

Polls /picks/today to discover active games, connects to per-game
WebSocket feeds, and processes both game_update and pick_update messages.
Feeds everything through the Game Context Engine and Intelligence Engine
to generate context-aware alerts.

Also subscribes to /ws/scoreboard for game state transitions (tipoff,
halftime, final) that drive the daily lifecycle.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Callable

import httpx
import websockets

from formatter import PickFormatter
from game_context import AlertType, GameContextEngine, GameState
from game_log import GameLogRecorder
from intelligence import generate_alert_message

log = logging.getLogger("lumen.ws")

# How often to re-poll /picks/today for new games
POLL_INTERVAL = 300  # 5 minutes
# How often to retry a failed WS connection
WS_RETRY_DELAY = 10
# Minimum seconds between DMs to avoid Discord rate limits
DM_COOLDOWN = 3.0
# How often to check for daily recap
RECAP_CHECK_INTERVAL = 300  # 5 minutes
# How often to poll box scores for player minutes/fouls (seconds)
BOXSCORE_POLL_INTERVAL = 45
# How often to poll season stats (only once per player — on first pick load)
SEASON_STATS_FETCHED: set[str] = set()


class PickState:
    """Tracks per-pick state to prevent duplicate alerts (legacy path)."""

    __slots__ = (
        "pick_id",
        "last_actual",
        "is_hit",
        "approach_alerted",
        "mid_game_hit_alerted",
    )

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

        # Legacy pick state for basic alerts
        self._pick_states: dict[int, PickState] = {}
        self._all_picks: list[dict] = []

        # New: Game Context Engine (the brain)
        self.engine = GameContextEngine()
        self.game_log = GameLogRecorder()

        # Game WS task management
        self._game_tasks: dict[str, asyncio.Task] = {}
        self._scoreboard_task: asyncio.Task | None = None

        # DM pacing
        self._last_dm_time: float = 0
        self._dm_queue: asyncio.Queue = asyncio.Queue()
        self._dm_worker_task: asyncio.Task | None = None

        # Recap tracking
        self._recap_sent: bool = False
        self._summary_sent: bool = False

        # Box score poller
        self._boxscore_task: asyncio.Task | None = None

        # Season stats cache (avoid re-fetching)
        self._season_stats_fetched: set[str] = set()

    async def run(self) -> None:
        """Main loop: poll picks, manage WS connections, run intelligence."""
        # Start DM worker (paces outgoing messages)
        self._dm_worker_task = asyncio.create_task(self._dm_worker())

        # Start scoreboard listener
        self._scoreboard_task = asyncio.create_task(self._listen_scoreboard())

        # Start box score poller (for real player minutes + fouls)
        self._boxscore_task = asyncio.create_task(self._poll_box_scores_loop())

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
        if self._scoreboard_task:
            self._scoreboard_task.cancel()
        if self._dm_worker_task:
            self._dm_worker_task.cancel()
        if self._boxscore_task:
            self._boxscore_task.cancel()
        self.game_log.close()

    # ── Polling & subscription ──

    async def _poll_and_subscribe(self) -> None:
        """Fetch today's picks, register with engine, subscribe to game WS."""
        picks = await self._fetch_picks()
        if picks is None:
            return

        # Initialize legacy state
        for pick in picks:
            if pick["id"] not in self._pick_states:
                self._pick_states[pick["id"]] = PickState(pick["id"])

        self._all_picks = picks

        # Register picks with the context engine
        self.engine.register_picks(picks)

        # Send morning summary (once)
        if not self._summary_sent and picks:
            self._summary_sent = True
            embed = self.formatter.summary_embed(picks)
            await self._queue_dm(embed=embed)

            # Fetch season stats in background (once per player)
            asyncio.create_task(self._fetch_season_stats_for_picks(picks))

        # Subscribe to game WebSockets for games with pending picks
        game_ids = {p["game_id"] for p in picks if p.get("is_hit") is None}
        for game_id in game_ids:
            if game_id not in self._game_tasks or self._game_tasks[game_id].done():
                self._game_tasks[game_id] = asyncio.create_task(self._listen_game(game_id))

        # Clean up finished games
        for gid in list(self._game_tasks):
            if gid not in game_ids:
                self._game_tasks[gid].cancel()
                del self._game_tasks[gid]

        # Check for daily recap
        await self._check_daily_recap()

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

    # ── WebSocket listeners ──

    async def _listen_game(self, game_id: str) -> None:
        """Connect to WS for a game and process both game_update + pick_update."""
        url = f"{self.ws_url}/{game_id}"
        while self._running:
            try:
                async with websockets.connect(url) as ws:
                    log.info("Connected to WS: %s", game_id)
                    async for raw in ws:
                        try:
                            msg = json.loads(raw)
                            msg_type = msg.get("type")

                            if msg_type == "pick_update":
                                await self._handle_pick_updates(msg["data"]["picks"])

                            elif msg_type == "game_update":
                                await self._handle_game_update(msg["data"])

                            elif msg_type == "play":
                                await self._handle_play(game_id, msg.get("data", {}))

                            elif msg_type == "history":
                                # Initial play history on connect — bulk process
                                plays = msg.get("data", [])
                                if isinstance(plays, list) and plays:
                                    await self._handle_play_batch(game_id, plays)

                        except (json.JSONDecodeError, KeyError):
                            continue
            except websockets.ConnectionClosed:
                log.info("WS disconnected: %s — reconnecting", game_id)
            except Exception:
                log.exception("WS error for %s", game_id)
            await asyncio.sleep(WS_RETRY_DELAY)

    async def _listen_scoreboard(self) -> None:
        """Connect to scoreboard WS for game lifecycle events."""
        url = f"{self.ws_url}/scoreboard"
        while self._running:
            try:
                async with websockets.connect(url) as ws:
                    log.info("Connected to scoreboard WS")
                    async for raw in ws:
                        try:
                            msg = json.loads(raw)
                            if msg.get("type") == "scoreboard_update":
                                for game_data in msg.get("data", []):
                                    await self._handle_game_update(game_data)
                        except (json.JSONDecodeError, KeyError):
                            continue
            except websockets.ConnectionClosed:
                log.info("Scoreboard WS disconnected — reconnecting")
            except Exception:
                log.exception("Scoreboard WS error")
            await asyncio.sleep(WS_RETRY_DELAY)

    # ── Message handlers ──

    async def _handle_game_update(self, data: dict) -> None:
        """Process a game_update through the context engine."""
        alerts = self.engine.update_game(data)

        game_id = data.get("id")
        game = self.engine.games.get(game_id) if game_id else None

        # Log game state snapshot
        if game and game.status in ("live", "halftime", "final"):
            self.game_log.record_game_snapshot(game, "game_update")

        # Process intelligent alerts
        for alert_type, game_state, pick_ctx in alerts:
            await self._send_copilot_alert(alert_type, game_state, pick_ctx)

    async def _handle_pick_updates(self, picks: list[dict]) -> None:
        """Process pick updates through both legacy alerts and the context engine."""
        threshold = self.alert_cfg.get("approach_threshold", 2.0)

        # Feed through context engine for intelligent alerts
        alerts = self.engine.update_picks(picks)
        for alert_type, game_state, pick_ctx in alerts:
            await self._send_copilot_alert(alert_type, game_state, pick_ctx)
            # Log pick events
            self.game_log.record_pick_update(game_state, pick_ctx, alert_type.name)

        # Legacy alert path (approaching, mid-game hit, result)
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

            if not line or line <= 0:
                continue

            # Hit/miss (game final)
            if is_hit is not None and state.is_hit is None:
                state.is_hit = is_hit
                if self.alert_cfg.get("hit_miss", True):
                    embed = self.formatter.result_embed(pick)
                    await self._queue_dm(embed=embed)
                    log.info(
                        "Result: %s %s %.1f — %s",
                        pick.get("player_name"),
                        pick.get("market"),
                        actual or 0,
                        "HIT" if is_hit else "MISS",
                    )
                continue

            # Mid-game hit (OVER/UNDER cleared before final)
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
                    state.approach_alerted = True
                    embed = self.formatter.mid_game_hit_embed(pick)
                    await self._queue_dm(embed=embed)
                    log.info(
                        "Mid-game hit: %s %s %.1f (line: %.1f)",
                        pick.get("player_name"),
                        prediction,
                        actual,
                        line,
                    )
                    state.last_actual = actual
                    continue

            # Approaching line
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
                    await self._queue_dm(embed=embed)
                    log.info(
                        "Approaching: %s at %.1f (line: %.1f)",
                        pick.get("player_name"),
                        actual,
                        line,
                    )

            state.last_actual = actual

    # ── Play event handlers ──

    async def _handle_play(self, game_id: str, play: dict) -> None:
        """Process a single play event for scoring run / drought detection."""
        alerts = self.engine.update_plays(game_id, [play])
        for alert_type, game_state, pick_ctx in alerts:
            await self._send_copilot_alert(alert_type, game_state, pick_ctx)

    async def _handle_play_batch(self, game_id: str, plays: list[dict]) -> None:
        """Process initial play history — just seed the engine, no alerts."""
        game = self.engine.games.get(game_id)
        if game:
            for play in plays:
                seq = play.get("sequence_number", 0)
                game._play_sequences_seen.add(seq)
            # Keep last 30
            game.recent_plays = plays[-30:] if len(plays) > 30 else plays

    # ── Box score polling ──

    async def _poll_box_scores_loop(self) -> None:
        """Poll box scores for all live games to get real player minutes + fouls."""
        log.info("Box score poller started (interval=%ds)", BOXSCORE_POLL_INTERVAL)
        while self._running:
            try:
                await self._poll_box_scores()
            except Exception:
                log.exception("Box score poll error")
            await asyncio.sleep(BOXSCORE_POLL_INTERVAL)

    async def _poll_box_scores(self) -> None:
        """Fetch box scores for all live games and update pick contexts."""
        for game_id, game in self.engine.games.items():
            if game.status not in ("live", "halftime"):
                continue
            if not game.picks:
                continue

            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.get(f"{self.api_url}/games/{game_id}/boxscore")
                    if resp.status_code != 200:
                        continue
                    data = resp.json()

                # Flatten all players from home + away
                all_players = []
                for side in ("home", "away"):
                    team_data = data.get(side, {})
                    for p in team_data.get("players", []):
                        all_players.append(p)

                if not all_players:
                    continue

                # Update engine with box score data
                alerts = self.engine.update_box_score(game_id, all_players)
                for alert_type, game_state, pick_ctx in alerts:
                    await self._send_copilot_alert(alert_type, game_state, pick_ctx)

            except Exception:
                log.warning("Box score fetch failed for %s", game_id)

    # ── Season stats fetcher ──

    async def _fetch_season_stats_for_picks(self, picks: list[dict]) -> None:
        """Fetch season averages for players in picks (once per player)."""
        for pick in picks:
            player_name = pick.get("player_name", "")
            game_id = pick.get("game_id", "")
            if not player_name or not game_id:
                continue

            cache_key = f"{game_id}:{player_name}"
            if cache_key in self._season_stats_fetched:
                continue
            self._season_stats_fetched.add(cache_key)

            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    # Search for player to get their ID
                    resp = await client.get(
                        f"{self.api_url}/players",
                        params={"search": player_name},
                    )
                    if resp.status_code != 200:
                        continue

                    players = resp.json()
                    if not players:
                        continue

                    # Find best match (exact or first result)
                    player_data = players[0]
                    player_id = player_data.get("id", "")
                    if not player_id:
                        continue

                    # Fetch stats
                    stats_resp = await client.get(f"{self.api_url}/players/{player_id}/stats")
                    if stats_resp.status_code != 200:
                        continue

                    stats = stats_resp.json()
                    self.engine.update_season_stats(game_id, player_name, stats)
                    log.info(
                        "Season stats loaded: %s (%s)",
                        player_name,
                        {k: v for k, v in stats.items() if k in ("ppg", "rpg", "apg")},
                    )

            except Exception:
                log.warning("Season stats fetch failed for %s", player_name)

    # ── Copilot alert dispatch ──

    async def _send_copilot_alert(self, alert_type: AlertType, game: GameState, ctx=None) -> None:
        """Generate and send a copilot-style alert."""
        # Halftime gets a special rich embed
        if alert_type == AlertType.HALFTIME_REPORT:
            embed = self.formatter.halftime_report_embed(game)
            await self._queue_dm(embed=embed)
            log.info(
                "Halftime report: %s @ %s (%d-%d)",
                game.away_team,
                game.home_team,
                game.away_score,
                game.home_score,
            )
            return

        # All other alerts use the intelligence engine text + copilot embed
        message = generate_alert_message(alert_type, game, ctx)
        if message:
            embed = self.formatter.copilot_embed(alert_type, message, game, ctx)
            await self._queue_dm(embed=embed)
            log.info(
                "Copilot alert: %s — %s",
                alert_type.name,
                ctx.player_name if ctx else game.game_id,
            )

    # ── Daily recap ──

    async def _check_daily_recap(self) -> None:
        """Send daily recap when all games are final."""
        if self._recap_sent:
            return

        if not self.engine.games:
            return

        # Check if all tracked games are final
        all_final = all(
            g.status == "final"
            for g in self.engine.games.values()
            if g.picks  # only games with picks
        )

        if not all_final:
            return

        resolved = self.engine.get_all_resolved_today()
        if not resolved:
            return

        self._recap_sent = True
        embed = self.formatter.daily_copilot_recap(resolved)
        await self._queue_dm(embed=embed)
        log.info("Daily recap sent: %d resolved picks", len(resolved))

    # ── DM pacing ──

    async def _queue_dm(self, content: str | None = None, embed=None) -> None:
        """Queue a DM to be sent with rate limiting."""
        await self._dm_queue.put((content, embed))

    async def _dm_worker(self) -> None:
        """Process DM queue with cooldown between messages."""
        while self._running:
            try:
                content, embed = await asyncio.wait_for(self._dm_queue.get(), timeout=60)

                # Pace DMs to avoid Discord rate limits
                now = asyncio.get_event_loop().time()
                elapsed = now - self._last_dm_time
                if elapsed < DM_COOLDOWN:
                    await asyncio.sleep(DM_COOLDOWN - elapsed)

                await self.send_dm(content=content, embed=embed)
                self._last_dm_time = asyncio.get_event_loop().time()

            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception:
                log.exception("DM worker error")
                await asyncio.sleep(1)
