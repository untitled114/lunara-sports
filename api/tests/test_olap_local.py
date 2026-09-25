"""OLAP export to a local directory instead of GCS (Task 12)."""

from __future__ import annotations

import asyncio
from datetime import date
from pathlib import Path

import pyarrow.parquet as pq


async def test_export_writes_partitioned_parquet(session, tmp_path: Path, monkeypatch):
    from src.services import olap_exporter

    rows = [{f.name: None for f in olap_exporter._SCHEMA}]

    async def fake_rows(_session, _date):
        return rows

    monkeypatch.setattr(olap_exporter, "_fetch_rows", fake_rows)
    n = await olap_exporter.export_picks_for_date(session, date(2026, 10, 21), tmp_path)
    out = tmp_path / "model_picks" / "game_date=2026-10-21" / "picks.parquet"
    assert n == 1 and out.exists() and pq.read_table(out).num_rows == 1


async def test_poller_disabled_without_export_dir():
    from src.config import Settings
    from src.services.olap_poller import run_olap_poller

    s = Settings(_env_file=None, olap_export_dir="")
    # R5/ruling: bound the wait so a regression that reintroduces a real
    # loop fails fast instead of hanging.
    assert s.olap_export_dir == ""
    await asyncio.wait_for(run_olap_poller(s), timeout=2)
