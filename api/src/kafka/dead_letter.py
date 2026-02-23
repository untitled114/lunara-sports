"""Dead Letter Queue producer for unprocessable Kafka messages."""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone

import structlog
from confluent_kafka import Producer

logger = structlog.get_logger(__name__)


class DeadLetterProducer:
    """Routes failed messages to ``dlq.{original_topic}`` topics.

    Parameters:
        bootstrap_servers: Kafka bootstrap servers string.
    """

    def __init__(self, bootstrap_servers: str) -> None:
        self._producer = Producer({"bootstrap.servers": bootstrap_servers})

    def send_to_dlq(
        self,
        original_topic: str,
        key: bytes | None,
        raw_value: bytes | None,
        error_message: str,
    ) -> None:
        """Produce a DLQ envelope to ``dlq.{original_topic}``.

        Args:
            original_topic: The source topic the message came from.
            key: Original message key bytes.
            raw_value: Original message value bytes.
            error_message: Description of why the message failed.
        """
        dlq_topic = f"dlq.{original_topic}"
        envelope = {
            "original_topic": original_topic,
            "key": key.decode("utf-8", errors="replace") if key else None,
            "raw_value": base64.b64encode(raw_value).decode() if raw_value else None,
            "error": error_message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            self._producer.produce(
                topic=dlq_topic,
                key=key,
                value=json.dumps(envelope).encode("utf-8"),
            )
            self._producer.poll(0)
            logger.warning(
                "dlq.message_sent",
                dlq_topic=dlq_topic,
                error=error_message[:200],
            )
        except Exception:
            logger.exception("dlq.send_failed", dlq_topic=dlq_topic)

    def flush(self, timeout: float = 5.0) -> None:
        self._producer.flush(timeout)
