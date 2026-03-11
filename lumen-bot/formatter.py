"""Discord embed formatters for Cephalon Lumen pick alerts."""

from __future__ import annotations

import discord

# Tier colors
TIER_COLORS = {
    "X": 0xFFD700,  # Gold
    "Z": 0x7C3AED,  # Purple
    "META": 0x22C55E,  # Green
    "star_tier": 0xF59E0B,  # Amber
    "A": 0x6B7280,  # Gray
}

DEFAULT_COLOR = 0x3B82F6  # Blue


class PickFormatter:
    """Builds Discord embeds for pick alerts."""

    def summary_embed(self, picks: list[dict]) -> discord.Embed:
        """Morning summary embed for new picks."""
        embed = discord.Embed(
            title="Lunara — Today's Picks",
            color=0x22C55E,
            description=f"**{len(picks)}** picks loaded",
        )

        # Group by tier
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
                    injury = f" ⚠ {p['injury_status']}"
                lines.append(
                    f"**{p.get('player_name', '?')}** "
                    f"{p.get('prediction', '?')} {p.get('line', '?')} {p.get('market', '?')} "
                    f"— {p.get('book', '?')} [{model}]{injury}"
                )

            embed.add_field(
                name=f"{'⭐' if tier == 'X' else '◆'} {tier} Tier ({len(tier_picks)})",
                value="\n".join(lines[:10]),
                inline=False,
            )

        embed.set_footer(text="Cephalon Lumen — Lunara Sports")
        return embed

    def approaching_embed(self, pick: dict) -> discord.Embed:
        """Alert when a player's stat is approaching their line."""
        actual = pick.get("actual_value", 0)
        line = pick.get("line", 0)
        prediction = pick.get("prediction", "OVER")
        market = pick.get("market", "?")
        tier = pick.get("tier", "?")

        if prediction == "OVER":
            remaining = line - actual
            status = f"needs **{remaining:.1f}** more" if remaining > 0 else "**over the line**"
        else:
            remaining = actual - line
            status = f"**{remaining:.1f}** over the line" if remaining > 0 else "**under the line**"

        color = TIER_COLORS.get(tier, DEFAULT_COLOR)

        embed = discord.Embed(
            title=f"🔥 {pick.get('player_name', '?')} — Approaching",
            description=(
                f"**{prediction} {line} {market}**\n"
                f"Currently at **{actual:.1f}** — {status}\n"
                f"Tier: **{tier}** | {pick.get('model_version', '?').upper()}"
            ),
            color=color,
        )
        embed.set_footer(text="Cephalon Lumen — Lunara Sports")
        return embed

    def result_embed(self, pick: dict) -> discord.Embed:
        """Hit/miss result embed."""
        is_hit = pick.get("is_hit", False)
        actual = pick.get("actual_value", 0)
        line = pick.get("line", 0)
        market = pick.get("market", "?")
        tier = pick.get("tier", "?")
        model = pick.get("model_version", "?").upper()

        if is_hit:
            title = f"✅ HIT — {pick.get('player_name', '?')}"
            color = 0x22C55E
        else:
            title = f"❌ MISS — {pick.get('player_name', '?')}"
            color = 0xEF4444

        embed = discord.Embed(
            title=title,
            description=(
                f"**{pick.get('prediction', '?')} {line} {market}**\n"
                f"Final: **{actual:.1f}**\n"
                f"Tier: **{tier}** | {model} | {pick.get('book', '?')}"
            ),
            color=color,
        )

        # Rolling stats if available
        rs = pick.get("rolling_stats")
        if rs and isinstance(rs, dict):
            stats_line = " | ".join(f"{k}: {v:.1f}" for k, v in rs.items() if v is not None)
            if stats_line:
                embed.add_field(name="Rolling Stats", value=stats_line, inline=False)

        embed.set_footer(text="Cephalon Lumen — Lunara Sports")
        return embed

    def daily_recap_embed(self, picks: list[dict]) -> discord.Embed:
        """End-of-day recap with W/L record."""
        resolved = [p for p in picks if p.get("is_hit") is not None]
        hits = sum(1 for p in resolved if p["is_hit"])
        misses = len(resolved) - hits
        wr = (hits / len(resolved) * 100) if resolved else 0

        color = 0x22C55E if wr >= 55 else 0xEF4444 if wr < 50 else 0xF59E0B

        embed = discord.Embed(
            title="Lunara — Daily Recap",
            description=f"**{hits}W - {misses}L** ({wr:.0f}%)",
            color=color,
        )

        for pick in resolved:
            icon = "✅" if pick["is_hit"] else "❌"
            embed.add_field(
                name=f"{icon} {pick.get('player_name', '?')}",
                value=(
                    f"{pick.get('prediction', '?')} {pick.get('line', '?')} "
                    f"{pick.get('market', '?')} → **{pick.get('actual_value', 0):.1f}**"
                ),
                inline=True,
            )

        embed.set_footer(text="Cephalon Lumen — Lunara Sports")
        return embed
