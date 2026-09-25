"""Characterization tests for formatter.py — Discord embed builders."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from formatter import (  # noqa: E402
    PickFormatter,
    _comfort_bar,
    _comfort_emoji,
    _quarter_label,
    _v,
)
from game_context import AlertType, GameState, PickContext, PlayerSnapshot  # noqa: E402


def _mk_pick(**overrides) -> PickContext:
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


def _mk_game(**overrides) -> GameState:
    defaults = dict(game_id="401", home_team="BOS", away_team="NYK")
    defaults.update(overrides)
    return GameState(**defaults)


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------


class TestV:
    def test_present_key(self):
        assert _v({"player_name": "Tatum"}, "player_name") == "Tatum"

    def test_missing_key(self):
        assert _v({}, "player_name") == "?"

    def test_none_value(self):
        assert _v({"player_name": None}, "player_name") == "?"

    def test_custom_default(self):
        assert _v({}, "book", "") == ""


class TestComfortBar:
    @pytest.mark.parametrize(
        "level",
        ["crushing", "comfortable", "on_track", "tight", "behind", "buried"],
    )
    def test_known_levels(self, level):
        bar = _comfort_bar(level)
        assert len(bar) == 5

    def test_unknown_level(self):
        assert _comfort_bar("unknown") == "░░░░░"


class TestComfortEmoji:
    @pytest.mark.parametrize(
        "level",
        ["crushing", "comfortable", "on_track", "tight", "behind", "buried"],
    )
    def test_known_levels(self, level):
        assert _comfort_emoji(level) != "❓"

    def test_unknown_level(self):
        assert _comfort_emoji("nonsense") == "❓"


class TestQuarterLabel:
    @pytest.mark.parametrize(("q", "expected"), [(1, "Q1"), (2, "Q2"), (3, "Q3"), (4, "Q4")])
    def test_regulation(self, q, expected):
        assert _quarter_label(q) == expected

    def test_first_ot(self):
        assert _quarter_label(5) == "OT"

    def test_second_ot(self):
        assert _quarter_label(6) == "OT2"


# ---------------------------------------------------------------------------
# PickFormatter — legacy dict-based embeds
# ---------------------------------------------------------------------------


class TestSummaryEmbed:
    def test_zero_picks(self):
        embed = PickFormatter().summary_embed([])
        assert embed.title == "\U0001f3c0 Lumen — Today's Picks"
        assert int(embed.color) == 0x22C55E
        assert embed.fields == []

    def test_every_tier(self):
        picks = [
            {
                "tier": "X",
                "player_name": "Tatum",
                "prediction": "OVER",
                "line": 26.5,
                "market": "POINTS",
                "book": "DK",
                "model_version": "v3",
                "injury_status": "Questionable",
            },
            {
                "tier": "Z",
                "player_name": "Brown",
                "prediction": "UNDER",
                "line": 4.5,
                "market": "ASSISTS",
                "book": "FD",
                "model_version": "v3",
            },
            {
                "tier": "META",
                "player_name": "Porzingis",
                "prediction": "OVER",
                "line": 8.5,
                "market": "REBOUNDS",
                "book": "MGM",
                "model_version": "v2",
            },
            {
                "tier": "star_tier",
                "player_name": "Holiday",
                "prediction": "OVER",
                "line": 12.5,
                "market": "POINTS",
                "book": "DK",
                "model_version": "v2",
            },
            {
                "tier": "A",
                "player_name": "White",
                "prediction": "UNDER",
                "line": 3.5,
                "market": "STEALS",
                "book": "FD",
                "model_version": "v1",
            },
        ]
        embed = PickFormatter().summary_embed(picks)
        assert "5" in embed.description
        names = [f.name for f in embed.fields]
        assert any("X Tier" in n for n in names)
        assert any("Z Tier" in n for n in names)
        assert any("META Tier" in n for n in names)
        assert any("star_tier Tier" in n for n in names)
        assert any("A Tier" in n for n in names)
        x_field = next(f for f in embed.fields if "X Tier" in f.name)
        assert "⚠ Questionable" in x_field.value


class TestApproachingEmbed:
    def test_over_needs_more(self):
        pick = {
            "player_name": "Tatum",
            "actual_value": 24.0,
            "line": 26.5,
            "prediction": "OVER",
            "market": "POINTS",
            "tier": "X",
            "model_version": "v3",
        }
        embed = PickFormatter().approaching_embed(pick)
        assert "needs" in embed.description
        assert int(embed.color) == 0xFFD700

    def test_over_already_past_line(self):
        pick = {
            "player_name": "Tatum",
            "actual_value": 28.0,
            "line": 26.5,
            "prediction": "OVER",
            "market": "POINTS",
        }
        embed = PickFormatter().approaching_embed(pick)
        assert "over the line" in embed.description
        assert int(embed.color) == 0x3B82F6  # default color, tier missing

    def test_under_needs_more_room(self):
        pick = {
            "player_name": "Brown",
            "actual_value": 3.0,
            "line": 4.5,
            "prediction": "UNDER",
            "market": "ASSISTS",
        }
        embed = PickFormatter().approaching_embed(pick)
        assert "under the line" in embed.description

    def test_under_already_over_line(self):
        pick = {
            "player_name": "Brown",
            "actual_value": 6.0,
            "line": 4.5,
            "prediction": "UNDER",
            "market": "ASSISTS",
        }
        embed = PickFormatter().approaching_embed(pick)
        assert "over the line" in embed.description


class TestMidGameHitEmbed:
    def test_full_context(self):
        pick = {
            "player_name": "Tatum",
            "actual_value": 27.0,
            "line": 26.5,
            "market": "POINTS",
            "prediction": "OVER",
            "tier": "X",
            "model_version": "v3",
            "book": "DraftKings",
        }
        embed = PickFormatter().mid_game_hit_embed(pick)
        assert "Line Cleared" in embed.title
        assert "X | V3 | DraftKings" in embed.description

    def test_missing_context_fields(self):
        pick = {
            "player_name": "Tatum",
            "actual_value": 27.0,
            "line": 26.5,
            "market": "POINTS",
            "prediction": "OVER",
        }
        embed = PickFormatter().mid_game_hit_embed(pick)
        assert int(embed.color) == 0x3B82F6


class TestResultEmbed:
    def test_hit(self):
        pick = {
            "is_hit": True,
            "actual_value": 30.0,
            "line": 26.5,
            "market": "POINTS",
            "tier": "X",
            "model_version": "v3",
            "book": "DK",
            "prediction": "OVER",
            "player_name": "Tatum",
        }
        embed = PickFormatter().result_embed(pick)
        assert embed.title.startswith("✅ HIT")
        assert int(embed.color) == 0x22C55E

    def test_miss(self):
        pick = {
            "is_hit": False,
            "actual_value": 20.0,
            "line": 26.5,
            "market": "POINTS",
            "prediction": "OVER",
            "player_name": "Tatum",
        }
        embed = PickFormatter().result_embed(pick)
        assert embed.title.startswith("❌ MISS")
        assert int(embed.color) == 0xEF4444

    def test_rolling_stats_with_values(self):
        pick = {
            "is_hit": True,
            "actual_value": 30.0,
            "line": 26.5,
            "market": "POINTS",
            "prediction": "OVER",
            "player_name": "Tatum",
            "rolling_stats": {"L5": 28.4, "L10": None},
        }
        embed = PickFormatter().result_embed(pick)
        assert any("Rolling Stats" in f.name for f in embed.fields)
        stats_field = next(f for f in embed.fields if f.name == "Rolling Stats")
        assert "L5: 28.4" in stats_field.value
        assert "L10" not in stats_field.value

    def test_rolling_stats_all_none(self):
        pick = {
            "is_hit": True,
            "actual_value": 30.0,
            "line": 26.5,
            "market": "POINTS",
            "prediction": "OVER",
            "player_name": "Tatum",
            "rolling_stats": {"L5": None},
        }
        embed = PickFormatter().result_embed(pick)
        assert embed.fields == []

    def test_no_rolling_stats(self):
        pick = {
            "is_hit": True,
            "actual_value": 30.0,
            "line": 26.5,
            "market": "POINTS",
            "prediction": "OVER",
            "player_name": "Tatum",
        }
        embed = PickFormatter().result_embed(pick)
        assert embed.fields == []

    def test_rolling_stats_wrong_type(self):
        pick = {
            "is_hit": True,
            "actual_value": 30.0,
            "line": 26.5,
            "market": "POINTS",
            "prediction": "OVER",
            "player_name": "Tatum",
            "rolling_stats": ["not", "a", "dict"],
        }
        embed = PickFormatter().result_embed(pick)
        assert embed.fields == []


class TestDailyRecapEmbed:
    def test_zero_picks(self):
        embed = PickFormatter().daily_recap_embed([])
        assert "0W - 0L" in embed.description
        assert int(embed.color) == 0xEF4444  # wr=0 -> red

    def test_mixed_results_green(self):
        picks = [
            {
                "is_hit": True,
                "player_name": "A",
                "prediction": "OVER",
                "line": 1,
                "market": "PTS",
                "actual_value": 2,
            },
            {
                "is_hit": True,
                "player_name": "B",
                "prediction": "OVER",
                "line": 1,
                "market": "PTS",
                "actual_value": 2,
            },
            {
                "is_hit": True,
                "player_name": "C",
                "prediction": "OVER",
                "line": 1,
                "market": "PTS",
                "actual_value": 2,
            },
            {
                "is_hit": False,
                "player_name": "D",
                "prediction": "OVER",
                "line": 1,
                "market": "PTS",
                "actual_value": 0,
            },
        ]
        embed = PickFormatter().daily_recap_embed(picks)
        assert "3W - 1L" in embed.description
        assert int(embed.color) == 0x22C55E
        icons = [f.name[0] for f in embed.fields]
        assert icons.count("✅") == 3
        assert icons.count("❌") == 1

    def test_mixed_results_amber(self):
        picks = [
            {
                "is_hit": True,
                "player_name": "A",
                "prediction": "OVER",
                "line": 1,
                "market": "PTS",
                "actual_value": 2,
            },
            {
                "is_hit": False,
                "player_name": "B",
                "prediction": "OVER",
                "line": 1,
                "market": "PTS",
                "actual_value": 0,
            },
        ]
        embed = PickFormatter().daily_recap_embed(picks)
        assert "1W - 1L" in embed.description
        assert int(embed.color) == 0xF59E0B

    def test_mixed_results_red(self):
        picks = [
            {
                "is_hit": True,
                "player_name": "A",
                "prediction": "OVER",
                "line": 1,
                "market": "PTS",
                "actual_value": 2,
            },
            {
                "is_hit": False,
                "player_name": "B",
                "prediction": "OVER",
                "line": 1,
                "market": "PTS",
                "actual_value": 0,
            },
            {
                "is_hit": False,
                "player_name": "C",
                "prediction": "OVER",
                "line": 1,
                "market": "PTS",
                "actual_value": 0,
            },
            {
                "is_hit": False,
                "player_name": "D",
                "prediction": "OVER",
                "line": 1,
                "market": "PTS",
                "actual_value": 0,
            },
        ]
        embed = PickFormatter().daily_recap_embed(picks)
        assert int(embed.color) == 0xEF4444

    def test_unresolved_picks_excluded(self):
        picks = [{"is_hit": None, "player_name": "A"}]
        embed = PickFormatter().daily_recap_embed(picks)
        assert "0W - 0L" in embed.description


# ---------------------------------------------------------------------------
# PickFormatter — copilot embeds
# ---------------------------------------------------------------------------


class TestCopilotEmbed:
    def test_every_alert_type_with_game_and_ctx(self, game, pick):
        for alert_type in AlertType:
            embed = PickFormatter().copilot_embed(alert_type, "message text", game, pick)
            assert embed.description == "message text"
            assert embed.footer.text.startswith("X  |  V3  |  DraftKings")

    def test_daily_recap_title_excludes_game_score(self, game):
        embed = PickFormatter().copilot_embed(AlertType.DAILY_RECAP, "recap", game, None)
        assert "@" not in embed.title
        assert embed.title == "\U0001f3c6 Daily Recap"

    def test_non_recap_title_includes_game_score(self, game):
        embed = PickFormatter().copilot_embed(AlertType.HALFTIME_REPORT, "msg", game, None)
        assert f"{game.away_team} @ {game.home_team}" in embed.title

    def test_no_game_leaves_title_unmodified(self):
        embed = PickFormatter().copilot_embed(AlertType.HALFTIME_REPORT, "msg", None, None)
        assert embed.title == "\U0001f4cb Halftime Report"

    def test_no_ctx_uses_default_footer(self, game):
        embed = PickFormatter().copilot_embed(AlertType.HALFTIME_REPORT, "msg", game, None)
        assert embed.footer.text == "Cephalon Lumen — Game-Time Copilot"

    def test_unmapped_alert_type_uses_defaults(self, game, pick):
        embed = PickFormatter().copilot_embed(AlertType.STAT_SURGE, "msg", game, pick)
        assert embed.title.startswith("Lumen Update")
        assert int(embed.color) == 0x3B82F6


class TestHalftimeReportEmbed:
    def test_full_report(self):
        game = GameState(game_id="401", home_team="BOS", away_team="NYK")
        game.home_score, game.away_score, game.quarter, game.clock, game.status = (
            60,
            45,
            2,
            "0:00",
            "halftime",
        )

        with_pace = _mk_pick(pick_id=1, player_name="Tatum")
        with_pace.actual_value = 18.0
        with_pace.snapshots.append(
            PlayerSnapshot(
                timestamp=0,
                actual_value=18.0,
                game_minutes_elapsed=24.0,
                quarter=2,
                clock="0:00",
                pace_projection=36.0,
                score_diff=15,
            )
        )
        with_pace.box_score.minutes = 20.0
        with_pace.box_score.fg_made = 7
        with_pace.box_score.fg_attempted = 10
        with_pace.box_score.fouls = 3

        no_pace = _mk_pick(pick_id=2, player_name="Brown", market="ASSISTS", line=4.5)
        no_pace.actual_value = 2.0

        game.picks = {1: with_pace, 2: no_pace}

        embed = PickFormatter().halftime_report_embed(game)
        assert "Halftime Report" in embed.title
        assert "BOS 60 - NYK" in embed.description or "NYK 45 - BOS 60" in embed.description
        names = [f.name for f in embed.fields]
        assert any("Tatum" in n for n in names)
        assert any("Brown" in n for n in names)
        assert any("Score Alert" in n for n in names)  # abs_diff=15 >= 15

    def test_no_blowout_alert_below_threshold(self):
        game = GameState(game_id="402", home_team="BOS", away_team="NYK")
        game.home_score, game.away_score, game.quarter, game.status = 50, 48, 2, "halftime"
        p = _mk_pick(pick_id=1)
        p.actual_value = 10.0
        game.picks = {1: p}
        embed = PickFormatter().halftime_report_embed(game)
        names = [f.name for f in embed.fields]
        assert not any("Score Alert" in n for n in names)

    def test_unknown_comfort_sorts_last(self):
        game = GameState(game_id="403", home_team="BOS", away_team="NYK")
        game.status = "halftime"
        unknown = _mk_pick(pick_id=1, player_name="NoSnap")  # no snapshots -> comfort "unknown"
        game.picks = {1: unknown}
        embed = PickFormatter().halftime_report_embed(game)
        assert any("NoSnap" in f.name for f in embed.fields)


class TestDailyCopilotRecap:
    def test_no_resolved_picks(self):
        embed = PickFormatter().daily_copilot_recap([])
        assert embed.description == "No resolved picks today."
        assert int(embed.color) == 0x6B7280

    def test_dominant_day(self):
        picks = [_mk_pick(pick_id=i, player_name=f"P{i}") for i in range(1)]
        picks[0].is_hit = True
        picks[0].actual_value = 30.0
        embed = PickFormatter().daily_copilot_recap(picks)
        assert "Dominant" in embed.description
        assert int(embed.color) == 0x22C55E

    def test_solid_day(self):
        picks = [_mk_pick(pick_id=i, player_name=f"P{i}") for i in range(5)]
        for p in picks[:3]:
            p.is_hit = True
            p.actual_value = 30.0
        for p in picks[3:]:
            p.is_hit = False
            p.actual_value = 10.0
        embed = PickFormatter().daily_copilot_recap(picks)
        assert "Solid" in embed.description
        assert int(embed.color) == 0x22C55E

    def test_break_even_day(self):
        picks = [_mk_pick(pick_id=i, player_name=f"P{i}") for i in range(2)]
        picks[0].is_hit = True
        picks[0].actual_value = 30.0
        picks[1].is_hit = False
        picks[1].actual_value = 10.0
        embed = PickFormatter().daily_copilot_recap(picks)
        assert "Break-even" in embed.description
        assert int(embed.color) == 0xF59E0B

    def test_rough_day(self):
        picks = [_mk_pick(pick_id=i, player_name=f"P{i}") for i in range(4)]
        picks[0].is_hit = True
        picks[0].actual_value = 30.0
        for p in picks[1:]:
            p.is_hit = False
            p.actual_value = 10.0
        embed = PickFormatter().daily_copilot_recap(picks)
        assert "Rough" in embed.description
        assert int(embed.color) == 0xEF4444
