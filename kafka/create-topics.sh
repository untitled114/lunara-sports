#!/bin/bash
set -e

BOOTSTRAP=${KAFKA_BOOTSTRAP_SERVERS:-kafka:9092}

echo "Waiting for Kafka to be ready..."
cub kafka-ready -b "$BOOTSTRAP" 1 60

echo "Creating topics..."

kafka-topics --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
  --topic raw.scoreboard \
  --partitions 6 \
  --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
  --topic raw.plays \
  --partitions 12 \
  --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
  --topic enriched.plays \
  --partitions 12 \
  --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
  --topic game.state \
  --partitions 6 \
  --replication-factor 1 \
  --config retention.ms=604800000 \
  --config cleanup.policy=compact

kafka-topics --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
  --topic user.predictions \
  --partitions 6 \
  --replication-factor 1 \
  --config retention.ms=2592000000

kafka-topics --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
  --topic prediction.results \
  --partitions 6 \
  --replication-factor 1 \
  --config retention.ms=2592000000

kafka-topics --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
  --topic user.reactions \
  --partitions 6 \
  --replication-factor 1 \
  --config retention.ms=259200000

echo "Topics created:"
kafka-topics --bootstrap-server "$BOOTSTRAP" --list
