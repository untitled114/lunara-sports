# Lunara — Next Steps Roadmap

**Last Updated:** March 2026
**Context:** Axiom (NBA Discord bot) is fully operational on AWS. Hetzner is on 2-day decommission hold (until March 9). Lunara is ~85% complete with frontend Vite migration as the only current blocker.

---

## Status Snapshot

| Layer | Status | Notes |
|-------|--------|-------|
| Ingestion (ESPN → Kafka) | ✅ Deployed | Running on GCP |
| Stream processor | ✅ Deployed | |
| API (FastAPI + WebSocket) | ✅ Deployed | GCP Cloud Run |
| Frontend (React + Vite) | ✅ Deployed | Vercel |
| Pick sync (dual-path) | ✅ Done | File → API, cloud-safe |
| Pick tracking (ESPN box scores) | ✅ Working | 30s polling |
| Pick result feedback | ✅ Done | Lunara → Sport-Suite PATCH |
| GCP migration | ✅ Done | AWS (Sport-Suite) + GCP (Lunara) |
| OLAP store | 🔜 Next | Schema in storage/olap/ |
| Lumen live tracker | 🔜 Next | Replaces Palworld bot |
| Hetzner decommission | 🔒 Blocked | Wait 48h GCP stability |

---

## Priority Order

### Phase 1 — Vite Migration (Immediate)
**Blocker for:** Portfolio visibility, production frontend, Vercel deployment
**See:** `PLAN.md` (steps 1–8), `01-VITE-MIGRATION-CHECKLIST.md`
**Effort:** 1–2 days

Finish and validate the React + Vite frontend. All components exist. Needs integration testing and Vercel deploy.

---

### Phase 2 — Sport-Suite API Contract (Pre-migration)
**Blocker for:** GCP migration, cloud-safe pick sync
**See:** `02-SPORT-SUITE-API-CONTRACT.md`
**Effort:** 1 day (Sport-Suite side), 1 day (Lunara side)

Sport-Suite builds `GET /picks/today` and `GET /picks/{date}`. Lunara's `pick_sync_poller.py` swaps file read for HTTP call. Both repos stay independently deployable.

---

### Phase 3 — Wire Sport-Suite DB Pools
**Blocker for:** Nothing (optional enrichment)
**See:** `03-SPORT-SUITE-DB-POOLS.md`
**Effort:** Half day

Three asyncpg pools are initialized in `api/src/db/sport_suite.py` but never queried. Wire them to enrich game data with team pace, injuries, and matchup context already in Sport-Suite DBs.

---

### Phase 4 — Pick Result Feedback Loop
**Blocker for:** Eliminating duplicate `populate_actuals.py` on Sport-Suite
**See:** `04-PICK-FEEDBACK-LOOP.md`
**Effort:** 1 day

When `pick_tracker_poller.py` finalizes a result (`is_hit` determined), POST back to Sport-Suite. Closes the loop — Sport-Suite gets same-day results instead of next-morning batch.

---

### Phase 5 — GCP Migration
**Blocker for:** Hetzner decommission, Lumen live tracker
**See:** `05-GCP-MIGRATION.md`
**Effort:** 2–3 days

Move Lunara from Hetzner to GCP. Target: Cloud Run (API + ingestion), Cloud SQL (PostgreSQL), Memorystore (Redis), Pub/Sub (Kafka replacement candidate or bridge), Vercel (frontend). Lumen bot moves to GCP App Engine or Cloud Run.

---

### Phase 6 — OLAP Store + V4 Features
**Blocker for:** Sport-Suite V4 model training
**See:** `06-OLAP-V4-FEATURES.md`
**Effort:** 3–5 days

Implement ClickHouse or DuckDB in `storage/olap/`. Nightly aggregation job extracts features from `plays` table. Sport-Suite reads new V4 features: `blowout_rate_l5`, `game_script_sensitivity`, `q4_usage_rate`, `true_pace_l5`, `foul_trouble_rate`, `defensive_matchup_score`.

---

### Phase 7 — Lumen Live Tracker
**Blocker for:** Nothing (net-new capability)
**See:** `07-LUMEN-LIVE-TRACKER.md`
**Effort:** 2 days

Repurpose Cephalon Lumen from Palworld to NBA live tracking. Lumen subscribes to Lunara's existing WebSocket (`/ws/{game_id}`) for games with active picks. Sends Discord alerts for stat milestones, game finalization, and approaching-line warnings.

---

### Phase 8 — Hetzner Decommission
**Blocker for:** Cost reduction (~$30/mo savings)
**See:** `08-HETZNER-DECOMMISSION.md`
**Effort:** Half day

After GCP migration is stable (monitored for 2–3 days post-launch), shut down Hetzner. DNS updates, final data export, service teardown.

---

## Dependency Graph

```
Vite Migration
    ↓
Sport-Suite API Contract ──→ Wire DB Pools (parallel, optional)
    ↓
Pick Result Feedback
    ↓
GCP Migration
    ↓
├── OLAP Store + V4 Features
└── Lumen Live Tracker
         ↓
    Hetzner Decommission
```

---

## What "Done" Looks Like

When all phases are complete:

- **Lunara** runs on GCP (Cloud Run + Cloud SQL + Memorystore), frontend on Vercel
- **Pick sync** is API-based, cloud-safe, no shared disk required
- **Results** flow back to Sport-Suite same-day, eliminating `populate_actuals.py`
- **V4 models** are trainable with 6 new game-script features from OLAP
- **Lumen** monitors live games and sends Discord alerts for active picks
- **Hetzner** is off, fully migrated to AWS (Sport-Suite) + GCP (Lunara)
- **Atlas** monitors both Axiom (AWS) and Lumen (GCP) as part of fleet health
