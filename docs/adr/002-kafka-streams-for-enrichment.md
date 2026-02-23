# ADR-002: Kafka Streams for Play Enrichment

## Status

Accepted

## Context

Raw play events from ESPN contain minimal context — a play description, clock time, and scoring flag. To be useful for the frontend feed and prediction engine, plays need enrichment with:

- Team metadata (full name, abbreviation, logo URL) from scoreboard snapshots
- Game context (period, score, venue) from the latest scoreboard state
- Derived fields (play type classification, possession tracking)

This enrichment is inherently **stateful**: it requires joining the play event stream with the latest scoreboard snapshot. The scoreboard is polled every 30 seconds while plays arrive continuously during live games.

## Decision

Use **Kafka Streams** (Java 21) with:
- A `GlobalKTable` backed by `raw.scoreboard` for scoreboard state
- A left join between the `raw.plays` stream and the scoreboard GlobalKTable
- Output to `enriched.plays` (for downstream consumers) and `game.state` (log-compacted KTable)
- Processing guarantee: `EXACTLY_ONCE_V2`

## Alternatives Considered

**Apache Flink** — Full-featured stream processing framework. Rejected because it requires a separate cluster (JobManager + TaskManagers), which is excessive for a single-broker development setup. The operational complexity doesn't justify the capabilities for our current scale.

**Simple Kafka Consumer** — Plain consumer reading from both topics and joining manually. Rejected because it requires manual state management (where to store scoreboard snapshots), manual offset tracking, and no built-in join primitives — essentially reimplementing what Kafka Streams provides.

**ksqlDB** — SQL-based stream processing on Kafka. Rejected because it provides less control over the processing topology, requires its own server process, and complex enrichment logic is harder to express and test in SQL than in Java.

## Consequences

**Positive:**
- Lightweight deployment — runs as a standard JVM application, no separate cluster
- Built-in exactly-once semantics via `EXACTLY_ONCE_V2` processing guarantee
- GlobalKTable automatically replays scoreboard topic on startup for state recovery
- Testable with `TopologyTestDriver` (no running Kafka required for unit tests)

**Negative:**
- Restricted to JVM languages (Java/Kotlin/Scala)
- GlobalKTable replicates full scoreboard state to every instance (acceptable at current scale)
- Kafka Streams state stores use RocksDB, adding disk I/O for local state
