# Phase 2: Sport-Suite API Contract

**Why this matters:** Lunara's `pick_sync_poller.py` currently reads picks from a shared disk path (`/home/sportsuite/sport-suite/nba/betting_xl/predictions/xl_picks_YYYY-MM-DD.json`). When Lunara moves to GCP, there is no shared disk. This must be replaced with an HTTP call before migration.

---

## What Sport-Suite Needs to Build

A FastAPI endpoint in `nba/api/` that serves today's picks in a format Lunara can consume.

### Endpoint 1: Get Picks for a Date

```
GET /picks/{date}
GET /picks/today        (shorthand, date = today in ET)

Authorization: Bearer {SPORT_SUITE_API_KEY}
```

**Response:**
```json
{
  "date": "2026-03-08",
  "generated_at": "2026-03-08T09:15:00",
  "pipeline_run": 3,
  "picks": [
    {
      "id": "uuid",
      "player_name": "LeBron James",
      "team": "LAL",
      "opponent_team": "GSW",
      "stat_type": "POINTS",
      "side": "OVER",
      "line": 24.5,
      "softest_line": 23.5,
      "softest_book": "fanduel",
      "edge_pct": 12.3,
      "p_over": 0.82,
      "tier": "X",
      "model_version": "v3",
      "consensus": true,
      "game_time": "20:10:00",
      "game_date": "2026-03-08"
    }
  ]
}
```

**Notes:**
- `id` must be stable across pipeline runs for the same player+date+stat. Use UUID5 with a deterministic namespace, e.g. `uuid.uuid5(uuid.NAMESPACE_DNS, f"{player_name}:{game_date}:{stat_type}")`. Lunara deduplicates on this ID — a changing ID causes duplicate inserts.
- `game_time` is in ET (`HH:MM:SS` string, same as what `generate_xl_predictions.py` now produces).
- Return all picks including all tiers. Lunara filters what it displays.
- If no picks exist for the date, return `{"picks": [], "date": "..."}` — do not 404.

### Endpoint 2: Conviction History (Optional, Phase 2+)

```
GET /picks/{date}?include_history=true
```

Adds `history` array per pick showing p_over trend across runs:
```json
{
  "id": "...",
  "player_name": "LeBron James",
  ...
  "history": [
    {"run": 1, "p_over": 0.78, "line": 24.5, "timestamp": "..."},
    {"run": 2, "p_over": 0.80, "line": 24.5, "timestamp": "..."},
    {"run": 3, "p_over": 0.82, "line": 23.5, "timestamp": "..."}
  ]
}
```

This pulls from `nba_prediction_history` table (already being built for Axiom). Lunara can display "model held conviction across 3 runs" in PickCard.

---

## What Lunara Needs to Change

**File:** `api/src/services/pick_sync_poller.py`

### Current Code (Hetzner only)
```python
PICKS_FILE = f"/home/sportsuite/sport-suite/nba/betting_xl/predictions/xl_picks_{date}.json"
with open(PICKS_FILE) as f:
    data = json.load(f)
picks = data.get("picks", [])
```

### Target Code (Cloud-safe)
```python
SPORT_SUITE_API_URL = os.getenv("SPORT_SUITE_API_URL")
SPORT_SUITE_API_KEY = os.getenv("SPORT_SUITE_API_KEY")

async def _fetch_picks(date: str) -> list[dict]:
    if SPORT_SUITE_API_URL:
        # Cloud path: HTTP API
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SPORT_SUITE_API_URL}/picks/{date}",
                headers={"Authorization": f"Bearer {SPORT_SUITE_API_KEY}"},
                timeout=10.0,
            )
            resp.raise_for_status()
            return resp.json().get("picks", [])
    else:
        # Local fallback: shared disk (Hetzner compatibility)
        path = f"/home/sportsuite/sport-suite/nba/betting_xl/predictions/xl_picks_{date}.json"
        with open(path) as f:
            return json.load(f).get("picks", [])
```

**Config required (add to `.env` on GCP):**
```
SPORT_SUITE_API_URL=https://api.sport-suite.internal
SPORT_SUITE_API_KEY=lunara-k8x2-vf7q-3mn9
```

When `SPORT_SUITE_API_URL` is not set, falls back to file path — Hetzner keeps working until migration.

---

## Team Mapping Compatibility

Lunara's `api/src/services/team_mapping.py` maps Sport-Suite abbreviations (e.g., `NOP`, `SAS`) to NBA standard (e.g., `NO`, `SA`). The API response should use **Sport-Suite's abbreviations** — Lunara handles the normalization. Do not try to standardize on Sport-Suite side.

---

## Authentication

Simple bearer token. Sport-Suite generates a static secret, stores as env var on both sides:

```python
# Sport-Suite API (nba/api/auth.py or inline dependency)
def verify_lunara_token(authorization: str = Header(None)):
    expected = os.getenv("LUNARA_API_KEY")
    if not expected or authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401)
```

This is internal service-to-service auth — no JWT, no OAuth. A static pre-shared key is sufficient.

---

## Migration Sequence

1. Sport-Suite builds and deploys `GET /picks/{date}` endpoint
2. Lunara's `pick_sync_poller.py` updated with dual-path logic above
3. Both deployed to Hetzner — test with `SPORT_SUITE_API_URL` set on Lunara side
4. Verify picks appear in `model_picks` table as before
5. During GCP migration, set `SPORT_SUITE_API_URL` on GCP environment — done
