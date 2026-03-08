# Phase 3: Wire Sport-Suite DB Pools

**File:** `api/src/db/sport_suite.py`
**Effort:** Half day
**Dependency:** None — can be done any time before or after GCP migration

---

## Current State

Three asyncpg connection pools are initialized but never queried:

```python
# api/src/db/sport_suite.py
nba_players_pool: Optional[asyncpg.Pool] = None   # port 5536
nba_games_pool: Optional[asyncpg.Pool] = None     # port 5537
nba_team_pool: Optional[asyncpg.Pool] = None      # port 5538
```

They connect to Sport-Suite's local PostgreSQL databases (Docker, on the same server on Hetzner). The pools are created on startup if `SPORT_SUITE_DB_*` env vars are set, and are safely skipped if not.

This optional enrichment layer was planned but never wired to any router or service.

---

## What to Wire

### 1. Team Stats Enrichment (nba_team_pool)

**Query:** `team_stats` table (port 5538, `nba_team`)
**Use case:** Enrich game data in `GET /games/{id}` response with current team pace and ratings.

```python
async def get_team_context(team_abbrev: str, game_date: str) -> dict:
    """Return pace, offensive_rating, defensive_rating for a team."""
    async with nba_team_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT pace, offensive_rating, defensive_rating, wins, losses
            FROM team_stats
            WHERE team_abbrev = $1
            ORDER BY last_updated DESC
            LIMIT 1
        """, team_abbrev)
    return dict(row) if row else {}
```

Add this to `GET /games/{id}` response as `home_context` and `away_context`. Frontend can display pace/rating context on GameDetailPage.

### 2. Injury Status (nba_intelligence_pool)

**Query:** `injuries` in intelligence DB (port 5539, `nba_intelligence`)
**Use case:** Flag picks for players with active injury reports.

```python
async def get_injury_status(player_name: str, game_date: str) -> Optional[str]:
    """Return injury status string or None if healthy."""
    # NOTE: injuries table is in nba_intelligence (port 5539), NOT nba_players (port 5536)
    async with nba_intelligence_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT status FROM injuries
            WHERE player_name ILIKE $1
              AND date = $2
            LIMIT 1
        """, player_name, game_date)
    return row["status"] if row else None
```

Add to pick sync: when ingesting picks from Sport-Suite, check injury status and set a flag on the `model_picks` row. Frontend BetTracker can show a ⚠️ badge on injured players.

### 3. Rolling Stats (nba_players_pool)

**Query:** `player_rolling_stats` table (port 5536, `nba_players`)
**Use case:** Enrich PickCard with player's L5/L10 averages for context.

```python
async def get_player_rolling_stats(player_id: str, stat_type: str) -> dict:
    """Return L5/L10 averages and trend for a player/stat combo."""
    async with nba_players_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT avg_l5, avg_l10, avg_l20, ema_l5, ema_l10
            FROM player_rolling_stats
            WHERE player_id = $1 AND stat_type = $2
            ORDER BY game_date DESC
            LIMIT 1
        """, player_id, stat_type)
    return dict(row) if row else {}
```

Add to `GET /games/{id}/picks` response. Frontend PickCard can show mini trend: "LeBron avg 26.3 L5, line is 24.5."

---

## Where to Add It

**Router:** `api/src/routers/games.py` → `GET /games/{id}` for team context
**Router:** `api/src/routers/picks.py` → `GET /games/{id}/picks` for injury flags + rolling stats
**Service:** `api/src/services/pick_sync_poller.py` → injury enrichment during sync

All queries are **read-only** and wrapped in `Optional` guards — if pool is `None` (sport_suite.py not configured), functions return empty dicts and picks still render without enrichment.

---

## Configuration

```bash
# Add to server .env (Hetzner and later GCP/Cloud SQL proxy)
SPORT_SUITE_DB_HOST=localhost          # same server on Hetzner
SPORT_SUITE_DB_USER=mlb_user
SPORT_SUITE_DB_PASSWORD=mlb_secure_2025
```

On GCP, Sport-Suite's DBs are on AWS. Options:
1. **Cloud SQL Auth Proxy** — forward AWS RDS connections through GCP (adds latency, not ideal)
2. **Expose Sport-Suite read replica** with restricted network access
3. **Skip DB pools on GCP** — enrichment is optional. Keep only the API-based pick sync.

Recommendation: **Skip DB pools on GCP**. The API contract (`02-SPORT-SUITE-API-CONTRACT.md`) should include rolling stats in the picks response. Lunara doesn't need a direct DB connection if Sport-Suite serves the data it needs via API.

---

## Note on GCP Migration

If the picks API response includes rolling stats and injury flags (Sport-Suite enriches the data server-side), Lunara doesn't need these DB pools at all on GCP. The pools are a Hetzner convenience shortcut that avoids building the API first.

Decision: Wire pools on Hetzner as a quick win now, then deprecate during GCP migration in favor of the API contract.
