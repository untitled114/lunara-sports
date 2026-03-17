"""Intelligence Engine — generates natural language game-time commentary.

Transforms raw game context + pick state into human-readable insights
that feel like having a sharp sports analyst whispering in your ear.

Design principle: every message should be *actionable* or *informative*.
No filler. No spam. Tony Stark would approve.
"""

from __future__ import annotations

import logging

from game_context import (
    AlertType,
    GameState,
    PickContext,
)

log = logging.getLogger("lumen.intel")

# Quarter display names
QUARTER_NAMES = {1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4"}


def _quarter_label(q: int) -> str:
    if q <= 4:
        return QUARTER_NAMES.get(q, f"Q{q}")
    return f"OT{q - 4}" if q > 5 else "OT"


def _ordinal(n: int) -> str:
    if 11 <= (n % 100) <= 13:
        return f"{n}th"
    return f"{n}{['th', 'st', 'nd', 'rd', 'th'][min(n % 10, 4)]}"


def _comfort_emoji(comfort: str) -> str:
    return {
        "crushing": "\U0001f525",  # fire
        "comfortable": "\u2705",  # check
        "on_track": "\U0001f7e2",  # green circle
        "tight": "\u26a0\ufe0f",  # warning
        "behind": "\U0001f534",  # red circle
        "buried": "\U0001f480",  # skull
        "hit": "\u2705",
        "miss": "\u274c",
        "unknown": "\u2753",
    }.get(comfort, "\u2753")


def _score_line(game: GameState) -> str:
    """Compact score display: 'DEN 85 - LAL 67 | Q3 4:30'"""
    if game.status == "halftime":
        return f"{game.away_team} {game.away_score} - {game.home_team} {game.home_score} | Halftime"
    if game.status == "final":
        return f"{game.away_team} {game.away_score} - {game.home_team} {game.home_score} | Final"
    ql = _quarter_label(game.quarter) if game.quarter else ""
    clock = game.clock or ""
    return f"{game.away_team} {game.away_score} - {game.home_team} {game.home_score} | {ql} {clock}"


def _pick_line(ctx: PickContext, game: GameState) -> str:
    """One-line pick status: 'Jokic: 18 pts (pace 36.0) — OVER 26.5 comfortable'"""
    pace = ctx.latest_pace
    pace_str = f" (pace {pace:.0f})" if pace else ""
    market_short = ctx.market.lower()
    emoji = _comfort_emoji(ctx.comfort_level)
    return (
        f"{emoji} **{ctx.player_name}**: {ctx.actual_value:.0f} {market_short}"
        f"{pace_str} — {ctx.prediction} {ctx.line} *{ctx.comfort_level}*"
    )


def generate_halftime_report(game: GameState) -> str:
    """Generate a halftime report card for all active picks in a game.

    This is the signature Lumen moment — a clean halftime brief that
    tells you exactly where every pick stands.
    """
    lines = [
        f"**HALFTIME REPORT** | {_score_line(game)}",
        "",
    ]

    picks = [ctx for ctx in game.picks.values() if ctx.is_hit is None]
    if not picks:
        return ""

    # Sort by comfort level (best first)
    comfort_order = ["crushing", "comfortable", "on_track", "tight", "behind", "buried", "unknown"]
    picks.sort(
        key=lambda p: comfort_order.index(p.comfort_level)
        if p.comfort_level in comfort_order
        else 99
    )

    for ctx in picks:
        pace = ctx.latest_pace
        line = ctx.line
        prediction = ctx.prediction
        actual = ctx.actual_value
        market = ctx.market.lower()
        emoji = _comfort_emoji(ctx.comfort_level)

        # Build the narrative line
        if pace is not None:
            if prediction == "OVER":
                diff = pace - line
                if diff > 5:
                    narrative = f"on pace for **{pace:.0f}** — cruising"
                elif diff > 0:
                    narrative = f"on pace for **{pace:.0f}** — on track"
                elif diff > -3:
                    narrative = f"on pace for **{pace:.0f}** — tight"
                else:
                    narrative = f"on pace for only **{pace:.0f}** — needs a big second half"
            else:
                diff = line - pace
                if diff > 5:
                    narrative = f"on pace for **{pace:.0f}** — well under"
                elif diff > 0:
                    narrative = f"on pace for **{pace:.0f}** — looking safe"
                else:
                    narrative = f"on pace for **{pace:.0f}** — trending over the line"
        else:
            narrative = f"at **{actual:.0f}** — limited data"

        # Add box score context if available
        context_parts = []
        bs = ctx.box_score
        if bs.minutes > 0:
            context_parts.append(f"{bs.minutes:.0f} min")
        if bs.fg_attempted > 0:
            pct = bs.fg_made / bs.fg_attempted * 100
            context_parts.append(f"{bs.fg_made}/{bs.fg_attempted} FG ({pct:.0f}%)")
        if bs.fouls >= 3:
            context_parts.append(f"**{bs.fouls} fouls**")
        if ctx.season_avg is not None:
            context_parts.append(f"avg {ctx.season_avg:.1f}")
        context_str = f"   {' | '.join(context_parts)}" if context_parts else ""

        lines.append(f"{emoji} **{ctx.player_name}** {prediction} {line} {market}")
        lines.append(f"   {actual:.0f} at the half, {narrative}")
        if context_str:
            lines.append(context_str)

    # Blowout context
    if game.abs_diff >= 15:
        leader = game.leading_team
        lines.append("")
        lines.append(
            f"\u26a0\ufe0f **{leader} up {game.abs_diff}** — watch for reduced minutes in the 2nd half"
        )

    return "\n".join(lines)


def generate_quarter_summary(game: GameState, quarter: int) -> str:
    """Brief summary at the end of a quarter."""
    picks = [ctx for ctx in game.picks.values() if ctx.is_hit is None]
    if not picks:
        return ""

    ql = _quarter_label(quarter)
    lines = [f"**End of {ql}** | {_score_line(game)}", ""]

    for ctx in picks:
        lines.append(_pick_line(ctx, game))

    return "\n".join(lines)


def generate_blowout_warning(game: GameState, ctx: PickContext) -> str:
    """Warn that a pick is at risk because the player's team is blowing out.

    The specific risk: starters get pulled in blowouts, so an OVER pick
    might not have enough minutes to clear the line even if on pace.
    """
    diff = game.abs_diff
    leader = game.leading_team
    ql = _quarter_label(game.quarter)
    clock = game.clock or ""

    pace = ctx.latest_pace
    pace_str = f", on pace for {pace:.0f}" if pace else ""

    market = ctx.market.lower()

    if ctx.prediction == "OVER":
        risk = (
            f"**{ctx.player_name}** has {ctx.actual_value:.0f} {market}{pace_str}, "
            f"but **{leader}** is up **{diff}** in {ql} ({clock} left). "
            f"Risk: starters may sit — your **OVER {ctx.line}** could stall."
        )
    else:
        risk = (
            f"**{ctx.player_name}** has {ctx.actual_value:.0f} {market}{pace_str}. "
            f"**{leader}** is up **{diff}** in {ql} ({clock} left). "
            f"Starters may sit — good news for your **UNDER {ctx.line}**."
        )

    return f"\U0001f6a8 **BLOWOUT ALERT** | {_score_line(game)}\n\n{risk}"


def generate_garbage_time(game: GameState, ctx: PickContext) -> str:
    """Alert that we're in garbage time — starters likely done."""
    diff = game.abs_diff
    market = ctx.market.lower()

    return (
        f"\U0001f6d1 **GARBAGE TIME** | {_score_line(game)}\n\n"
        f"**{ctx.player_name}** at {ctx.actual_value:.0f} {market} "
        f"({ctx.prediction} {ctx.line}). "
        f"Lead is **{diff}** — starters are likely done for the night."
    )


def generate_pace_comfort(game: GameState, ctx: PickContext) -> str:
    """Player is comfortably on pace to hit their pick."""
    pace = ctx.latest_pace or 0
    market = ctx.market.lower()
    ql = _quarter_label(game.quarter) if game.quarter else ""
    clock = game.clock or ""

    # Build context string from box score
    extra = []
    bs = ctx.box_score
    if bs.minutes > 0:
        extra.append(f"{bs.minutes:.0f} min played")
    if bs.fg_attempted > 0:
        pct = bs.fg_made / bs.fg_attempted * 100
        extra.append(f"{bs.fg_made}/{bs.fg_attempted} FG ({pct:.0f}%)")
    if ctx.season_avg is not None:
        extra.append(f"season avg {ctx.season_avg:.1f}")
    extra_str = f" [{', '.join(extra)}]" if extra else ""

    if ctx.prediction == "OVER":
        cushion = pace - ctx.line
        return (
            f"\U0001f525 **{ctx.player_name}** has **{ctx.actual_value:.0f}** {market} "
            f"in {ql} ({clock}) — on pace for **{pace:.0f}**. "
            f"Your **OVER {ctx.line}** is looking comfortable (+{cushion:.0f} cushion).{extra_str}"
        )
    else:
        cushion = ctx.line - pace
        return (
            f"\u2705 **{ctx.player_name}** has **{ctx.actual_value:.0f}** {market} "
            f"in {ql} ({clock}) — on pace for **{pace:.0f}**. "
            f"Your **UNDER {ctx.line}** is sitting pretty ({cushion:.0f} under pace).{extra_str}"
        )


def generate_pace_concern(game: GameState, ctx: PickContext) -> str:
    """Player is behind pace — the pick is in trouble."""
    pace = ctx.latest_pace or 0
    market = ctx.market.lower()
    ql = _quarter_label(game.quarter) if game.quarter else ""
    clock = game.clock or ""

    if ctx.prediction == "OVER":
        deficit = ctx.line - pace
        remaining = ctx.line - ctx.actual_value
        return (
            f"\U0001f534 **{ctx.player_name}** has only **{ctx.actual_value:.0f}** {market} "
            f"through {ql} ({clock}) — on pace for just **{pace:.0f}**. "
            f"Needs **{remaining:.0f} more** for your OVER {ctx.line}. "
            f"Pace deficit: {deficit:.0f}."
        )
    else:
        surplus = pace - ctx.line
        return (
            f"\U0001f534 **{ctx.player_name}** already has **{ctx.actual_value:.0f}** {market} "
            f"in {ql} ({clock}) — on pace for **{pace:.0f}**. "
            f"Your UNDER {ctx.line} is in trouble (+{surplus:.0f} over pace)."
        )


def generate_line_cleared_early(game: GameState, ctx: PickContext) -> str:
    """Player cleared the line with significant game time remaining."""
    market = ctx.market.lower()
    ql = _quarter_label(game.quarter) if game.quarter else ""
    clock = game.clock or ""
    remaining_mins = 48 - game.game_minutes_elapsed

    if ctx.prediction == "OVER":
        surplus = ctx.actual_value - ctx.line
        return (
            f"\U0001f3af **EARLY CLEAR** — **{ctx.player_name}** just passed **{ctx.line}** {market} "
            f"in {ql} ({clock}) with ~{remaining_mins:.0f} min left! "
            f"At **{ctx.actual_value:.0f}** (+{surplus:.0f} over the line). Lock it in."
        )
    else:
        return (
            f"\U0001f3af **UNDER LOOKING SAFE** — **{ctx.player_name}** at "
            f"**{ctx.actual_value:.0f}** {market} "
            f"in {ql} ({clock}) with ~{remaining_mins:.0f} min left and game winding down."
        )


def generate_foul_trouble(game: GameState, ctx: PickContext) -> str:
    """Alert that a player is in foul trouble — minutes risk."""
    fouls = ctx.box_score.fouls
    ql = _quarter_label(game.quarter) if game.quarter else ""
    clock = game.clock or ""
    market = ctx.market.lower()
    mins = ctx.box_score.minutes

    mins_str = f" ({mins:.0f} min played)" if mins > 0 else ""

    if ctx.prediction == "OVER":
        risk = (
            f"**{ctx.player_name}** has **{fouls} fouls** in {ql} ({clock}){mins_str}. "
            f"Currently at **{ctx.actual_value:.0f}** {market} (line: {ctx.line}). "
            f"Risk: bench time or fouling out could kill your **OVER**."
        )
    else:
        risk = (
            f"**{ctx.player_name}** has **{fouls} fouls** in {ql} ({clock}){mins_str}. "
            f"Currently at **{ctx.actual_value:.0f}** {market} (line: {ctx.line}). "
            f"Reduced minutes could help your **UNDER**."
        )

    return f"\u26a0\ufe0f **FOUL TROUBLE** | {_score_line(game)}\n\n{risk}"


def generate_scoring_run(game: GameState, ctx: PickContext) -> str:
    """Player is on a hot streak."""
    market = ctx.market.lower()
    ql = _quarter_label(game.quarter) if game.quarter else ""
    clock = game.clock or ""
    pace = ctx.latest_pace

    pace_str = f" — on pace for **{pace:.0f}**" if pace else ""
    shooting = ""
    bs = ctx.box_score
    if bs.fg_attempted > 0:
        pct = bs.fg_made / bs.fg_attempted * 100
        shooting = f" Shooting **{bs.fg_made}/{bs.fg_attempted}** ({pct:.0f}%) from the field."

    return (
        f"\U0001f525 **{ctx.player_name} IS HEATING UP** | {_score_line(game)}\n\n"
        f"**{ctx.actual_value:.0f}** {market} in {ql} ({clock}){pace_str}. "
        f"Multiple scoring plays in the last few possessions.{shooting}"
    )


def generate_drought(game: GameState, ctx: PickContext) -> str:
    """Player has gone cold — stat hasn't moved."""
    market = ctx.market.lower()
    ql = _quarter_label(game.quarter) if game.quarter else ""
    clock = game.clock or ""
    pace = ctx.latest_pace

    pace_str = f" On pace for only **{pace:.0f}**." if pace else ""

    if ctx.prediction == "OVER":
        return (
            f"\U0001f9ca **DROUGHT** | {_score_line(game)}\n\n"
            f"**{ctx.player_name}** stuck at **{ctx.actual_value:.0f}** {market} "
            f"through {ql} ({clock}). Stat hasn't moved.{pace_str} "
            f"Your **OVER {ctx.line}** needs a spark."
        )
    else:
        return (
            f"\U0001f9ca **DROUGHT** | {_score_line(game)}\n\n"
            f"**{ctx.player_name}** stuck at **{ctx.actual_value:.0f}** {market} "
            f"through {ql} ({clock}).{pace_str} "
            f"Good news for your **UNDER {ctx.line}**."
        )


def generate_daily_recap(picks: list[PickContext]) -> str:
    """End-of-day performance summary."""
    resolved = [p for p in picks if p.is_hit is not None]
    if not resolved:
        return ""

    hits = sum(1 for p in resolved if p.is_hit)
    misses = len(resolved) - hits
    wr = (hits / len(resolved) * 100) if resolved else 0

    lines = [
        f"**DAILY RECAP** | **{hits}W - {misses}L** ({wr:.0f}%)",
        "",
    ]

    # Sort: hits first, then misses
    for p in sorted(resolved, key=lambda x: (not x.is_hit, x.player_name)):
        icon = "\u2705" if p.is_hit else "\u274c"
        market = p.market.lower()
        lines.append(
            f"{icon} **{p.player_name}** {p.prediction} {p.line} {market} "
            f"→ **{p.actual_value:.0f}** [{p.tier}/{p.model_version.upper()}]"
        )

    return "\n".join(lines)


def generate_alert_message(
    alert_type: AlertType,
    game: GameState,
    ctx: PickContext | None = None,
) -> str | None:
    """Route an alert to the appropriate generator. Returns message text or None."""
    try:
        if alert_type == AlertType.HALFTIME_REPORT:
            return generate_halftime_report(game)
        if alert_type == AlertType.QUARTER_SUMMARY and game.prev_quarter > 0:
            return generate_quarter_summary(game, game.prev_quarter)
        if alert_type == AlertType.BLOWOUT_WARNING and ctx:
            return generate_blowout_warning(game, ctx)
        if alert_type == AlertType.GARBAGE_TIME and ctx:
            return generate_garbage_time(game, ctx)
        if alert_type == AlertType.PACE_COMFORT and ctx:
            return generate_pace_comfort(game, ctx)
        if alert_type == AlertType.PACE_CONCERN and ctx:
            return generate_pace_concern(game, ctx)
        if alert_type == AlertType.LINE_CLEARED_EARLY and ctx:
            return generate_line_cleared_early(game, ctx)
        if alert_type == AlertType.FOUL_TROUBLE and ctx:
            return generate_foul_trouble(game, ctx)
        if alert_type == AlertType.SCORING_RUN and ctx:
            return generate_scoring_run(game, ctx)
        if alert_type == AlertType.DROUGHT and ctx:
            return generate_drought(game, ctx)
    except Exception:
        log.exception("Failed to generate alert message for %s", alert_type)
    return None
