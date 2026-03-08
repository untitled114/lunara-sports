# Sport-Suite ↔ Lunara Integration

**Last Updated:** March 2026

Both repos are fully standalone. This document describes how they communicate
today, what changes during cloud migration, and the planned integration expansion.

---

## Current Integration (Hetzner, Shared Server)

```
Sport-Suite (nba/)                    Lunara (play-by-play/)
──────────────────                    ──────────────────────
Airflow generates picks
  → xl_picks_YYYY-MM-DD.json
  → /home/sportsuite/sport-suite/
    nba/betting_xl/predictions/
                                 ◄──  PickSyncPoller (5m)
                                       reads JSON from shared disk
                                       parses + team mapping
                                       UPSERT → model_picks

                                       PickTrackerPoller (30s)
                                       fetches ESPN box scores
                                       updates actual_value + is_hit
                                       broadcasts via WebSocket
```

**What works today:**
- Sport-Suite picks appear in Lunara's `model_picks` table within 5 minutes of generation
- Live stat tracking updates `actual_value` throughout the game
- `is_hit` is computed automatically when game goes final
- Frontend PickCard displays pick status in real-time

**What doesn't work yet:**
- Sport-Suite DB pools (nba_players, nba_games, nba_team) are initialized but unused
- No data flows from Lunara back to Sport-Suite
- File-based pick sync breaks when repos move to separate cloud environments

---

## Target Integration (Multi-Cloud)

```
AWS (Sport-Suite)                      GCP (Lunara)
─────────────────                      ────────────

Airflow (6x/day)
  → nba_prediction_history table
  → nba/api FastAPI
      GET /picks/today        ────────►  PickSyncPoller
      GET /picks/{date}                  (replaces file polling)

                              ◄────────  PATCH /picks/{id}/result
                                         (Lunara → Sport-Suite)
                                         closes feedback loop
                                         eliminates duplicate
                                         populate_actuals.py work

plays table accumulates              ──► OLAP store (ClickHouse/DuckDB)
game events (blowout, game script)       storage/olap/
                                   ◄──  V4 feature extraction
                                         Sport-Suite training reads
                                         new features from OLAP

Lumen bot (GCP)                    ◄──  /ws/{game_id} WebSocket
  Discord alerts                         pick_update events
  "LeBron at 22pts, needs 3 more"        subscription per active game
```

---

## Pick Sync: File → API

**Current (breaks on cloud migration):**
```python
# pick_sync_poller.py — reads from shared disk
picks_file = f"/home/sportsuite/sport-suite/nba/betting_xl/predictions/xl_picks_{date}.json"
```

**Target (API call, cloud-safe):**
```python
# pick_sync_poller.py — calls Sport-Suite API
response = await http_client.get(f"{SPORT_SUITE_API_URL}/picks/today")
picks = response.json()["picks"]
```

Sport-Suite's existing FastAPI (`nba/api/`) already has prediction endpoints.
Extend with a `/picks/{date}` endpoint returning the same JSON structure.
Both repos stay fully decoupled — Lunara just calls an HTTP endpoint.

**Config change required:**
```
SPORT_SUITE_API_URL=https://api.sport-suite.internal  # or AWS internal URL
SPORT_SUITE_API_KEY=...                                # simple bearer token
```

---

## Prediction History: New Table in Sport-Suite

Sport-Suite will add `nba_prediction_history` to track picks across multiple
daily pipeline runs (for Axiom's conviction scoring). Lunara benefits from this:

- Lunara can display how conviction evolved throughout the day
- PickCard can show "model held conviction across 4 runs" vs "conviction dropped"
- Endpoint: `GET /picks/today?include_history=true`

---

## Feedback Loop: Lunara → Sport-Suite

**Current problem:** Sport-Suite runs `populate_actuals.py` daily to compute
`actual_result` for historical props. Lunara's `pick_tracker_poller` computes
the same thing in real-time.

**Solution:** Lunara posts results back to Sport-Suite when `is_hit` is determined.

```python
# In pick_tracker_poller.py, when game goes final:
if is_hit is not None:
    await sport_suite_client.patch(
        f"/picks/{pick.sport_suite_id}/result",
        json={"actual_value": actual_value, "is_hit": is_hit}
    )
```

**Benefit:** Sport-Suite's validation and retraining pipeline gets results faster
(same day, not next morning). Eliminates duplicate computation.

---

## OLAP Store: Play-by-Play → V4 Model Features

Lunara's `plays` table accumulates game events. These contain signals that
Sport-Suite's current models cannot see (pre-game features only).

**New V4 features derivable from Lunara plays:**

| Feature | Derived From | Value |
|---------|-------------|-------|
| `blowout_rate_l5` | plays: score differential by quarter | Predicts garbage time |
| `game_script_sensitivity` | plays: stat drop in blowouts | Player-specific impact |
| `q4_usage_rate` | plays: actions in Q4 by player | Clutch vs non-clutch |
| `true_pace_l5` | plays: actual possessions counted | More accurate than team avg |
| `foul_trouble_rate` | plays: foul events by player | Minutes limiter |
| `defensive_matchup_score` | plays: who guards whom | Critical for props |

**Data flow:**
```
Lunara plays table
  → Nightly aggregation job (new script in Lunara)
  → storage/olap/ (ClickHouse or DuckDB)
  → Sport-Suite training pipeline reads via OLAP query
  → V4 model trained with 150+ features
```

The aggregation job lives in Lunara (it owns the data).
Sport-Suite reads from the OLAP store (it owns the training).
Neither repo imports the other.

---

## Lumen Bot: Discord Interface for Lunara

Lumen (GCP, Discord bot) subscribes to Lunara's WebSocket for games with
active Sport-Suite picks. No new tracking logic needed — Lunara already
does the work.

**Lumen's subscription pattern:**
```python
# On game start (or pick sync):
for game_id in games_with_active_picks:
    await connect_ws(f"wss://api.lunara-app.com/ws/{game_id}")

# On pick_update message:
if msg["type"] == "pick_update":
    pick = msg["data"]
    if approaching_line(pick):
        await discord.send(
            f"{pick['player_name']} at {pick['actual_value']} "
            f"({pick['market']}), line is {pick['line']}"
        )
    if pick["is_hit"] is not None:
        await discord.send(result_message(pick))
```

**Benefit:** Lumen is purely a consumer of Lunara's WebSocket.
No database connections. No polling. Lunara does all the work.

---

## Integration Points Summary

| Integration | Direction | Mechanism | Status |
|------------|-----------|----------|--------|
| Daily picks sync | Sport-Suite → Lunara | File (now) → API (migration) | Working → needs migration |
| Live pick tracking | Lunara internal | ESPN box score polling | Working |
| Pick results feedback | Lunara → Sport-Suite | PATCH API endpoint | Planned |
| Prediction history display | Sport-Suite → Lunara | GET API endpoint | Planned |
| V4 features (OLAP) | Lunara → OLAP ← Sport-Suite | ClickHouse/DuckDB | Planned |
| Discord alerts (Lumen) | Lunara → Discord | WebSocket subscription | Planned |
| Sport-Suite DB enrichment | Sport-Suite → Lunara | asyncpg pools (unused) | Initialized, not used |

---

## Build Priority

1. **Vite migration** — unblocks Lunara as portfolio + production frontend
2. **Wire Sport-Suite DB pools** — enrich game data (team pace, injuries), zero new infra
3. **API-based pick sync** — replaces file polling, migration-safe
4. **Pick result feedback endpoint** — close the loop, eliminate duplicate work
5. **OLAP store** — ClickHouse in `storage/olap/`, nightly aggregation job
6. **Lumen WebSocket subscriber** — Discord integration using existing Lunara WS
7. **Conviction history in PickCard** — display multi-run trend to users

---

## Standalone Contract

Both repos must remain independently deployable and testable.

**Lunara must not:**
- Import Sport-Suite Python code
- Connect directly to Sport-Suite databases (except the optional read-only pools for enrichment)
- Depend on Sport-Suite being deployed

**Sport-Suite must not:**
- Import Lunara Python code
- Connect directly to Lunara's database
- Depend on Lunara being deployed

**Communication only via:**
- HTTP/REST (Sport-Suite API → Lunara pick sync; Lunara → Sport-Suite results)
- OLAP store (Lunara writes features; Sport-Suite reads for training)
- WebSocket (Lumen subscribes to Lunara; not Sport-Suite itself)
