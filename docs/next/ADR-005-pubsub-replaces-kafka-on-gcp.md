# ADR-005: Replace Kafka with Google Pub/Sub on GCP

**Status:** Proposed
**Date:** March 2026
**Context:** GCP migration (Phase 5)

---

## Context

Lunara currently uses Apache Kafka (Zookeeper + Kafka Broker + Schema Registry) running in Docker on Hetzner. This stack is well-suited for the stream processing use case and is working correctly.

When migrating to GCP, we have two options:
1. Run Kafka on GCP (self-managed on Compute Engine, or Confluent Cloud)
2. Replace Kafka with Google Pub/Sub (managed, serverless)

---

## Decision

Replace Kafka with Google Pub/Sub for GCP deployment.

Simultaneously, replace the Java Kafka Streams processor with a lightweight Python Cloud Run service that consumes from Pub/Sub, enriches events, and republishes.

---

## Rationale

### Cost

| Option | Monthly Cost (at ~1M events/day) |
|--------|----------------------------------|
| Kafka on Compute Engine (e2-medium x2) | ~$60-80/mo |
| Confluent Cloud (basic) | ~$70-100/mo |
| Google Pub/Sub | ~$2-5/mo |

At Lunara's data volume (~50K events/day during NBA season), Kafka is over-engineered. Pub/Sub at this scale costs cents.

### Operational Simplicity

Kafka requires:
- Zookeeper coordination
- Schema Registry (for Avro)
- Topic partition management
- Consumer group offset tracking
- Manual rebalancing on failure

Pub/Sub requires:
- Create a topic
- Create a subscription
- Push/pull messages

No operations, no uptime risk, no JVM heap tuning.

### Stream Processor Simplification

The Java Kafka Streams topology (`GameEventTopology.java`) does two things:
1. **TeamEnricher:** Joins play events with team stats via GlobalKTable
2. **GameStateBuilder:** Aggregates score and quarter into game state

Both are simple enough to rewrite in 50 lines of Python. The Kafka Streams DSL added significant complexity for minimal benefit at this scale.

```python
# Replaces GameEventTopology.java entirely
async def enrich_and_aggregate(message: pubsub_v1.ReceivedMessage):
    play = json.loads(message.data)
    team_stats = await db.get_team_stats(play["home_team"], play["away_team"])
    enriched = {
        **play,
        **team_stats,
        "score_diff": play.get("home_score", 0) - play.get("away_score", 0),
    }
    game_state = await update_game_state(play["game_id"], enriched)
    await publisher.publish(ENRICHED_TOPIC, json.dumps(enriched).encode())
    message.ack()
```

### Avro Schema Registry

Avro schemas + Schema Registry were chosen for strict schema evolution guarantees. On GCP, Pub/Sub supports schema enforcement natively via `MessageEncoding.JSON` or `Avro` with schemas registered in Pub/Sub's own schema registry. This replaces Confluent Schema Registry at zero cost.

---

## Trade-offs

### What We Lose

- **Kafka's replay semantics:** Kafka retains messages indefinitely (configurable). Pub/Sub retains for 7 days max. If we need historical replay beyond 7 days, we'd need to dump to Cloud Storage separately.
- **Exactly-once semantics:** Kafka Streams offers transactional processing. Pub/Sub is at-least-once. Handlers must be idempotent (they already are — UPSERT on `game_id + time_elapsed`).
- **Java stream processor tests:** `GameEventTopologyTest.java` would be abandoned. Python equivalent is testable with pytest.

### What We Keep

- Same logical topology (enrich → aggregate → broadcast)
- Same topic naming convention (for documentation consistency)
- Same Avro-style schema discipline (JSON schemas in `schemas/`)
- Same DLQ pattern (Pub/Sub dead letter topics)

---

## Migration Path

1. Create Pub/Sub topics matching current Kafka topics:
   - `raw.plays` → `raw-plays`
   - `enriched.plays` → `enriched-plays`
   - `game.state` → `game-state`
   - DLQ variants

2. Update ingestion producer (`kafka_producer.py` → `pubsub_producer.py`)

3. Replace stream-processor with Python Cloud Run service

4. Update API Kafka consumer (`api/src/kafka/consumer.py` → Pub/Sub subscriber)

5. Archive stream-processor Java code (don't delete — it's the reference impl if we ever need Kafka again)

---

## Reversal Condition

If Lunara scales to >10M events/day (NBA + NFL + MLB simultaneously), or if we need exactly-once processing guarantees for financial accuracy, revisit Confluent Cloud or self-managed Kafka on GKE. At that scale the operational complexity is justified.
