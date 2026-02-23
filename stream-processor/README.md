# Play-by-Play Stream Processor

Kafka Streams service that processes raw play-by-play events from live sports data feeds,
enriches them with team metadata, and maintains aggregated game state.

## Topics

| Topic | Direction | Description |
|-------|-----------|-------------|
| `raw.plays` | Input | Raw play-by-play events from the ingestion layer |
| `enriched.plays` | Output | Events enriched with team names, logos, score differential |
| `game.state` | Output | Aggregated per-game state (latest scores, quarter, clock) |

## Running locally

```bash
# Requires a running Kafka broker (default: localhost:9092)
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092
gradle run
```

## Docker

```bash
docker build -t playbyplay-stream-processor .
docker run -e KAFKA_BOOTSTRAP_SERVERS=kafka:9092 playbyplay-stream-processor
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker addresses |
