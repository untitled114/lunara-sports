# Phase 6: OLAP Store + V4 Model Features

**Goal:** Extract game-script features from Lunara's `plays` table that Sport-Suite's current models cannot see (they use pre-game features only). These become V4 model training features.

**Existing schema planning:** `storage/olap/schema.md`
**Storage options:** ClickHouse (recommended), DuckDB (simpler), BigQuery (native GCP)

---

## Why Pre-Game Features Are Not Enough

Sport-Suite's XL (102 features) and V3 (136 features) models predict player props using pre-game data:
- Rolling stats (L3/L5/L10/L20)
- Team pace and ratings
- Matchup history
- Line movement

These miss critical in-game dynamics that explain a large fraction of prop variance:

| Signal | Why It Matters |
|--------|----------------|
| Blowout rate | Players sit in garbage time → DNP or reduced stats |
| Game script | Trailing teams shoot more (helps points), fewer boards |
| 4th quarter usage | Clutch players get more touches → stats skew in close games |
| True pace | Team pace averages are noisy; actual possession counts are more accurate |
| Foul trouble | 3+ fouls in 1st half → reduced minutes |
| Defensive matchup | Who actually guarded the player in recent games |

---

## V4 Features to Build

### Feature 1: `blowout_rate_l5`

**Definition:** Fraction of last 5 games where the player's team had a 15+ point deficit or lead by Q4.
**Source:** `plays` table, `score_diff` by quarter and time.

```sql
-- ClickHouse aggregation
SELECT
    player_id,
    countIf(abs(final_q4_diff) >= 15) / count(*) AS blowout_rate_l5
FROM game_scripts
WHERE game_date >= today() - 5
  AND player_id = ?
GROUP BY player_id
```

**Usage:** High `blowout_rate_l5` → player likely to sit in garbage time → reduce POINTS projection.

---

### Feature 2: `game_script_sensitivity`

**Definition:** Player's stat drop when their team trails by 10+ in Q4, vs. normal games.
**Source:** `plays` table + `player_game_logs`.

```sql
SELECT
    player_id,
    avg(points_in_blowout) / NULLIF(avg(points_normal), 0) AS game_script_sensitivity
FROM (
    SELECT
        player_id,
        game_id,
        sumIf(stat_value, score_diff < -10 AND quarter = 4) AS points_in_blowout,
        sumIf(stat_value, abs(score_diff) < 10) AS points_normal
    FROM player_actions pa
    JOIN game_states gs ON pa.game_id = gs.game_id AND pa.time_elapsed = gs.time_elapsed
    WHERE stat_type = 'points'
)
GROUP BY player_id
```

Values near 1.0 = unaffected by game script. Values < 0.7 = major blowout sensitivity.

---

### Feature 3: `q4_usage_rate`

**Definition:** Player's share of team actions in Q4 compared to Q1-Q3.
**Source:** `plays` table, `player_id` per action.

```sql
SELECT
    player_id,
    team_id,
    countIf(quarter = 4) / NULLIF(countIf(quarter < 4), 0) AS q4_usage_rate
FROM player_actions
WHERE game_date >= today() - 10
GROUP BY player_id, team_id
```

High `q4_usage_rate` = clutch usage. Close games → more Q4 touches → stat boost.

---

### Feature 4: `true_pace_l5`

**Definition:** Actual possession count per game (last 5), computed from live play data.
**Source:** `plays` table — count possession-ending events (shots, turnovers, free throw sets).

```sql
SELECT
    game_id,
    team_id,
    countIf(event_type IN ('field_goal_attempt', 'turnover', 'free_throw_final')) AS possessions
FROM plays
WHERE game_date >= today() - 5
GROUP BY game_id, team_id
```

More accurate than Basketball Reference pace (based on estimated possessions). Directly from live data.

---

### Feature 5: `foul_trouble_rate`

**Definition:** Fraction of last 10 games where player had 3+ fouls by halftime.
**Source:** `plays` table, foul events by time.

```sql
SELECT
    player_id,
    countIf(first_half_fouls >= 3) / count(*) AS foul_trouble_rate
FROM (
    SELECT
        player_id,
        game_id,
        countIf(event_type = 'foul' AND quarter <= 2) AS first_half_fouls
    FROM player_actions
    WHERE game_date >= today() - 10
    GROUP BY player_id, game_id
)
GROUP BY player_id
```

High `foul_trouble_rate` → player likely to sit in first half → major minutes reducer.

---

### Feature 6: `defensive_matchup_score`

**Definition:** When opponent's star player is on the floor, how often does this player guard them? Derived from proximity/action clusters.

This is the hardest feature to compute from ESPN play-by-play (no direct "who guarded whom" data). Approximation: cluster actions where both players appear in the same 2-minute window and there's a defensive event.

**Phase 6.5 (later):** Use tracking data if available. For now, use matchup history from Sport-Suite's `matchup_history` table (already in `nba_intelligence` DB).

---

## Storage: ClickHouse vs DuckDB vs BigQuery

| Option | Pros | Cons | Monthly Cost |
|--------|------|------|-------------|
| **ClickHouse** (Cloud) | Purpose-built for analytical queries, columnar, fast aggregations | Separate service to manage | ~$20-50/mo |
| **DuckDB** (embedded) | Zero infra, runs inside Python, reads from Parquet | Not distributed, no persistence | $0 |
| **BigQuery** | Native GCP, scales infinitely, no management | $5/TB scanned (not flat rate) | $5-20/mo |

**Recommendation for Phase 6:** Start with **DuckDB + Parquet files on Cloud Storage**.
- Nightly aggregation job reads `plays` table from PostgreSQL, writes Parquet to GCS
- Sport-Suite training script reads Parquet via DuckDB
- Zero new services, zero cost, zero ops overhead
- Migrate to ClickHouse if query time exceeds 30s (unlikely at this data volume)

---

## Implementation Plan

### Step 1: Nightly Aggregation Job (Lunara)

New script: `api/src/scripts/aggregate_v4_features.py`

```python
"""
Runs nightly. Reads plays/game_scripts from PostgreSQL,
computes V4 features per player, writes to GCS as Parquet.
"""
async def run():
    plays_df = await load_recent_plays(days=60)
    features = compute_v4_features(plays_df)  # All 6 features
    write_parquet(features, "gs://lunara-olap/v4_features_{date}.parquet")
```

Schedule: Cloud Scheduler → Cloud Run Job → runs at 6 AM ET daily (after games finish).

### Step 2: Sport-Suite Training Hook

New file: `nba/features/extractors/olap_features.py`

```python
import duckdb

def extract_v4_features(player_name: str, game_date: str) -> dict:
    """Read V4 features from Lunara OLAP (Parquet on GCS or local)."""
    conn = duckdb.connect()
    row = conn.execute("""
        SELECT blowout_rate_l5, game_script_sensitivity, q4_usage_rate,
               true_pace_l5, foul_trouble_rate
        FROM read_parquet('gs://lunara-olap/v4_features_*.parquet')
        WHERE player_name = ? AND feature_date = ?
        LIMIT 1
    """, [player_name, game_date]).fetchone()
    return dict(zip(FEATURE_NAMES, row)) if row else {}
```

### Step 3: Wire into `extract_live_features_xl.py`

Add V4 extractor to the feature extraction pipeline. Features are appended after V3's 136, creating a 142+ feature set.

```python
# In extract_live_features_xl.py
v4_features = extract_v4_features(player_name, game_date)
features.update(v4_features)  # Adds 5-6 new features
```

### Step 4: Retrain V4 Models

```bash
# Build new training dataset with V4 features
python3 nba/features/build_xl_training_dataset.py --include-v4 --output datasets/

# Train V4 models (142+ features)
python3 nba/models/train_market.py --market POINTS --version v4 --data datasets/v4_training_POINTS.csv
```

---

## V4 Feature Quality Gate

Before including a feature in V4 training:
1. **Coverage:** ≥ 80% of training rows must have non-null value
2. **Correlation with target:** Pearson |r| ≥ 0.05 with `is_over`
3. **No leakage:** Feature computed from plays BEFORE the game being predicted
4. **Stability:** Feature value distribution doesn't shift seasonally by more than 2σ

Features failing the gate are logged but excluded from training.
