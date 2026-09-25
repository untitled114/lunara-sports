"""Export resolved model_picks to a local directory as Parquet, for V4 model retraining.

Partition layout:
  {export_dir}/model_picks/game_date={YYYY-MM-DD}/picks.parquet

Only picks with is_hit IS NOT NULL are exported (game must be final).
Safe to re-run — overwrites the partition for a given date.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import ModelPick

logger = structlog.get_logger(__name__)

# Parquet schema — matches model_picks columns Sport-Suite needs for retraining.
# `game_date` is intentionally omitted: it is the Hive partition key
# (game_date=YYYY-MM-DD in the directory name) and embedding it as a column too
# collides with pyarrow's partition-column type inference on read.
_SCHEMA = pa.schema(
    [
        pa.field("id", pa.int64()),
        pa.field("game_id", pa.string()),
        pa.field("player_name", pa.string()),
        pa.field("team", pa.string()),
        pa.field("market", pa.string()),
        pa.field("line", pa.float32()),
        pa.field("prediction", pa.string()),
        pa.field("p_over", pa.float32()),
        pa.field("edge", pa.float32()),
        pa.field("edge_pct", pa.float32()),
        pa.field("book", pa.string()),
        pa.field("model_version", pa.string()),
        pa.field("tier", pa.string()),
        pa.field("actual_value", pa.float32()),
        pa.field("is_hit", pa.bool_()),
        pa.field("opponent_team", pa.string()),
        pa.field("is_home", pa.bool_()),
        pa.field("confidence", pa.string()),
        pa.field("line_spread", pa.float32()),
        pa.field("sport_suite_id", pa.string()),
        pa.field("rolling_stats", pa.string()),  # JSON-encoded
        pa.field("injury_status", pa.string()),
        pa.field("created_at", pa.timestamp("us", tz="UTC")),
    ]
)


def _pick_to_row(pick: ModelPick) -> dict:
    return {
        "id": pick.id,
        "game_id": pick.game_id,
        "player_name": pick.player_name,
        "team": pick.team,
        "market": pick.market,
        "line": float(pick.line) if pick.line is not None else None,
        "prediction": pick.prediction,
        "p_over": float(pick.p_over) if pick.p_over is not None else None,
        "edge": float(pick.edge) if pick.edge is not None else None,
        "edge_pct": float(pick.edge_pct) if pick.edge_pct is not None else None,
        "book": pick.book,
        "model_version": pick.model_version,
        "tier": pick.tier,
        "actual_value": float(pick.actual_value) if pick.actual_value is not None else None,
        "is_hit": pick.is_hit,
        "opponent_team": pick.opponent_team,
        "is_home": pick.is_home,
        "confidence": pick.confidence,
        "line_spread": float(pick.line_spread) if pick.line_spread is not None else None,
        "sport_suite_id": pick.sport_suite_id,
        "rolling_stats": json.dumps(pick.rolling_stats) if pick.rolling_stats else None,
        "injury_status": pick.injury_status,
        "game_date": pick.game_date,
        "created_at": pick.created_at,
    }


async def _fetch_rows(session: AsyncSession, export_date: date) -> list[dict]:
    """Fetch and flatten all resolved picks for a date."""
    stmt = (
        select(ModelPick)
        .where(ModelPick.game_date == export_date)
        .where(ModelPick.is_hit.is_not(None))
        .order_by(ModelPick.id)
    )
    result = await session.execute(stmt)
    picks = result.scalars().all()
    return [_pick_to_row(p) for p in picks]


async def export_picks_for_date(
    session: AsyncSession,
    export_date: date,
    export_dir: str | Path,
) -> int:
    """Export all resolved picks for a date to a local Parquet partition.

    Returns count of rows exported (0 if nothing to export).
    Skips writing if no resolved picks exist for the date.
    """
    rows = await _fetch_rows(session, export_date)

    if not rows:
        logger.info("olap_exporter.no_resolved_picks", date=export_date.isoformat())
        return 0

    # Build columnar dict for pyarrow
    columns: dict[str, list] = {field.name: [] for field in _SCHEMA}
    for row in rows:
        for field in _SCHEMA:
            columns[field.name].append(row.get(field.name))

    table = pa.table(columns, schema=_SCHEMA)

    out = (
        Path(export_dir) / "model_picks" / f"game_date={export_date.isoformat()}" / "picks.parquet"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, out, compression="snappy")
    logger.info(
        "olap_exporter.written",
        date=export_date.isoformat(),
        rows=len(rows),
        path=str(out),
    )
    return len(rows)
