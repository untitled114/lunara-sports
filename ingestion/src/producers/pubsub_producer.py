"""Google Pub/Sub producer — GCP replacement for kafka_producer.py.

Same interface as KafkaProducer: produce(topic, key, value).
Used when PUBSUB_PROJECT env var is set; falls back to Kafka otherwise.
"""

from __future__ import annotations

import json
import os

import structlog

try:
    from google.cloud import pubsub_v1
except ImportError:  # not installed — fails at instantiation, not import time
    pubsub_v1 = None  # type: ignore[assignment]

logger = structlog.get_logger(__name__)

_PROJECT = os.environ.get("PUBSUB_PROJECT", "")

# Kafka topic → Pub/Sub topic name mapping
_TOPIC_MAP = {
    "raw.scoreboard": os.environ.get("PUBSUB_TOPIC_SCOREBOARD", "raw-scoreboard"),
    "raw.plays": os.environ.get("PUBSUB_TOPIC_PLAYS", "raw-plays"),
}


class PubSubProducer:
    """Drop-in replacement for KafkaProducer on GCP.

    Usage:
        producer = PubSubProducer()
        producer.produce("raw.plays", key="game-id", value={...})
        producer.flush()  # no-op — Pub/Sub publishes are async by default
    """

    def __init__(self) -> None:
        if not _PROJECT:
            raise RuntimeError("PUBSUB_PROJECT env var is required for PubSubProducer")
        if pubsub_v1 is None:
            raise RuntimeError(
                "google-cloud-pubsub not installed: pip install 'playbyplay-ingestion[gcp]'"
            )
        self._client = pubsub_v1.PublisherClient()
        self._futures: list = []
        logger.info("pubsub_producer.initialized", project=_PROJECT)

    def _topic_path(self, kafka_topic: str) -> str:
        pubsub_topic = _TOPIC_MAP.get(kafka_topic, kafka_topic.replace(".", "-"))
        return f"projects/{_PROJECT}/topics/{pubsub_topic}"

    def produce(self, topic: str, key: str | None = None, value: dict | None = None) -> None:
        """Publish a message to Pub/Sub. Non-blocking."""
        if value is None:
            return
        data = json.dumps(value).encode()
        attributes = {"key": key} if key else {}
        future = self._client.publish(self._topic_path(topic), data, **attributes)
        self._futures.append(future)

    def flush(self) -> None:
        """Wait for all pending publishes to complete."""
        for future in self._futures:
            try:
                future.result(timeout=5.0)
            except Exception:
                logger.exception("pubsub_producer.flush_error")
        self._futures.clear()

    def close(self) -> None:
        self.flush()
