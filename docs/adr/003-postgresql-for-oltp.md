# ADR-003: PostgreSQL for OLTP Storage

## Status

Accepted

## Context

The application needs persistent storage for:
- **Games and plays** — Relational data with foreign keys (games → plays, plays → reactions)
- **Users and predictions** — Transactional integrity for the prediction game and leaderboard
- **Box scores and stats** — Complex joins and aggregations for game summary views

The API layer uses FastAPI with async request handling, so the database driver must support async I/O to avoid blocking the event loop.

## Decision

Use **PostgreSQL 16** with:
- **asyncpg** driver via SQLAlchemy async for non-blocking queries
- **Numbered SQL migrations** in `storage/postgres/migrations/` (001-005)
- Schema: `users`, `teams`, `games`, `plays`, `predictions`, `leaderboard`, `reactions`, `comments`

## Alternatives Considered

**MongoDB** — Document database with flexible schema. Rejected because our data is inherently relational (plays belong to games, predictions reference users and plays). Lack of foreign key enforcement would push data integrity concerns into application code.

**TimescaleDB** — PostgreSQL extension for time-series data. Rejected as premature — while play events are time-ordered, our primary access patterns are relational (box scores, user predictions, leaderboards), not time-range scans. Can be added later as a PostgreSQL extension if time-series needs emerge.

**Event Store (pure event sourcing)** — Store only events and derive all state. Rejected because read-heavy patterns (box scores, leaderboards, user profiles) would require building and maintaining materialized views, adding complexity without clear benefit at current scale.

## Consequences

**Positive:**
- Strong consistency and referential integrity via foreign keys and transactions
- Mature ecosystem — pg_stat monitoring, pg_dump backups, extensive tooling
- asyncpg is one of the fastest PostgreSQL drivers available, benchmarked at ~3x psycopg2
- SQL migrations provide explicit, version-controlled schema evolution

**Negative:**
- Requires explicit schema management (migrations must be run on deploy)
- Vertical scaling limits compared to horizontally-scalable alternatives
- Schema changes on large tables may require careful migration planning
