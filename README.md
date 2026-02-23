# Play-by-Play

Real-time sports app combining live game data, social interaction, and gamified predictions.

## Architecture

```
                         +-------------+
                         |  ESPN API   |
                         | (free, NBA) |
                         +------+------+
                                |
                          polls every 30s
                                |
                    +-----------v-----------+
                    |     ingestion         |
                    |  (Python 3.12)        |
                    |  scoreboard + pbp     |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |       Kafka           |
                    |  raw.scoreboard       |
                    |  raw.plays            |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |  stream-processor     |
                    |  (Kafka Streams/Java) |
                    |  enrich + aggregate   |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |       Kafka           |
                    |  enriched.plays       |
                    |  game.state           |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |        api            |
                    |  (FastAPI + WS)       |
                    +---+-------+-----------+
                        |       |
              +---------+       +---------+
              |                           |
    +---------v---------+     +-----------v-------+
    |    frontend       |     |   PostgreSQL 16   |
    |  (Next.js 15)     |     |   Redis 7         |
    +-------------------+     +-------------------+
```

## Quick Start

```bash
# 1. Copy environment config
cp .env.example .env

# 2. Start infrastructure
make infra

# 3. Run database migrations
make db-migrate

# 4. Create Kafka topics
make topics

# 5. Start all services
make up

# Or run frontend/API locally for development:
make dev-api        # http://localhost:8000/docs
make dev-frontend   # http://localhost:3000
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Ingestion** | Python 3.12, httpx | ESPN API polling |
| **Streaming** | Kafka Streams (Java 21) | Event enrichment + aggregation |
| **API** | FastAPI, SQLAlchemy async | REST + WebSocket serving |
| **Frontend** | Next.js 15, React 19, Tailwind v4 | Mobile-first dark UI |
| **Database** | PostgreSQL 16 | Users, games, plays, predictions |
| **Cache** | Redis 7 | Live game state |
| **Archive** | MinIO | S3-compatible event archive |
| **Monitoring** | Prometheus + Grafana | Metrics + dashboards |

## Services

| Service | Port | Description |
|---------|------|-------------|
| Kafka | 9092 | Event streaming |
| Schema Registry | 8081 | Schema management |
| PostgreSQL | 5432 | OLTP database |
| Redis | 6379 | Live state cache |
| MinIO | 9000/9001 | Object storage |
| API | 8000 | FastAPI + WebSocket |
| Prometheus | 9090 | Metrics |
| Grafana | 3001 | Dashboards |

## Project Structure

```
play-by-play/
├── ingestion/          # Python — ESPN data collectors
├── stream-processor/   # Java — Kafka Streams topology
├── api/                # Python — FastAPI REST + WebSocket
├── frontend/           # Next.js + TypeScript + Tailwind
├── storage/            # PostgreSQL migrations
├── kafka/              # Topic creation script
├── monitoring/         # Prometheus + Grafana configs
├── docker-compose.yml  # All 12 services
├── Makefile            # Dev workflow commands
└── .env.example        # Environment template
```

## Development

```bash
make help           # Show all available commands
make test           # Run all tests
make lint           # Run all linters
make build          # Build all Docker images
make deploy         # Deploy to Hetzner server
```

## Status

**Phase:** Architecture scaffold (skeleton files, no business logic)

**Next steps:**
1. Implement ESPN scoreboard collector
2. Implement play-by-play collector
3. Wire Kafka Streams topology
4. Connect FastAPI to PostgreSQL/Redis
5. Build out frontend components with real data
6. Add WebSocket live updates
