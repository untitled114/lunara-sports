# Lunara Sports — Architecture

**Status:** Production (~85% complete)
**Last Updated:** March 2026
**Repo:** standalone at `/home/untitled/play-by-play`
**Live:** `lunara-app.com` | API: `api.lunara-app.com` | Grafana: `grafana.lunara-app.com`

---

## Overview

Lunara Sports is a real-time NBA sports data platform combining live play-by-play feeds,
social interactions, and gamified prediction tracking. It is production-ready and deployed
on Hetzner VPS (`5.161.239.229`, `/opt/play-by-play/`).

The platform integrates with Sport-Suite (separate repo) to display ML-generated picks and
track their live outcomes during games.

---

## Component Map

```
ESPN API (free, no key)
    │
    ▼
┌──────────────────────────────────────────┐
│  INGESTION (Python 3.12)                 │
│  ScoreboardCollector  PlayByPlayCollector│
│  Circuit breaker + retry (tenacity)      │
│  Avro → Schema Registry                  │
└────────────────┬─────────────────────────┘
                 │
    ┌────────────▼─────────────────────────┐
    │  KAFKA (Confluent 7.6, 10 topics)    │
    │  raw.scoreboard   raw.plays          │
    │  enriched.plays   game.state         │
    │  user.predictions prediction.results │
    │  user.reactions   + 3 DLQ topics     │
    └────────────┬─────────────────────────┘
                 │
    ┌────────────▼─────────────────────────┐
    │  STREAM PROCESSOR (Java 21)          │
    │  Kafka Streams, Exactly-Once v2      │
    │  GlobalKTable: raw.scoreboard        │
    │  KStream: raw.plays                  │
    │  TeamEnricher → enriched.plays       │
    │  GameStateBuilder → game.state       │
    └────────────┬─────────────────────────┘
                 │
    ┌────────────▼─────────────────────────┐
    │  API (FastAPI + asyncio)             │
    │  Kafka consumer → PostgreSQL         │
    │  5 background pollers (see below)    │
    │  13 routers, JWT auth                │
    │  WebSocket /ws/{game_id}             │
    │  Redis cache                         │
    │  Sport-Suite read-only pools         │
    └──────┬──────────────┬────────────────┘
           │              │
    ┌──────▼──────┐  ┌────▼────────┐
    │ PostgreSQL  │  │  Redis 7    │
    │    (9 tbl)  │  │  (cache)    │
    └─────────────┘  └─────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │  FRONTEND (React + Vite)            │
    │  Deployed on Vercel                 │
    │  WebSocket feeds, pick cards,       │
    │  live box scores, leaderboard       │
    └─────────────────────────────────────┘

    ┌─────────────────────────────────────┐
    │  MONITORING                         │
    │  Prometheus (9090) + Grafana (3001) │
    │  5 exporters: API, Kafka, PG,       │
    │              Redis, Prometheus      │
    └─────────────────────────────────────┘
```

---

## Components

### Ingestion (Python 3.12) — Complete

- `ScoreboardCollector` — polls ESPN `/scoreboard` every 30s
- `PlayByPlayCollector` — polls ESPN `/summary?event={id}` every 1-3s; per-game high-water mark for dedup
- `KafkaProducer` — Avro serialization via Confluent Schema Registry
- `CircuitBreaker` — 5 failures → open, 60s cooldown, 2 successes → close
- Retry: tenacity exponential backoff (1s–30s, max 5 attempts); 4xx not retried

**Key files:**
```
ingestion/src/__main__.py              Main async loop
ingestion/src/collectors/scoreboard.py
ingestion/src/collectors/playbyplay.py
ingestion/src/producers/kafka_producer.py
ingestion/src/resilience/circuit_breaker.py
ingestion/src/resilience/retry.py
```

---

### Kafka Topics (10 total)

| Topic | Partitions | Retention | Cleanup |
|-------|-----------|-----------|---------|
| `raw.scoreboard` | 6 | 7d | delete |
| `raw.plays` | 12 | 7d | delete |
| `enriched.plays` | 12 | 7d | delete |
| `game.state` | 6 | 7d | compact |
| `user.predictions` | 6 | 30d | delete |
| `prediction.results` | 6 | 30d | delete |
| `user.reactions` | 6 | 3d | delete |
| `dlq.raw.scoreboard` | 1 | 30d | delete |
| `dlq.raw.plays` | 1 | 30d | delete |
| `dlq.enriched.plays` | 1 | 30d | delete |

---

### Avro Schemas (4 registered)

| Schema | Fields | Purpose |
|--------|--------|---------|
| `PlayEvent` | 15 | Raw plays from ESPN |
| `ScoreboardEvent` | 13 | Raw scoreboard snapshots |
| `EnrichedEvent` | 20 (PlayEvent + team metadata) | Post-enrichment plays |
| `GameState` | 12 | Per-game aggregated state (compacted KTable) |

All registered in Confluent Schema Registry with forward/backward compatibility.

---

### Stream Processor (Java 21, Kafka Streams) — Complete

**Topology:**
```
raw.scoreboard ──GlobalKTable──┐
                                ├──► TeamEnricher ──► enriched.plays
raw.plays ──────KStream────────┘
                                └──► GameStateBuilder ──► game.state
```

- **TeamEnricher:** left join; adds team names, venue, score differential
- **GameStateBuilder:** aggregates per-game (score, quarter, clock, play count) → compacted KTable
- **Exactly-Once semantics v2**, 100ms commit interval for live sports latency
- **DLQ:** deserialization failures routed to `dlq.*` topics

**Key files:**
```
stream-processor/src/main/java/com/playbyplay/
  App.java
  topology/GameEventTopology.java
  enrichment/TeamEnricher.java
  enrichment/GameStateBuilder.java
  serdes/JsonSerde.java
  serdes/DlqDeserializationHandler.java
```

---

### API (FastAPI) — Complete

**13 routers:** games, plays, picks, predictions, leaderboard, reactions, comments,
auth, boxscore, teams, players, stats, standings

**5 background pollers (asyncio tasks):**

| Poller | Interval | Purpose |
|--------|---------|---------|
| `run_play_poller` | 2s | Polls new plays → broadcast to WebSocket |
| `run_scoreboard_poller` | 10s | Keeps game scores current from ESPN |
| `run_pick_sync_poller` | 5m | Syncs Sport-Suite predictions from JSON file |
| `run_pick_tracker_poller` | 30s | Updates actual_value + is_hit for pending picks |
| `KafkaConsumerLoop` | async | Reads Kafka → upserts games/plays to DB |

**WebSocket endpoints:**
- `GET /ws/{game_id}` — live play stream + history (last 500 plays on connect)
- `GET /ws/scoreboard` — live scoreboard updates

**Key files:**
```
api/src/main.py
api/src/routers/           13 router files
api/src/services/          20+ service modules
api/src/kafka/consumer.py
api/src/kafka/dead_letter.py
api/src/ws/live_feed.py    ConnectionManager
api/src/ws/play_poller.py
api/src/db/models.py       9 ORM models
api/src/db/sport_suite.py  Optional Sport-Suite pools
```

---

### Database (PostgreSQL 16) — Complete

9 migrations, 9 tables:

| Table | Purpose | Key Constraints |
|-------|---------|----------------|
| `users` | User profiles, membership tier | UNIQUE(username), UNIQUE(email) |
| `teams` | NBA teams (seeded, 30 teams) | abbrev PK |
| `games` | Games from ESPN | UNIQUE(id), FK teams, INDEX(start_time, status) |
| `plays` | Play-by-play events | UNIQUE(game_id, sequence_number) |
| `predictions` | User game predictions | UNIQUE(user_id, game_id, prediction_type) |
| `reactions` | Emoji reactions on plays | UNIQUE(user_id, play_id) |
| `comments` | Comments on games/plays | FK games + optional plays |
| `model_picks` | Sport-Suite ML picks | UNIQUE(game_id, player_name, market, model_version) |
| `leaderboard` | User rankings by season | PK(user_id, season) |

**model_picks columns (key fields):**
```
game_id, game_date, player_name, team, opponent_team, is_home
market, line, prediction (OVER/UNDER), p_over, edge, tier
model_version (xl/v3), reasoning
actual_value, is_hit  ← updated by pick_tracker_poller
```

---

### Frontend (React + Vite) — 70% Complete

**Deployed:** Vercel (via `npx vercel --prod --yes` from project root)

**Implemented components:**
- `LiveFeed` — WebSocket play-by-play stream
- `PickCard` — Sport-Suite pick display with free/premium gating
- `GameCard` — Game summary with team logos, scores, status
- `BoxScore` — Player stats table (points, rebounds, assists, minutes, FG%)
- `Leaderboard` — User rankings
- `BetTracker` — Live pick tracking
- `ReactionOverlay` — Emoji reactions on plays
- `ScoreTicker` — Scrolling live scores
- `MomentumMeter` — Stub (planned: score differential chart)
- 12 Lunara UI components (Badge, Alert, Table, Tabs, Skeleton, etc.)

**Tech:** React 19, Tailwind v4, React Router, dark theme (#0a0a0a, #22c55e accent)

**Pending:** Vite migration from Next.js (PLAN.md describes this; ~3-5 days)

---

### Monitoring — Complete

- **Prometheus** (port 9090): scrapes API, Kafka, PostgreSQL, Redis, self
- **Grafana** (port 3001): pre-provisioned `overview.json` dashboard
- **Custom metrics:** `kafka_messages_consumed_total`, `dlq_messages_total`,
  `websocket_connections_active`, `espn_polls_total`
- **Structured logging:** `structlog` throughout with contextual fields

---

## Data Flows

### Flow 1: Live Play Ingestion

```
ESPN /summary?event={id}   (polls every 1-3s)
  → PlayByPlayCollector   (high-water mark dedup)
  → Avro serialize → raw.plays
  → Kafka Streams TeamEnricher (left join scoreboard)
  → enriched.plays
  → KafkaConsumerLoop
  → INSERT plays (ON CONFLICT game_id,sequence_number DO NOTHING)
  → PlayPoller (2s) → WebSocket broadcast
  → Client /ws/{game_id}
```

### Flow 2: Sport-Suite Pick Sync

```
Sport-Suite generates xl_picks_YYYY-MM-DD.json
  → PickSyncPoller (5m interval, checks for new file)
  → Parse + team mapping (Sport-Suite abbrev → standard NBA)
  → Match to games by (date, home_team, away_team)
  → UPSERT model_picks ON CONFLICT DO UPDATE
```

### Flow 3: Live Pick Tracking

```
PickTrackerPoller (30s)
  → Query model_picks WHERE game_date=today AND is_hit IS NULL
  → Fetch ESPN box score per game
  → Match player name → extract stat (MARKET_STAT_MAP)
  → UPDATE actual_value
  → If game final: compute is_hit, UPDATE
  → WebSocket broadcast pick_update to /ws/{game_id}
  → Frontend PickCard updates live
```

---

## Deployment

**Backend:** rsync to `sportsuite@5.161.239.229` at `/opt/play-by-play/`
**Frontend:** `npx vercel --prod --yes` from project root

**Services on server:**
- `uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 2` (palworld user)
- nginx proxying `api.lunara-app.com` → 8000, `grafana.lunara-app.com` → 3001

**Docker Compose:** 12 services (api, ingestion, stream-processor, kafka, zookeeper,
schema-registry, redis, postgres, prometheus, grafana, kafka-exporter, pg-exporter)

---

## Current Gaps

| Gap | Priority | Notes |
|-----|---------|-------|
| Frontend Vite migration | High | PLAN.md ready; Next.js → SPA; ~3-5 days |
| Sport-Suite DB pools unused | Medium | 3 asyncpg pools initialized but never queried |
| OLAP store empty | Medium | `storage/olap/` planned but not implemented |
| Password reset / email verify | Low | JWT auth works; no recovery flow |
| Frontend tests | Low | Components untested; backend 70%+ covered |

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Source | ESPN public API | free, no key |
| Ingestion | Python, httpx, confluent-kafka, tenacity | 3.12 |
| Message bus | Apache Kafka (Confluent) | 7.6.0 |
| Stream processing | Kafka Streams | Java 21 |
| Schema registry | Confluent Schema Registry | 7.6.0 |
| API | FastAPI, uvicorn, SQLAlchemy async | latest |
| Database | PostgreSQL | 16 |
| Cache | Redis | 7 |
| Frontend | React, Vite, Tailwind v4 | 19 |
| Monitoring | Prometheus + Grafana | latest |
| CI/CD | GitHub Actions | 3 jobs |
| Hosting | Hetzner VPS (→ GCP migration planned) | — |
