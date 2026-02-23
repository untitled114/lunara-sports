# ADR-001: Event Streaming with Apache Kafka

## Status

Accepted

## Context

Play-by-Play requires a real-time event pipeline for live NBA games. Play-by-play events must flow from ESPN API polling through enrichment to API/WebSocket consumers with sub-second latency. The system needs:

- Durable event log for replay and recovery
- Multiple consumers reading the same stream independently
- Topic compaction for maintaining current game state
- Partitioned streams for parallel processing by game ID

## Decision

Use **Apache Kafka** (Confluent Platform 7.6) as the central event streaming backbone.

Topic design:
- `raw.scoreboard` (6 partitions) — ESPN scoreboard snapshots
- `raw.plays` (12 partitions) — ESPN play-by-play events, keyed by game ID
- `enriched.plays` (12 partitions) — Plays enriched with team metadata
- `game.state` (6 partitions, compacted) — Current game state as a KTable

## Alternatives Considered

**RabbitMQ** — Message broker with strong routing primitives. Rejected because it lacks log-based replay (messages are consumed and deleted), no native stream processing joins, and no topic compaction for materialized state.

**Redis Streams** — Lightweight append-only log built into Redis. Rejected because the ecosystem lacks stream processing primitives (joins, windowing), consumer group semantics are less mature, and there's no schema registry integration.

**AWS Kinesis** — Managed streaming service. Rejected due to vendor lock-in, cost scaling concerns for a portfolio project, and inability to run locally for development.

## Consequences

**Positive:**
- Log-based architecture enables replay from any offset for debugging and recovery
- Topic compaction on `game.state` provides a lightweight materialized view
- Partitioning by game ID ensures ordered processing per game
- Confluent Platform provides Schema Registry for Avro/JSON Schema evolution

**Negative:**
- Requires Zookeeper (operational overhead, though KRaft mode is available in newer versions)
- Higher memory footprint than alternatives (~1.5GB for Kafka + Zookeeper)
- Local development requires Docker Compose infrastructure
