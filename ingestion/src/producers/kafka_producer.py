"""Thin wrapper around confluent_kafka.Producer with JSON serialization."""

from __future__ import annotations

import json

import structlog
from confluent_kafka import Producer

from src.config import Settings

logger = structlog.get_logger(__name__)


def _delivery_callback(err, msg) -> None:
    """Log Kafka delivery results.

    Called once per produced message when the broker acknowledges (or rejects)
    the write.

    Args:
        err: Delivery error, or ``None`` on success.
        msg: The produced Message object.
    """
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
    """JSON-serializing Kafka producer.

    Parameters:
        settings: Application configuration (provides ``kafka_bootstrap_servers``).
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._producer = Producer(
            {"bootstrap.servers": settings.kafka_bootstrap_servers}
        )

    def produce(self, topic: str, key: str, value: dict) -> None:
        """Serialize *value* as JSON and produce to *topic*.

        Args:
            topic: Kafka topic name.
            key: Message key (used for partitioning).
            value: Dictionary payload; will be JSON-encoded to bytes.
        """
        self._producer.produce(
            topic=topic,
            key=key.encode("utf-8"),
            value=json.dumps(value, default=str).encode("utf-8"),
            callback=_delivery_callback,
        )
        self._producer.poll(0)

    def flush(self, timeout: float = 5.0) -> None:
        """Block until all buffered messages are delivered.

        Args:
            timeout: Maximum seconds to wait.
        """
        remaining = self._producer.flush(timeout)
        if remaining > 0:
            logger.warning("kafka.flush_incomplete", remaining=remaining)
