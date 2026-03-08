# Phase 5: GCP Migration

**Goal:** Move Lunara from Hetzner VPS to Google Cloud Platform.
**Trigger:** After Sport-Suite API contract is built and tested (Phase 2) — no more shared disk dependency.
**Current server:** Hetzner at `5.161.239.229`, user `palworld`

---

## Target Architecture

```
GCP Project: lunara-sports
├── Cloud Run
│   ├── lunara-api          (FastAPI, port 8000)
│   └── lunara-ingestion    (ESPN poller → Kafka/Pub-Sub)
│
├── Google Kubernetes Engine (optional — if Kafka Streams needed)
│   └── stream-processor    (Java Kafka Streams)
│
├── Cloud SQL (PostgreSQL 16)
│   └── lunara              (play-by-play DB, replaces Docker PG)
│
├── Memorystore (Redis 7)
│   └── lunara-cache        (replaces Docker Redis)
│
├── Pub/Sub (Kafka replacement or bridge)
│   ├── topic: raw.plays
│   ├── topic: enriched.plays
│   └── topic: game.state
│
├── Cloud Run (Lumen bot)
│   └── cephalon-lumen      (NBA live tracker, replaces Palworld bot)
│
└── Cloud Storage
    └── lunara-assets       (static files, replay data)

Frontend: Vercel (CDN, React + Vite)
Domain: lunara-app.com → Vercel (frontend) + Cloud Run (API)
```

---

## Component-by-Component Migration

### 1. PostgreSQL → Cloud SQL

```bash
# Export from Hetzner
pg_dump -h localhost -U lunara_user lunara_db | gzip > lunara_backup.sql.gz

# Import to Cloud SQL
gcloud sql instances create lunara-postgres \
  --database-version=POSTGRES_16 \
  --tier=db-g1-small \
  --region=us-central1

gcloud sql databases create lunara_db --instance=lunara-postgres
gzip -d lunara_backup.sql.gz | gcloud sql connect lunara-postgres < lunara_backup.sql
```

**Config change:** `DATABASE_URL` env var → Cloud SQL connection string via Unix socket:
```
DATABASE_URL=postgresql+asyncpg:///lunara_db?host=/cloudsql/project:region:instance
```

### 2. Redis → Memorystore

```bash
gcloud redis instances create lunara-cache \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0
```

**Config change:** `REDIS_URL` → Memorystore IP (accessible from Cloud Run via VPC connector).

### 3. Kafka → Google Pub/Sub

Kafka (Zookeeper + Broker + Schema Registry) adds ~$80/mo in compute on GCP. Pub/Sub is a managed drop-in at ~$1-5/mo at this scale.

**Option A: Kafka Adapter** — Keep Kafka Streams topology, bridge input/output topics to Pub/Sub using Kafka Connector. Preserves Java stream processor unchanged.

**Option B: Replace entirely with Pub/Sub** — Rewrite stream processor as a Python Cloud Run service (enrichment is simple join + aggregation). Eliminates Java service entirely.

**Recommendation: Option B** — The topology (TeamEnricher + GameStateBuilder) is ~200 lines of Java doing team joins and score aggregation. A Python equivalent is 50 lines. No Zookeeper, no Schema Registry overhead.

```python
# Pub/Sub subscriber replacing stream-processor
async def enrich_play(message: PubSubMessage):
    play = json.loads(message.data)
    team_stats = await get_team_stats(play["home_team"], play["away_team"])
    enriched = {**play, **team_stats, "score_diff": play["home_score"] - play["away_score"]}
    await publish("enriched.plays", enriched)
    message.ack()
```

### 4. API → Cloud Run

```bash
# Build and push container
docker build -t gcr.io/lunara-sports/lunara-api:latest api/
docker push gcr.io/lunara-sports/lunara-api:latest

# Deploy to Cloud Run
gcloud run deploy lunara-api \
  --image gcr.io/lunara-sports/lunara-api:latest \
  --platform managed \
  --region us-central1 \
  --port 8000 \
  --memory 512Mi \
  --min-instances 1 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=...,REDIS_URL=...,SPORT_SUITE_API_URL=..."
```

**Important:** Cloud Run scales to zero by default. Set `--min-instances 1` so WebSocket connections don't drop during scale events. The play feed and pick tracker need persistent connections.

### 5. Ingestion → Cloud Run

```bash
gcloud run deploy lunara-ingestion \
  --image gcr.io/lunara-sports/lunara-ingestion:latest \
  --no-allow-unauthenticated \
  --min-instances 1 \
  --memory 256Mi
```

Ingestion is a long-running async loop (no HTTP server). Use Cloud Run Jobs for scheduled backfill; use Cloud Run services for the continuous ESPN poller.

### 6. Frontend → Vercel

```bash
# From project root (not frontend/) — Vercel is configured at repo root
npx vercel --prod --yes

# Set env vars in Vercel dashboard:
VITE_API_URL=https://lunara-api-xxxx.run.app
VITE_WS_URL=wss://lunara-api-xxxx.run.app
```

Map `lunara-app.com` → Vercel deployment.
Map `api.lunara-app.com` → Cloud Run API.

---

## Nginx Config Update (DNS Transition)

Current Hetzner nginx proxies:
- `lunara-app.com` → `localhost:3000` (Next.js/Vite frontend)
- `api.lunara-app.com` → `localhost:8000` (FastAPI)

After migration:
1. Update DNS A record for `api.lunara-app.com` → Cloud Run URL
2. Update DNS for `lunara-app.com` → Vercel IP
3. Update Vercel `VITE_API_URL` to `https://api.lunara-app.com`
4. Hetzner Lunara services can be stopped

---

## Environment Variables (GCP)

```bash
# Store in GCP Secret Manager, inject into Cloud Run
DATABASE_URL=postgresql+asyncpg:///lunara_db?host=/cloudsql/...
REDIS_URL=redis://10.x.x.x:6379
SPORT_SUITE_API_URL=https://sport-suite-api.internal   # or AWS internal URL
SPORT_SUITE_API_KEY=lunara-k8x2-vf7q-3mn9
GOOGLE_CLOUD_PROJECT=lunara-sports
PUBSUB_TOPIC_ENRICHED=enriched.plays
```

---

## Estimated Cost (GCP)

| Service | Tier | Monthly |
|---------|------|---------|
| Cloud Run (API + ingestion) | min 1 instance each | ~$20 |
| Cloud SQL (db-g1-small) | PostgreSQL 16, 10GB | ~$10 |
| Memorystore (1GB Redis) | | ~$15 |
| Pub/Sub | ~1M messages/day | ~$3 |
| Cloud Run (Lumen bot) | min 1 instance | ~$5 |
| Total | | **~$53/mo** |

Current Hetzner split:
- Lunara share of Hetzner VPS: ~$15-20/mo
- GCP adds ~$33/mo but gains managed redundancy, auto-scaling, and separates from Sport-Suite

---

## Migration Checklist

- [ ] Phase 2 complete (API-based pick sync verified working)
- [ ] Cloud SQL instance created, Lunara DB imported
- [ ] Memorystore Redis created
- [ ] Pub/Sub topics created (or Kafka Adapter configured)
- [ ] Docker images built and pushed to GCR
- [ ] Cloud Run services deployed (API + ingestion)
- [ ] Lumen bot deployed to Cloud Run (see `07-LUMEN-LIVE-TRACKER.md`)
- [ ] Environment variables set in Secret Manager
- [ ] `api.lunara-app.com` DNS updated → Cloud Run
- [ ] Frontend deployed to Vercel with correct `VITE_API_URL`
- [ ] `lunara-app.com` DNS updated → Vercel
- [ ] WebSocket connections tested from Vercel → Cloud Run
- [ ] Pick sync tested (Sport-Suite API → Lunara model_picks)
- [ ] Monitored for 48h with no issues
- [ ] Hetzner Lunara services stopped (keep server alive for Airflow until Hetzner decommission)
