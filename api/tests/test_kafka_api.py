"""Tests for API-side Kafka producer and dead letter queue."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from src.kafka.dead_letter import DeadLetterProducer
from src.kafka.producer import (
    KafkaProducer,
    _delivery_callback,
    close_producer,
    get_producer,
    init_producer,
)

# ── delivery callback ──────────────────────────────────────────────


class TestDeliveryCallback:
    def test_success(self):
        msg = MagicMock()
        msg.topic.return_value = "test"
        msg.partition.return_value = 0
        msg.offset.return_value = 1
        _delivery_callback(None, msg)

    def test_error(self):
        msg = MagicMock()
        msg.topic.return_value = "test"
        _delivery_callback(Exception("fail"), msg)


# ── KafkaProducer ──────────────────────────────────────────────────


class TestKafkaProducer:
    def test_produce(self):
        with patch("src.kafka.producer.Producer") as MockProd:
            mock_inner = MagicMock()
            MockProd.return_value = mock_inner
            settings = MagicMock()
            settings.kafka_bootstrap_servers = "localhost:9092"

            prod = KafkaProducer(settings)
            prod.produce("topic", "key1", {"data": 1})
            mock_inner.produce.assert_called_once()
            mock_inner.poll.assert_called_once_with(0)

    def test_flush_complete(self):
        with patch("src.kafka.producer.Producer") as MockProd:
            mock_inner = MagicMock()
            mock_inner.flush.return_value = 0
            MockProd.return_value = mock_inner
            settings = MagicMock()
            settings.kafka_bootstrap_servers = "localhost:9092"

            prod = KafkaProducer(settings)
            prod.flush()
            mock_inner.flush.assert_called_once_with(5.0)

    def test_flush_incomplete(self):
        with patch("src.kafka.producer.Producer") as MockProd:
            mock_inner = MagicMock()
            mock_inner.flush.return_value = 3
            MockProd.return_value = mock_inner
            settings = MagicMock()
            settings.kafka_bootstrap_servers = "localhost:9092"

            prod = KafkaProducer(settings)
            prod.flush()


# ── Singleton lifecycle ────────────────────────────────────────────


class TestProducerSingleton:
    def test_init_and_get(self):
        with patch("src.kafka.producer.Producer") as MockProd:
            mock_inner = MagicMock()
            mock_inner.flush.return_value = 0
            MockProd.return_value = mock_inner
            settings = MagicMock()
            settings.kafka_bootstrap_servers = "localhost:9092"
            init_producer(settings)
            assert get_producer() is not None
            close_producer()
            assert get_producer() is None

    def test_close_when_none(self):
        with patch("src.kafka.producer._producer", None):
            close_producer()  # should not raise


# ── DeadLetterProducer ─────────────────────────────────────────────


class TestDeadLetterProducer:
    def test_send_to_dlq(self):
        with patch("src.kafka.dead_letter.Producer") as MockProd:
            mock_inner = MagicMock()
            MockProd.return_value = mock_inner

            dlq = DeadLetterProducer("localhost:9092")
            dlq.send_to_dlq("raw.plays", b"key1", b"value1", "parse error")
            mock_inner.produce.assert_called_once()
            call_kwargs = mock_inner.produce.call_args
            assert call_kwargs[1]["topic"] == "dlq.raw.plays"

    def test_send_to_dlq_none_key_value(self):
        with patch("src.kafka.dead_letter.Producer") as MockProd:
            mock_inner = MagicMock()
            MockProd.return_value = mock_inner

            dlq = DeadLetterProducer("localhost:9092")
            dlq.send_to_dlq("raw.plays", None, None, "error")
            mock_inner.produce.assert_called_once()

    def test_send_to_dlq_produce_error(self):
        with patch("src.kafka.dead_letter.Producer") as MockProd:
            mock_inner = MagicMock()
            mock_inner.produce.side_effect = Exception("kafka down")
            MockProd.return_value = mock_inner

            dlq = DeadLetterProducer("localhost:9092")
            dlq.send_to_dlq("raw.plays", b"k", b"v", "err")  # should not raise

    def test_flush(self):
        with patch("src.kafka.dead_letter.Producer") as MockProd:
            mock_inner = MagicMock()
            MockProd.return_value = mock_inner

            dlq = DeadLetterProducer("localhost:9092")
            dlq.flush(timeout=2.0)
            mock_inner.flush.assert_called_once_with(2.0)
