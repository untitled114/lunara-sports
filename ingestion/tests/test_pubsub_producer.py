"""Tests for PubSubProducer — Pub/Sub drop-in for KafkaProducer."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

# Set required env var before importing module
os.environ.setdefault("PUBSUB_PROJECT", "test-project")


class TestPubSubProducer:
    def _make_producer(self):
        mock_client = MagicMock()
        mock_future = MagicMock()
        mock_client.publish.return_value = mock_future

        mock_pubsub = MagicMock()
        mock_pubsub.PublisherClient.return_value = mock_client

        with patch("src.producers.pubsub_producer.pubsub_v1", mock_pubsub):
            from src.producers.pubsub_producer import PubSubProducer

            producer = PubSubProducer()
            producer._client = mock_client
            producer._futures = []
            return producer, mock_client, mock_future

    def test_produce_publishes_json(self):
        producer, mock_client, _ = self._make_producer()
        producer.produce("raw.plays", key="game-1", value={"game_id": "game-1"})
        mock_client.publish.assert_called_once()
        args = mock_client.publish.call_args
        assert b'"game_id"' in args[0][1]
        assert args[1].get("key") == "game-1"

    def test_produce_maps_kafka_topic_to_pubsub(self):
        producer, mock_client, _ = self._make_producer()
        producer.produce("raw.plays", value={"x": 1})
        topic_path = mock_client.publish.call_args[0][0]
        assert "raw-plays" in topic_path

    def test_produce_none_value_is_noop(self):
        producer, mock_client, _ = self._make_producer()
        producer.produce("raw.plays", value=None)
        mock_client.publish.assert_not_called()

    def test_flush_resolves_futures(self):
        producer, mock_client, mock_future = self._make_producer()
        producer._futures = [mock_future]
        producer.flush()
        mock_future.result.assert_called_once_with(timeout=5.0)
        assert producer._futures == []

    def test_flush_handles_future_error(self):
        producer, _, mock_future = self._make_producer()
        mock_future.result.side_effect = Exception("timeout")
        producer._futures = [mock_future]
        producer.flush()  # should not raise
        assert producer._futures == []

    def test_close_calls_flush(self):
        producer, _, mock_future = self._make_producer()
        producer._futures = [mock_future]
        producer.close()
        mock_future.result.assert_called_once()

    def test_requires_pubsub_project(self):
        mock_pubsub = MagicMock()
        with patch("src.producers.pubsub_producer._PROJECT", ""):
            with patch("src.producers.pubsub_producer.pubsub_v1", mock_pubsub):
                from src.producers.pubsub_producer import PubSubProducer

                with pytest.raises(RuntimeError, match="PUBSUB_PROJECT"):
                    PubSubProducer()
