"""Export resolved model_picks to GCS as Parquet for V4 model retraining.

Partition layout:
  gs://{bucket}/model_picks/game_date={YYYY-MM-DD}/picks.parquet

Only picks with is_hit IS NOT NULL are exported (game must be final).
Safe to re-run — overwrites the partition for a given date.
"""

from __future__ import annotations

import io
import json
from datetime import date

import pyarrow as pa
import pyarrow.parquet as pq
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import ModelPick

logger = structlog.get_logger(__name__)

# Parquet schema — matches model_picks columns Sport-Suite needs for retraining
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
        pa.field("game_date", pa.date32()),
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


async def export_picks_for_date(
    session: AsyncSession,
    export_date: date,
    gcs_bucket: str,
) -> int:
    """Export all resolved picks for a date to GCS as Parquet.

    Returns count of rows exported (0 if nothing to export).
    Skips upload if no resolved picks exist for the date.
    """
    stmt = (
        select(ModelPick)
        .where(ModelPick.game_date == export_date)
        .where(ModelPick.is_hit.is_not(None))
        .order_by(ModelPick.id)
    )
    result = await session.execute(stmt)
    picks = result.scalars().all()

    if not picks:
        logger.info("olap_exporter.no_resolved_picks", date=export_date.isoformat())
        return 0

    rows = [_pick_to_row(p) for p in picks]

    # Build columnar dict for pyarrow
    columns: dict[str, list] = {field.name: [] for field in _SCHEMA}
    for row in rows:
        for field in _SCHEMA:
            columns[field.name].append(row.get(field.name))

    table = pa.table(columns, schema=_SCHEMA)

    # Serialize to in-memory Parquet buffer
    buf = io.BytesIO()
    pq.write_table(table, buf, compression="snappy")
    buf.seek(0)

    # Upload to GCS
    from google.cloud import storage as gcs

    client = gcs.Client()
    bucket = client.bucket(gcs_bucket)
    blob_path = f"model_picks/game_date={export_date.isoformat()}/picks.parquet"
    blob = bucket.blob(blob_path)
    blob.upload_from_file(buf, content_type="application/octet-stream")

    logger.info(
        "olap_exporter.uploaded",
        date=export_date.isoformat(),
        rows=len(rows),
        path=f"gs://{gcs_bucket}/{blob_path}",
    )
    return len(rows)
