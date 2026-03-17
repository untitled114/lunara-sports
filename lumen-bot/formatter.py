"""Discord embed formatters for Cephalon Lumen — Game-Time Copilot.

Builds rich Discord embeds for every alert type: halftime reports,
blowout warnings, pace projections, quarter summaries, and results.
"""

from __future__ import annotations

import discord

from game_context import AlertType, GameState, PickContext

# Tier colors
TIER_COLORS = {
    "X": 0xFFD700,  # Gold
    "Z": 0x7C3AED,  # Purple
    "META": 0x22C55E,  # Green
    "star_tier": 0xF59E0B,  # Amber
    "A": 0x6B7280,  # Gray
}

# Alert type colors
ALERT_COLORS = {
    AlertType.HALFTIME_REPORT: 0x3B82F6,  # Blue
    AlertType.QUARTER_SUMMARY: 0x6366F1,  # Indigo
    AlertType.BLOWOUT_WARNING: 0xF97316,  # Orange
    AlertType.GARBAGE_TIME: 0xEF4444,  # Red
    AlertType.PACE_COMFORT: 0x22C55E,  # Green
    AlertType.PACE_CONCERN: 0xEAB308,  # Yellow
    AlertType.LINE_CLEARED_EARLY: 0x10B981,  # Emerald
    AlertType.FOUL_TROUBLE: 0xF97316,  # Orange
    AlertType.SCORING_RUN: 0xF59E0B,  # Amber
    AlertType.DROUGHT: 0x6366F1,  # Indigo
    AlertType.DAILY_RECAP: 0x8B5CF6,  # Violet
}

DEFAULT_COLOR = 0x3B82F6  # Blue


def _v(pick: dict, key: str, default: str = "?") -> str:
    """Get a pick value, treating None the same as missing."""
    val = pick.get(key)
    return val if val is not None else default


def _comfort_bar(comfort: str) -> str:
    """Visual comfort indicator."""
    bars = {
        "crushing": "\u2588\u2588\u2588\u2588\u2588",
        "comfortable": "\u2588\u2588\u2588\u2588\u2591",
        "on_track": "\u2588\u2588\u2588\u2591\u2591",
        "tight": "\u2588\u2588\u2591\u2591\u2591",
        "behind": "\u2588\u2591\u2591\u2591\u2591",
        "buried": "\u2591\u2591\u2591\u2591\u2591",
    }
    return bars.get(comfort, "\u2591\u2591\u2591\u2591\u2591")


def _comfort_emoji(comfort: str) -> str:
    return {
        "crushing": "\U0001f525",
        "comfortable": "\u2705",
        "on_track": "\U0001f7e2",
        "tight": "\u26a0\ufe0f",
        "behind": "\U0001f534",
        "buried": "\U0001f480",
    }.get(comfort, "\u2753")


def _quarter_label(q: int) -> str:
    if q <= 4:
        return {1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4"}.get(q, f"Q{q}")
    return f"OT{q - 4}" if q > 5 else "OT"


class PickFormatter:
    """Builds Discord embeds for all Lumen alert types."""

    # ── Legacy dict-based embeds (still used for basic pick_update alerts) ──

    def summary_embed(self, picks: list[dict]) -> discord.Embed:
        """Morning summary embed for new picks."""
        embed = discord.Embed(
            title="\U0001f3c0 Lumen — Today's Picks",
            color=0x22C55E,
            description=f"**{len(picks)}** picks loaded | Game-Time Copilot active",
        )

        by_tier: dict[str, list[dict]] = {}
        for pick in picks:
            tier = pick.get("tier", "?")
            by_tier.setdefault(tier, []).append(pick)

        for tier in ["X", "Z", "META", "star_tier", "A"]:
            tier_picks = by_tier.get(tier, [])
            if not tier_picks:
                continue

            lines = []
            for p in tier_picks:
                model = p.get("model_version", "?").upper()
                injury = ""
                if p.get("injury_status"):
                    injury = f" \u26a0 {p['injury_status']}"
                lines.append(
                    f"**{p.get('player_name', '?')}** "
                    f"{p.get('prediction', '?')} {p.get('line', '?')} {p.get('market', '?')} "
                    f"\u2014 {p.get('book', '?')} [{model}]{injury}"
                )

            icon = "\u2b50" if tier == "X" else "\u25c6"
            embed.add_field(
                name=f"{icon} {tier} Tier ({len(tier_picks)})",
                value="\n".join(lines[:10]),
                inline=False,
            )

        embed.set_footer(text="Cephalon Lumen \u2014 Game-Time Copilot")
        return embed

    def approaching_embed(self, pick: dict) -> discord.Embed:
        """Alert when a player's stat is approaching their line."""
        actual = pick.get("actual_value") or 0
        line = pick.get("line") or 0
        prediction = _v(pick, "prediction", "OVER")
        market = _v(pick, "market")
        tier = _v(pick, "tier")
        model = _v(pick, "model_version").upper()

        if prediction == "OVER":
            remaining = line - actual
            status = f"needs **{remaining:.1f}** more" if remaining > 0 else "**over the line**"
        else:
            remaining = actual - line
            status = f"**{remaining:.1f}** over the line" if remaining > 0 else "**under the line**"

        color = TIER_COLORS.get(tier, DEFAULT_COLOR)
        ctx_parts = [p for p in [tier, model] if p and p != "?"]
        ctx_line = " | ".join(ctx_parts)

        embed = discord.Embed(
            title=f"\U0001f525 {_v(pick, 'player_name')} \u2014 Approaching",
            description=(
                f"**{prediction} {line} {market}**\n"
                f"Currently at **{actual:.1f}** \u2014 {status}\n"
                f"{ctx_line}"
            ),
            color=color,
        )
        embed.set_footer(text="Cephalon Lumen \u2014 Game-Time Copilot")
        return embed

    def mid_game_hit_embed(self, pick: dict) -> discord.Embed:
        """Alert when a pick clears its line during a live game."""
        actual = pick.get("actual_value") or 0
        line = pick.get("line") or 0
        market = _v(pick, "market")
        prediction = _v(pick, "prediction")
        tier = _v(pick, "tier")
        model = _v(pick, "model_version").upper()
        book = _v(pick, "book", "")
        color = TIER_COLORS.get(tier, DEFAULT_COLOR)

        ctx_parts = [p for p in [tier, model, book] if p and p != "?"]
        ctx_line = " | ".join(ctx_parts)

        embed = discord.Embed(
            title=f"\U0001f3af {_v(pick, 'player_name')} \u2014 Line Cleared",
            description=(
                f"**{prediction} {line} {market}**\n"
                f"Currently at **{actual:.1f}** \u2014 line cleared mid-game\n"
                f"{ctx_line}"
            ),
            color=color,
        )
        embed.set_footer(text="Cephalon Lumen \u2014 Game-Time Copilot")
        return embed

    def result_embed(self, pick: dict) -> discord.Embed:
        """Hit/miss result embed."""
        is_hit = pick.get("is_hit", False)
        actual = pick.get("actual_value") or 0
        line = pick.get("line") or 0
        market = _v(pick, "market")
        tier = _v(pick, "tier")
        model = _v(pick, "model_version").upper()
        book = _v(pick, "book", "")
        prediction = _v(pick, "prediction")

        if is_hit:
            title = f"\u2705 HIT \u2014 {_v(pick, 'player_name')}"
            color = 0x22C55E
        else:
            title = f"\u274c MISS \u2014 {_v(pick, 'player_name')}"
            color = 0xEF4444

        ctx_parts = [p for p in [tier, model, book] if p and p != "?"]
        ctx_line = " | ".join(ctx_parts)

        embed = discord.Embed(
            title=title,
            description=(f"**{prediction} {line} {market}**\nFinal: **{actual:.1f}**\n{ctx_line}"),
            color=color,
        )

        rs = pick.get("rolling_stats")
        if rs and isinstance(rs, dict):
            stats_line = " | ".join(f"{k}: {v:.1f}" for k, v in rs.items() if v is not None)
            if stats_line:
                embed.add_field(name="Rolling Stats", value=stats_line, inline=False)

        embed.set_footer(text="Cephalon Lumen \u2014 Game-Time Copilot")
        return embed

    def daily_recap_embed(self, picks: list[dict]) -> discord.Embed:
        """End-of-day recap with W/L record."""
        resolved = [p for p in picks if p.get("is_hit") is not None]
        hits = sum(1 for p in resolved if p["is_hit"])
        misses = len(resolved) - hits
        wr = (hits / len(resolved) * 100) if resolved else 0

        color = 0x22C55E if wr >= 55 else 0xEF4444 if wr < 50 else 0xF59E0B

        embed = discord.Embed(
            title="\U0001f3c6 Lumen \u2014 Daily Recap",
            description=f"**{hits}W - {misses}L** ({wr:.0f}%)",
            color=color,
        )

        for pick in resolved:
            icon = "\u2705" if pick["is_hit"] else "\u274c"
            embed.add_field(
                name=f"{icon} {pick.get('player_name', '?')}",
                value=(
                    f"{pick.get('prediction', '?')} {pick.get('line', '?')} "
                    f"{pick.get('market', '?')} \u2192 **{pick.get('actual_value', 0):.1f}**"
                ),
                inline=True,
            )

        embed.set_footer(text="Cephalon Lumen \u2014 Game-Time Copilot")
        return embed

    # ── New Copilot embeds (context-aware, driven by intelligence engine) ──

    def copilot_embed(
        self,
        alert_type: AlertType,
        message: str,
        game: GameState | None = None,
        ctx: PickContext | None = None,
    ) -> discord.Embed:
        """Build a rich copilot embed from an intelligence engine message."""
        color = ALERT_COLORS.get(alert_type, DEFAULT_COLOR)

        title_map = {
            AlertType.HALFTIME_REPORT: "\U0001f4cb Halftime Report",
            AlertType.QUARTER_SUMMARY: "\U0001f4ca Quarter Update",
            AlertType.BLOWOUT_WARNING: "\U0001f6a8 Blowout Alert",
            AlertType.GARBAGE_TIME: "\U0001f6d1 Garbage Time",
            AlertType.PACE_COMFORT: "\U0001f525 Pace Check",
            AlertType.PACE_CONCERN: "\u26a0\ufe0f Pace Warning",
            AlertType.LINE_CLEARED_EARLY: "\U0001f3af Early Clear",
            AlertType.FOUL_TROUBLE: "\u26a0\ufe0f Foul Trouble",
            AlertType.SCORING_RUN: "\U0001f525 Hot Streak",
            AlertType.DROUGHT: "\U0001f9ca Cold Streak",
            AlertType.DAILY_RECAP: "\U0001f3c6 Daily Recap",
        }

        title = title_map.get(alert_type, "Lumen Update")

        # Add game context to title if available
        if game and alert_type != AlertType.DAILY_RECAP:
            title += f" | {game.away_team} @ {game.home_team}"

        embed = discord.Embed(title=title, description=message, color=color)

        # Add pick context footer for single-pick alerts
        if ctx:
            tier_label = ctx.tier or "?"
            model_label = ctx.model_version.upper() if ctx.model_version else "?"
            book_label = ctx.book or ""
            parts = [p for p in [tier_label, model_label, book_label] if p and p != "?"]
            embed.set_footer(text=f"{'  |  '.join(parts)}  \u2022  Cephalon Lumen")
        else:
            embed.set_footer(text="Cephalon Lumen \u2014 Game-Time Copilot")

        return embed

    def halftime_report_embed(self, game: GameState) -> discord.Embed:
        """Rich halftime report card with comfort bars for each pick."""
        score_line = f"{game.away_team} {game.away_score} - {game.home_team} {game.home_score}"

        embed = discord.Embed(
            title=f"\U0001f4cb Halftime Report | {game.away_team} @ {game.home_team}",
            description=f"**{score_line}**",
            color=0x3B82F6,
        )

        picks = sorted(
            [c for c in game.picks.values() if c.is_hit is None],
            key=lambda c: (
                [
                    "crushing",
                    "comfortable",
                    "on_track",
                    "tight",
                    "behind",
                    "buried",
                    "unknown",
                ].index(c.comfort_level)
                if c.comfort_level
                in ["crushing", "comfortable", "on_track", "tight", "behind", "buried", "unknown"]
                else 99
            ),
        )

        for ctx in picks[:10]:
            pace = ctx.latest_pace
            market = ctx.market.lower()
            emoji = _comfort_emoji(ctx.comfort_level)
            bar = _comfort_bar(ctx.comfort_level)

            # Build context line from box score
            bs_parts = []
            bs = ctx.box_score
            if bs.minutes > 0:
                bs_parts.append(f"{bs.minutes:.0f}min")
            if bs.fg_attempted > 0:
                pct = bs.fg_made / bs.fg_attempted * 100
                bs_parts.append(f"{pct:.0f}%FG")
            if bs.fouls >= 3:
                bs_parts.append(f"{bs.fouls}PF")
            bs_str = f" ({', '.join(bs_parts)})" if bs_parts else ""

            if pace is not None:
                value = (
                    f"{ctx.actual_value:.0f} at half \u2192 pace **{pace:.0f}**{bs_str}\n"
                    f"{bar} {ctx.comfort_level}\n"
                    f"{ctx.prediction} {ctx.line} | {ctx.tier}/{ctx.model_version.upper()}"
                )
            else:
                value = (
                    f"{ctx.actual_value:.0f} at half{bs_str}\n"
                    f"{ctx.prediction} {ctx.line} | {ctx.tier}/{ctx.model_version.upper()}"
                )

            embed.add_field(
                name=f"{emoji} {ctx.player_name} \u2014 {market}",
                value=value,
                inline=True,
            )

        # Blowout warning
        if game.abs_diff >= 15:
            embed.add_field(
                name="\u26a0\ufe0f Score Alert",
                value=f"{game.leading_team} up **{game.abs_diff}** \u2014 watch for reduced 2H minutes",
                inline=False,
            )

        embed.set_footer(text="Cephalon Lumen \u2014 Game-Time Copilot")
        return embed

    def daily_copilot_recap(self, picks: list[PickContext]) -> discord.Embed:
        """Rich daily recap from PickContext objects (not raw dicts)."""
        resolved = [p for p in picks if p.is_hit is not None]
        if not resolved:
            return discord.Embed(
                title="\U0001f3c6 Lumen \u2014 Daily Recap",
                description="No resolved picks today.",
                color=0x6B7280,
            )

        hits = sum(1 for p in resolved if p.is_hit)
        misses = len(resolved) - hits
        wr = (hits / len(resolved) * 100) if resolved else 0

        if wr >= 65:
            color = 0x22C55E
            verdict = "\U0001f525 Dominant day."
        elif wr >= 55:
            color = 0x22C55E
            verdict = "\u2705 Solid day."
        elif wr >= 50:
            color = 0xF59E0B
            verdict = "\U0001f7e1 Break-even."
        else:
            color = 0xEF4444
            verdict = "\U0001f534 Rough day."

        embed = discord.Embed(
            title="\U0001f3c6 Lumen \u2014 Daily Recap",
            description=f"**{hits}W - {misses}L** ({wr:.0f}%) \u2014 {verdict}",
            color=color,
        )

        for p in sorted(resolved, key=lambda x: (not x.is_hit, x.player_name)):
            icon = "\u2705" if p.is_hit else "\u274c"
            market = p.market.lower()
            embed.add_field(
                name=f"{icon} {p.player_name}",
                value=(
                    f"{p.prediction} {p.line} {market} \u2192 **{p.actual_value:.0f}**\n"
                    f"{p.tier}/{p.model_version.upper()} | {p.book}"
                ),
                inline=True,
            )

        embed.set_footer(text="Cephalon Lumen \u2014 Game-Time Copilot")
        return embed
