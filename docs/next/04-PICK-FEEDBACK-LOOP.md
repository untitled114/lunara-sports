# Phase 4: Pick Result Feedback Loop

**Problem:** Sport-Suite runs `populate_actuals.py` every morning to fetch box scores and mark picks as hits/misses. Lunara's `pick_tracker_poller.py` already does this in real-time during live games. We're duplicating the same ESPN box score fetching to compute the same result.

**Solution:** When Lunara finalizes a result, POST it back to Sport-Suite. Sport-Suite gets same-day results instead of next-morning batch.

---

## Data Flow After Fix

```
Sport-Suite Airflow (9 AM)
  → xl_picks_2026-03-08.json → model_picks (via API)

Lunara pick_tracker_poller (30s)
  → fetches ESPN box scores during live game
  → updates model_picks: actual_value=28.3, is_hit=True
  → POSTs to Sport-Suite:
      PATCH /picks/{sport_suite_id}/result
      {"actual_value": 28.3, "is_hit": true, "source": "lunara"}

Sport-Suite
  → updates nba_props_xl.actual_result
  → pick available for same-day validation
  → no longer needs populate_actuals.py for that pick
```

---

## What Lunara Needs to Build

### 1. Sport-Suite Client (`api/src/services/sport_suite_client.py`)

```python
import httpx
import os
import structlog

logger = structlog.get_logger()
SPORT_SUITE_API_URL = os.getenv("SPORT_SUITE_API_URL")
SPORT_SUITE_API_KEY = os.getenv("SPORT_SUITE_API_KEY")


async def post_pick_result(sport_suite_id: str, actual_value: float, is_hit: bool) -> bool:
    """
    POST pick result back to Sport-Suite when game goes final.
    Returns True on success, False on failure (non-blocking).
    """
    if not SPORT_SUITE_API_URL:
        return False  # Not configured — skip silently

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{SPORT_SUITE_API_URL}/picks/{sport_suite_id}/result",
                json={
                    "actual_value": actual_value,
                    "is_hit": is_hit,
                    "source": "lunara",
                },
                headers={"Authorization": f"Bearer {SPORT_SUITE_API_KEY}"},
                timeout=5.0,
            )
            if resp.status_code == 200:
                return True
            logger.warning("sport_suite_result_post_failed", status=resp.status_code, pick_id=sport_suite_id)
            return False
    except Exception as e:
        logger.warning("sport_suite_result_post_error", error=str(e), pick_id=sport_suite_id)
        return False  # Always non-blocking
```

### 2. Trigger in `pick_tracker_poller.py`

```python
# In the section that finalizes a pick result (game goes FINAL):
if game_status == "FINAL" and is_hit is not None:
    # Update local model_picks
    await db.execute(
        "UPDATE model_picks SET actual_value=$1, is_hit=$2 WHERE id=$3",
        actual_value, is_hit, pick.id
    )

    # Post result back to Sport-Suite (non-blocking, best-effort)
    sport_suite_id = pick.sport_suite_id  # stored during pick sync
    if sport_suite_id:
        asyncio.create_task(
            post_pick_result(sport_suite_id, actual_value, is_hit)
        )
```

The feedback is fire-and-forget via `asyncio.create_task`. A failure doesn't affect Lunara's operation.

---

## What Sport-Suite Needs to Build

### Endpoint: `PATCH /picks/{id}/result`

```python
# nba/api/routers/picks.py

@router.patch("/picks/{pick_id}/result")
async def update_pick_result(
    pick_id: str,
    body: PickResultUpdate,
    _: None = Depends(verify_lunara_token),
):
    """Receive actual result from Lunara when a game goes final."""
    # Update nba_props_xl (the actual source-of-truth table)
    await db.execute("""
        UPDATE nba_props_xl
        SET actual_result = $1,
            result_source = 'lunara',
            result_updated_at = NOW()
        WHERE id = $2
    """, body.actual_value, pick_id)

    # Also update nba_prediction_history if it exists for this pick
    await db.execute("""
        UPDATE nba_prediction_history
        SET actual_value = $1, is_hit = $2
        WHERE pick_id = $3
    """, body.actual_value, body.is_hit, pick_id)

    return {"status": "ok"}
```

### Schema Addition to `nba_props_xl`

```sql
ALTER TABLE nba_props_xl
    ADD COLUMN IF NOT EXISTS result_source VARCHAR(20),
    ADD COLUMN IF NOT EXISTS result_updated_at TIMESTAMPTZ;
```

`result_source` values: `'populate_actuals'` (batch), `'lunara'` (real-time), `'manual'`.

---

## Storing `sport_suite_id` in Lunara

The `model_picks` table needs a column to store the Sport-Suite pick ID for the callback:

```sql
-- Migration 010_sport_suite_id.sql
ALTER TABLE model_picks
    ADD COLUMN IF NOT EXISTS sport_suite_id VARCHAR(64);
```

Populated during pick sync from the `id` field in the API response:
```python
# pick_sync_poller.py
await db.execute("""
    INSERT INTO model_picks (..., sport_suite_id)
    VALUES (..., $n)
    ON CONFLICT (player_name, game_date, stat_type) DO UPDATE
    SET sport_suite_id = EXCLUDED.sport_suite_id
""", ..., pick["id"])
```

---

## Impact on `populate_actuals.py`

After this feedback loop is live, Sport-Suite's `populate_actuals.py` becomes a safety net, not the primary path:

1. Lunara posts results same-day as games go final
2. `populate_actuals.py` runs next morning as a catch-up for any picks Lunara missed
3. The Sport-Suite `result_source` column tells which path filled the result

Eventually `populate_actuals.py` can be reduced to a weekly backfill job rather than daily.
