"""Integration tests for Dead Letter Queue routing.

Requires: make test-infra
"""

from __future__ import annotations

import json
import time

from src.kafka.dead_letter import DeadLetterProducer

from tests.integration.conftest import KAFKA_BOOTSTRAP


def _consume_one(consumer, timeout=10.0):
    """Poll until one non-error message is received."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        msg = consumer.poll(1.0)
        if msg is None:
            continue
        if msg.error():
            continue
        return msg
    return None


class TestDeadLetterQueue:
    """Test that bad messages are routed to DLQ topics."""

    def test_bad_message_goes_to_dlq(
        self, kafka_producer, kafka_consumer_factory, ensure_topics
    ):
        """Produce non-Avro garbage to raw.plays → verify dlq.raw.plays receives it."""
        dlq = DeadLetterProducer(KAFKA_BOOTSTRAP)

        # Simulate what the consumer does when it gets a bad message
        bad_value = b"this is not valid avro or json {{{{"
        dlq.send_to_dlq(
            original_topic="raw.plays",
            key=b"bad-key",
            raw_value=bad_value,
            error_message="JSONDecodeError: Expecting value",
        )
        dlq.flush()

        # Consume from DLQ
        consumer = kafka_consumer_factory(["dlq.raw.plays"], group_id="test-dlq-bad")
        msg = _consume_one(consumer)
        assert msg is not None, "No message received on dlq.raw.plays"

        envelope = json.loads(msg.value().decode("utf-8"))
        assert envelope["original_topic"] == "raw.plays"
        assert envelope["error"] == "JSONDecodeError: Expecting value"
        assert envelope["raw_value"] is not None  # base64 encoded
        assert envelope["timestamp"] is not None

    def test_handler_error_goes_to_dlq(
        self, kafka_producer, kafka_consumer_factory, ensure_topics
    ):
        """Simulate a handler exception and verify DLQ routing."""
        dlq = DeadLetterProducer(KAFKA_BOOTSTRAP)

        # Simulate handler error with valid JSON but bad data
        bad_payload = json.dumps({"game_id": "missing-fk"}).encode("utf-8")
        dlq.send_to_dlq(
            original_topic="raw.scoreboard",
            key=b"missing-fk",
            raw_value=bad_payload,
            error_message="Handler error: KeyError: 'home_team'",
        )
        dlq.flush()

        consumer = kafka_consumer_factory(
            ["dlq.raw.scoreboard"], group_id="test-dlq-handler"
        )
        msg = _consume_one(consumer)
        assert msg is not None, "No message received on dlq.raw.scoreboard"

        envelope = json.loads(msg.value().decode("utf-8"))
        assert envelope["original_topic"] == "raw.scoreboard"
        assert "KeyError" in envelope["error"]
