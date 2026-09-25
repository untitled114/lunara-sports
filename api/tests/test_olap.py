"""Tests for OLAP exporter and poller."""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pyarrow.parquet as pq
import pytest

from src.services.olap_exporter import _pick_to_row, export_picks_for_date
from src.services.olap_poller import _seconds_until_midnight_et, run_olap_poller

# ---------------------------------------------------------------------------
# olap_exporter
# ---------------------------------------------------------------------------


def _make_pick(**kwargs):
    pick = MagicMock()
    pick.id = kwargs.get("id", 1)
    pick.game_id = kwargs.get("game_id", "401234567")
    pick.player_name = kwargs.get("player_name", "LeBron James")
    pick.team = kwargs.get("team", "LAL")
    pick.market = kwargs.get("market", "POINTS")
    pick.line = kwargs.get("line", 25.5)
    pick.prediction = kwargs.get("prediction", "OVER")
    pick.p_over = kwargs.get("p_over", 0.72)
    pick.edge = kwargs.get("edge", 3.1)
    pick.edge_pct = kwargs.get("edge_pct", 12.5)
    pick.book = kwargs.get("book", "DraftKings")
    pick.model_version = kwargs.get("model_version", "xl")
    pick.tier = kwargs.get("tier", "Z")
    pick.actual_value = kwargs.get("actual_value", 28.0)
    pick.is_hit = kwargs.get("is_hit", True)
    pick.opponent_team = kwargs.get("opponent_team", "GSW")
    pick.is_home = kwargs.get("is_home", True)
    pick.confidence = kwargs.get("confidence", "high")
    pick.line_spread = kwargs.get("line_spread", 1.5)
    pick.sport_suite_id = kwargs.get("sport_suite_id", "abc-123")
    pick.rolling_stats = kwargs.get("rolling_stats", {"avg_l5": 27.2, "avg_l10": 25.8})
    pick.injury_status = kwargs.get("injury_status")
    pick.game_date = kwargs.get("game_date", date(2026, 3, 8))
    pick.created_at = kwargs.get("created_at", datetime(2026, 3, 8, 10, 0, 0, tzinfo=timezone.utc))
    return pick


def test_pick_to_row_full():
    pick = _make_pick()
    row = _pick_to_row(pick)

    assert row["player_name"] == "LeBron James"
    assert row["market"] == "POINTS"
    assert row["line"] == 25.5
    assert row["actual_value"] == 28.0
    assert row["is_hit"] is True
    assert row["rolling_stats"] == '{"avg_l5": 27.2, "avg_l10": 25.8}'
    assert row["injury_status"] is None
    assert row["game_date"] == date(2026, 3, 8)


def test_pick_to_row_nulls():
    pick = _make_pick(
        line=None,
        p_over=None,
        edge=None,
        edge_pct=None,
        actual_value=None,
        line_spread=None,
        rolling_stats=None,
    )
    row = _pick_to_row(pick)
    assert row["line"] is None
    assert row["rolling_stats"] is None
    assert row["actual_value"] is None


@pytest.mark.asyncio
async def test_export_picks_no_resolved(tmp_path: Path):
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    session.execute = AsyncMock(return_value=result)

    count = await export_picks_for_date(session, date(2026, 3, 8), tmp_path)
    assert count == 0
    assert not (tmp_path / "model_picks").exists()


@pytest.mark.asyncio
async def test_export_picks_writes_local_parquet(tmp_path: Path):
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = [_make_pick()]
    session.execute = AsyncMock(return_value=result)

    count = await export_picks_for_date(session, date(2026, 3, 8), tmp_path)

    assert count == 1
    out = tmp_path / "model_picks" / "game_date=2026-03-08" / "picks.parquet"
    assert out.exists()
    table = pq.read_table(out)
    assert table.num_rows == 1
    assert table.column("player_name")[0].as_py() == "LeBron James"


# ---------------------------------------------------------------------------
# olap_poller
# ---------------------------------------------------------------------------


def test_seconds_until_midnight_positive():
    secs = _seconds_until_midnight_et()
    assert secs > 0
    assert secs <= 86460  # never more than 24h + 1min


@pytest.mark.asyncio
async def test_run_olap_poller_skipped_no_settings():
    """Poller exits immediately when no settings/export dir configured."""
    with patch("src.services.olap_poller.get_session_factory", return_value=None):
        # Should return quickly, not loop
        await asyncio.wait_for(run_olap_poller(settings=None), timeout=1.0)


@pytest.mark.asyncio
async def test_run_olap_poller_skipped_empty_export_dir():
    settings = MagicMock()
    settings.olap_export_dir = ""
    await asyncio.wait_for(run_olap_poller(settings=settings), timeout=1.0)
