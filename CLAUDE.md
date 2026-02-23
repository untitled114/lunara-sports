# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Play-by-Play** — A mobile-first sports app combining live game data, social interaction, and gamified engagement. Real-time play-by-play feed meets social sports platform.

**Status:** Architecture scaffold complete. Skeleton files, Docker Compose, configs, READMEs in place. No business logic yet.

**Deployment:** Hetzner VPS (same server as Sport-suite)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Data source | ESPN free API (no key required) |
| Ingestion | Python 3.12 + httpx + confluent-kafka |
| Streaming | Kafka Streams (Java 21) |
| API | FastAPI + SQLAlchemy async + Redis |
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind v4 |
| Database | PostgreSQL 16 (OLTP) + Redis 7 (cache) |
| Archive | MinIO (S3-compatible) |
| Monitoring | Prometheus + Grafana |

## Build & Run Commands

```bash
# Start infrastructure (Kafka, PG, Redis, MinIO, monitoring)
make infra

# Start everything (infrastructure + app services)
make up

# Stop all services
make down

# Tail logs
make logs
```

### Database

```bash
make db-migrate    # Run SQL migrations
make db-reset      # Drop + recreate + migrate
```

### Kafka

```bash
make topics        # Create all topics
make topics-list   # List existing topics
```

### Local Development (outside Docker)

```bash
make dev-api        # FastAPI at localhost:8000 (uvicorn --reload)
make dev-frontend   # Next.js at localhost:3000
make dev-ingestion  # Run scoreboard collector locally
```

### Testing & Linting

```bash
make test           # Run all tests (Python, Java, TypeScript)
make lint           # Run all linters (ruff, checkstyle, eslint)
make build          # Build all Docker images
```

### Deployment

```bash
make deploy         # rsync to Hetzner server + docker compose up
make deploy-logs    # Tail production logs
```

Requires `DEPLOY_HOST` env var (e.g., `sportsuite@5.161.239.229`).

## Architecture

```
                    ESPN API
                       |
                [ingestion]  (Python, polls every 30s)
                       |
              raw.scoreboard / raw.plays
                       |
             [stream-processor]  (Kafka Streams, Java)
                       |
           enriched.plays / game.state
                       |
                    [api]  (FastAPI + WebSocket)
                    /    \
              [frontend]  [Redis cache]
              (Next.js)      |
                         [PostgreSQL]
```

## Directory Structure

```
play-by-play/
├── ingestion/          # Python — ESPN data collectors + Kafka producers
├── stream-processor/   # Java — Kafka Streams topology
├── api/                # Python — FastAPI REST + WebSocket
├── frontend/           # Next.js + TypeScript + Tailwind
├── storage/            # PostgreSQL migrations + OLAP schema docs
├── kafka/              # Topic creation script
├── monitoring/         # Prometheus + Grafana configs
├── docker-compose.yml  # 12 services
├── Makefile            # Dev workflow commands
└── .env.example        # Environment variable template
```

## Key Services (Docker Compose)

| Service | Port | Purpose |
|---------|------|---------|
| kafka | 9092, 29092 | Event streaming |
| schema-registry | 8081 | Schema management |
| postgres | 5432 | OLTP database |
| redis | 6379 | Live state cache |
| minio | 9000, 9001 | S3-compatible archive |
| api | 8000 | FastAPI + WebSocket |
| prometheus | 9090 | Metrics collection |
| grafana | 3001 | Dashboards (admin/admin) |

## Kafka Topics

| Topic | Partitions | Purpose |
|-------|------------|---------|
| raw.scoreboard | 6 | ESPN scoreboard snapshots |
| raw.plays | 12 | ESPN play-by-play events |
| enriched.plays | 12 | Enriched events (team info, context) |
| game.state | 6 | Current game state (compacted KTable) |
| user.predictions | 6 | User prediction submissions |
| prediction.results | 6 | Scored prediction outcomes |
| user.reactions | 6 | Emoji reactions on plays |

## PostgreSQL Tables

`users`, `teams`, `games`, `plays`, `predictions`, `leaderboard`, `reactions`, `comments`

Migrations in `storage/postgres/migrations/` (numbered 001-005).

## Design Direction

Inspiration from Action Network mobile app (screenshots in `inspo/`):
- Dark theme (#0a0a0a) with green accents (#22c55e)
- Tab navigation per game: Feed | Game | Teams
- Play-by-play feed with emoji reactions and comments
- Box score, score differential chart, leaderboard

## Core Features

- **Live sports feed:** Real-time play-by-play events, scores, and stats (NBA first)
- **Social layer:** User reactions (emoji), comments, and predictions on live plays
- **Prediction game:** Users predict outcomes; leaderboard tracks accuracy
- **Multi-sport:** NBA priority, then NFL/MLB/NHL/WNBA
