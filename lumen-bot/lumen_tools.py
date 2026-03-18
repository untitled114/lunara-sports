"""Lumen Tools — Claude tool definitions for game-time intelligence.

Tools query the in-memory GameContextEngine for live game state,
pick tracking, pace projections, and box score data.
"""

from __future__ import annotations

import logging
from typing import Any

from game_context import GameContextEngine, GameState, PickContext

log = logging.getLogger("lumen.tools")

# Module-level reference to the engine (set by init_tools)
_engine: GameContextEngine | None = None


def init_tools(engine: GameContextEngine) -> None:
    """Wire up the engine reference so tool handlers can query live state."""
    global _engine
    _engine = engine


# ---------------------------------------------------------------------------
# Tool schemas (Anthropic tool_use format)
# ---------------------------------------------------------------------------

TOOLS: list[dict] = [
    {
        "name": "get_active_picks",
        "description": (
            "Get all active picks being tracked right now with pace projections, "
            "comfort levels, box score data, and game context. Use when asked about "
            "tonight's picks, how picks are doing, or general status."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "game_id": {
                    "type": "string",
                    "description": "Filter to a specific game ID. Omit for all games.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_game_status",
        "description": (
            "Get current status of all tracked games: scores, quarter, clock, "
            "blowout/garbage time flags. Use when asked about scores or game state."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_pick_detail",
        "description": (
            "Deep dive on a specific player's pick: full snapshot history, "
            "pace progression, box score, comfort trend. Use when asked about "
            "a specific player's performance or pick status."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "player_name": {
                    "type": "string",
                    "description": "Player name to look up (case-insensitive, partial match OK).",
                },
            },
            "required": ["player_name"],
        },
    },
    {
        "name": "get_daily_recap",
        "description": (
            "Get today's resolved picks with W/L results. Use when asked about "
            "today's record, recap, or how we did."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_player_box_score",
        "description": (
            "Get real-time box score for a tracked player: minutes, fouls, "
            "FG%, 3P%, FT%, +/-, starter flag. Use when asked about a player's "
            "shooting, minutes, or foul situation."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "player_name": {
                    "type": "string",
                    "description": "Player name (case-insensitive, partial match OK).",
                },
            },
            "required": ["player_name"],
        },
    },
]


# ---------------------------------------------------------------------------
# Tool handler dispatch
# ---------------------------------------------------------------------------


def handle_tool(name: str, inputs: dict[str, Any], user_id: int = 0) -> str:
    """Execute a tool and return result as a string."""
    if _engine is None:
        return "Engine not initialized — no game data available yet."

    handlers = {
        "get_active_picks": _handle_active_picks,
        "get_game_status": _handle_game_status,
        "get_pick_detail": _handle_pick_detail,
        "get_daily_recap": _handle_daily_recap,
        "get_player_box_score": _handle_player_box_score,
    }

    handler = handlers.get(name)
    if not handler:
        return f"Unknown tool: {name}"

    try:
        return handler(inputs)
    except Exception as e:
        log.error("Tool %s error: %s", name, e)
        return f"Tool error: {e}"


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------


def _format_pick(ctx: PickContext, game: GameState) -> str:
    """Format a single pick as a compact text line."""
    pace = ctx.latest_pace
    pace_str = f", pace {pace:.0f}" if pace else ""
    market = ctx.market.lower()
    comfort = ctx.comfort_level

    if ctx.is_hit is not None:
        result = "HIT" if ctx.is_hit else "MISS"
        return (
            f"  {ctx.player_name}: {ctx.actual_value:.0f} {market} -> {result} "
            f"({ctx.prediction} {ctx.line}) [{ctx.tier}/{ctx.model_version}]"
        )

    # Box score extras
    extras = []
    bs = ctx.box_score
    if bs.minutes > 0:
        extras.append(f"{bs.minutes:.0f}min")
    if bs.fouls >= 3:
        extras.append(f"{bs.fouls}fouls")
    if bs.fg_attempted > 0:
        pct = bs.fg_made / bs.fg_attempted * 100
        extras.append(f"{bs.fg_made}/{bs.fg_attempted}FG({pct:.0f}%)")
    if ctx.season_avg is not None:
        extras.append(f"avg:{ctx.season_avg:.1f}")
    extra_str = f" | {', '.join(extras)}" if extras else ""

    return (
        f"  {ctx.player_name}: {ctx.actual_value:.0f} {market}{pace_str} "
        f"({ctx.prediction} {ctx.line}, {comfort}) "
        f"[{ctx.tier}/{ctx.model_version}, {ctx.book}]{extra_str}"
    )


def _format_game_header(game: GameState) -> str:
    """Format a game header line."""
    score = f"{game.away_team} {game.away_score} - {game.home_team} {game.home_score}"
    if game.status == "final":
        return f"{score} | FINAL"
    if game.status == "halftime":
        return f"{score} | Halftime"
    if game.status == "scheduled":
        return f"{game.away_team} @ {game.home_team} | Scheduled"
    ql = f"Q{game.quarter}" if game.quarter <= 4 else f"OT{game.quarter - 4}"
    clock = game.clock or ""
    flags = []
    if game.is_blowout:
        flags.append("BLOWOUT")
    if game.is_garbage_time:
        flags.append("GARBAGE TIME")
    flag_str = f" [{', '.join(flags)}]" if flags else ""
    return f"{score} | {ql} {clock}{flag_str}"


def _handle_active_picks(inputs: dict) -> str:
    """Get all active picks with pace, comfort, and box score context."""
    game_id_filter = inputs.get("game_id")
    lines = []

    games = _engine.games
    if not games:
        return "No games being tracked right now."

    for game in games.values():
        if game_id_filter and game.game_id != game_id_filter:
            continue
        if not game.picks:
            continue

        lines.append(_format_game_header(game))
        for ctx in game.picks.values():
            lines.append(_format_pick(ctx, game))
        lines.append("")

    return "\n".join(lines).strip() if lines else "No picks being tracked."


def _handle_game_status(inputs: dict) -> str:
    """Get current status of all tracked games."""
    games = _engine.games
    if not games:
        return "No games being tracked."

    lines = []
    for game in games.values():
        header = _format_game_header(game)
        pick_count = len(game.picks)
        resolved = sum(1 for c in game.picks.values() if c.is_hit is not None)
        elapsed = game.game_minutes_elapsed
        lines.append(
            f"{header} | {pick_count} picks ({resolved} resolved) | {elapsed:.0f} min elapsed"
        )

    return "\n".join(lines)


def _find_pick_by_name(player_name: str) -> tuple[PickContext, GameState] | None:
    """Find a pick by player name (case-insensitive, partial match)."""
    target = player_name.strip().lower()
    for game in _engine.games.values():
        for ctx in game.picks.values():
            name = ctx.player_name.strip().lower()
            if target == name or target in name or name.split()[-1] == target:
                return ctx, game
    return None


def _handle_pick_detail(inputs: dict) -> str:
    """Deep dive on a specific player's pick."""
    player_name = inputs.get("player_name", "")
    result = _find_pick_by_name(player_name)
    if not result:
        return f"No pick found for '{player_name}'."

    ctx, game = result
    pace = ctx.latest_pace
    market = ctx.market.lower()

    lines = [
        f"=== {ctx.player_name} — {ctx.prediction} {ctx.line} {market} ===",
        f"Game: {_format_game_header(game)}",
        f"Tier: {ctx.tier} | Model: {ctx.model_version} | Book: {ctx.book}",
        f"Team: {ctx.team} vs {ctx.opponent_team} ({'HOME' if ctx.is_home else 'AWAY'})",
        f"Current: {ctx.actual_value:.0f} {market}",
        f"Comfort: {ctx.comfort_level}",
    ]

    if pace is not None:
        lines.append(f"Pace projection: {pace:.0f}")

    if ctx.season_avg is not None:
        lines.append(f"Season average: {ctx.season_avg:.1f}")

    # Box score
    bs = ctx.box_score
    if bs.last_updated > 0:
        lines.append("")
        lines.append("Box Score:")
        lines.append(f"  Minutes: {bs.minutes:.1f}")
        lines.append(f"  Fouls: {bs.fouls}")
        if bs.fg_attempted > 0:
            pct = bs.fg_made / bs.fg_attempted * 100
            lines.append(f"  FG: {bs.fg_made}/{bs.fg_attempted} ({pct:.0f}%)")
        if bs.three_attempted > 0:
            pct3 = bs.three_made / bs.three_attempted * 100
            lines.append(f"  3PT: {bs.three_made}/{bs.three_attempted} ({pct3:.0f}%)")
        if bs.ft_attempted > 0:
            ft_pct = bs.ft_made / bs.ft_attempted * 100
            lines.append(f"  FT: {bs.ft_made}/{bs.ft_attempted} ({ft_pct:.0f}%)")
        lines.append(f"  +/-: {bs.plus_minus:+d}")
        lines.append(f"  Starter: {'Yes' if bs.starter else 'No'}")

    # Pace history (last 5 snapshots)
    if ctx.snapshots:
        lines.append("")
        lines.append("Pace History (recent):")
        for snap in ctx.snapshots[-5:]:
            ql = f"Q{snap.quarter}" if snap.quarter <= 4 else f"OT{snap.quarter - 4}"
            lines.append(
                f"  {ql} {snap.clock}: {snap.actual_value:.0f} {market}, "
                f"pace {snap.pace_projection:.0f}, "
                f"{snap.player_minutes:.0f}min on court"
            )

    if ctx.is_hit is not None:
        result_str = "HIT" if ctx.is_hit else "MISS"
        lines.append(f"\nFinal: {ctx.actual_value:.0f} -> {result_str}")

    return "\n".join(lines)


def _handle_daily_recap(inputs: dict) -> str:
    """Today's resolved picks with W/L results."""
    resolved = _engine.get_all_resolved_today()
    if not resolved:
        return "No resolved picks yet today."

    hits = sum(1 for p in resolved if p.is_hit)
    misses = len(resolved) - hits
    wr = (hits / len(resolved) * 100) if resolved else 0

    lines = [f"Daily Record: {hits}W - {misses}L ({wr:.0f}%)", ""]

    for p in sorted(resolved, key=lambda x: (not x.is_hit, x.player_name)):
        icon = "W" if p.is_hit else "L"
        market = p.market.lower()
        lines.append(
            f"  [{icon}] {p.player_name} {p.prediction} {p.line} {market} "
            f"-> {p.actual_value:.0f} [{p.tier}/{p.model_version}]"
        )

    return "\n".join(lines)


def _handle_player_box_score(inputs: dict) -> str:
    """Real-time box score for a tracked player."""
    player_name = inputs.get("player_name", "")
    result = _find_pick_by_name(player_name)
    if not result:
        return f"No tracked player found for '{player_name}'."

    ctx, game = result
    bs = ctx.box_score

    if bs.last_updated == 0:
        return f"No box score data available yet for {ctx.player_name}."

    lines = [
        f"=== {ctx.player_name} Box Score ===",
        f"Game: {_format_game_header(game)}",
        f"Minutes: {bs.minutes:.1f}",
        f"Fouls: {bs.fouls}",
    ]

    if bs.fg_attempted > 0:
        pct = bs.fg_made / bs.fg_attempted * 100
        lines.append(f"FG: {bs.fg_made}/{bs.fg_attempted} ({pct:.0f}%)")
    if bs.three_attempted > 0:
        pct3 = bs.three_made / bs.three_attempted * 100
        lines.append(f"3PT: {bs.three_made}/{bs.three_attempted} ({pct3:.0f}%)")
    if bs.ft_attempted > 0:
        ft_pct = bs.ft_made / bs.ft_attempted * 100
        lines.append(f"FT: {bs.ft_made}/{bs.ft_attempted} ({ft_pct:.0f}%)")

    lines.append(f"+/-: {bs.plus_minus:+d}")
    lines.append(f"Starter: {'Yes' if bs.starter else 'No'}")

    return "\n".join(lines)
