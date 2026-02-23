"""Kafka producer with Avro serialization via Confluent Schema Registry."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import structlog
from confluent_kafka import Producer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
from confluent_kafka.serialization import MessageField, SerializationContext

from src.config import Settings

logger = structlog.get_logger(__name__)

# Map topic → .avsc schema file name
_SCHEMA_FILES = {
    "raw.scoreboard": "scoreboard_event.avsc",
    "raw.plays": "play_event.avsc",
}

# Resolve schema directory (project root / schemas / avro)
_SCHEMA_DIR = Path(__file__).resolve().parents[3] / "schemas" / "avro"


def _datetime_to_millis(dt: datetime | str | int | float | None) -> int | None:
    """Convert a datetime (or ISO string) to epoch milliseconds."""
    if dt is None:
        return None
    if isinstance(dt, int | float):
        return int(dt * 1000) if dt < 1e12 else int(dt)
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
    return int(dt.timestamp() * 1000)


def _to_dict(data: dict, ctx: SerializationContext) -> dict:
    """Convert a Pydantic-dumped dict to Avro-compatible dict.

    Handles datetime → epoch-millis conversion for timestamp fields.
    """
    result = dict(data)

    # Convert known timestamp fields
    for key in ("start_time", "polled_at", "wallclock", "enriched_at", "updated_at"):
        if key in result:
            result[key] = _datetime_to_millis(result[key])

    return result


def _delivery_callback(err, msg) -> None:
    """Log Kafka delivery results."""
    if err is not None:
        logger.error("kafka.delivery_failed", error=str(err), topic=msg.topic())
    else:
        logger.debug(
            "kafka.delivered",
            topic=msg.topic(),
            partition=msg.partition(),
            offset=msg.offset(),
        )


class KafkaProducer:
    """Avro-serializing Kafka producer.

    Parameters:
        settings: Application configuration (provides ``kafka_bootstrap_servers``
                  and ``schema_registry_url``).
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._producer = Producer({"bootstrap.servers": settings.kafka_bootstrap_servers})

        registry_client = SchemaRegistryClient({"url": settings.schema_registry_url})

        self._serializers: dict[str, AvroSerializer] = {}
        for topic, schema_file in _SCHEMA_FILES.items():
            schema_path = _SCHEMA_DIR / schema_file
            schema_str = schema_path.read_text()
            self._serializers[topic] = AvroSerializer(
                registry_client,
                schema_str,
                to_dict=_to_dict,
            )

    def produce(self, topic: str, key: str, value: dict) -> None:
        """Serialize *value* as Avro and produce to *topic*.

        Falls back to JSON serialization if no Avro schema is registered
        for the topic.

        Args:
            topic: Kafka topic name.
            key: Message key (used for partitioning).
            value: Dictionary payload.
        """
        serializer = self._serializers.get(topic)
        if serializer:
            ctx = SerializationContext(topic, MessageField.VALUE)
            encoded = serializer(value, ctx)
        else:
            encoded = json.dumps(value, default=str).encode("utf-8")

        self._producer.produce(
            topic=topic,
            key=key.encode("utf-8"),
            value=encoded,
            callback=_delivery_callback,
        )
        self._producer.poll(0)

    def flush(self, timeout: float = 5.0) -> None:
        """Block until all buffered messages are delivered."""
        remaining = self._producer.flush(timeout)
        if remaining > 0:
            logger.warning("kafka.flush_incomplete", remaining=remaining)
