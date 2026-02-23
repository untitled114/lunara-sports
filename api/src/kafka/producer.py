"""API-side Kafka producer singleton for event publishing."""

from __future__ import annotations

import json

import structlog
from confluent_kafka import Producer

from ..config import Settings

logger = structlog.get_logger(__name__)

_producer: KafkaProducer | None = None


def _delivery_callback(err, msg) -> None:
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
    """JSON-serializing Kafka producer."""

    def __init__(self, settings: Settings) -> None:
        self._producer = Producer(
            {"bootstrap.servers": settings.kafka_bootstrap_servers}
        )

    def produce(self, topic: str, key: str, value: dict) -> None:
        self._producer.produce(
            topic=topic,
            key=key.encode("utf-8"),
            value=json.dumps(value, default=str).encode("utf-8"),
            callback=_delivery_callback,
        )
        self._producer.poll(0)

    def flush(self, timeout: float = 5.0) -> None:
        remaining = self._producer.flush(timeout)
        if remaining > 0:
            logger.warning("kafka.flush_incomplete", remaining=remaining)


def init_producer(settings: Settings) -> None:
    global _producer
    _producer = KafkaProducer(settings)
    logger.info("kafka_producer.started")


def get_producer() -> KafkaProducer | None:
    return _producer


def close_producer() -> None:
    global _producer
    if _producer is not None:
        _producer.flush()
        _producer = None
        logger.info("kafka_producer.stopped")
