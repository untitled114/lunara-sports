"""End-to-end integration tests: ESPN → ingestion → Kafka → consumer.

These tests run ingestion components in-process against real Kafka/Schema Registry.
Requires: make test-infra
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
from unittest.mock import AsyncMock

import httpx
import pytest

# Add ingestion and api source to path for in-process testing
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ingestion"))
sys.path.insert(0, str(ROOT / "api"))

from confluent_kafka.schema_registry import SchemaRegistryClient  # noqa: E402
from confluent_kafka.schema_registry.avro import AvroDeserializer  # noqa: E402
from confluent_kafka.serialization import MessageField, SerializationContext  # noqa: E402

from tests.integration.conftest import KAFKA_BOOTSTRAP, SCHEMA_REGISTRY_URL  # noqa: E402
from tests.integration.mock_espn import SCOREBOARD_RESPONSE, SUMMARY_RESPONSE  # noqa: E402


@pytest.fixture
def ingestion_settings():
    """Create ingestion Settings pointing at test infra."""
    from src.config import Settings

    return Settings(
        kafka_bootstrap_servers=KAFKA_BOOTSTRAP,
        schema_registry_url=SCHEMA_REGISTRY_URL,
        espn_poll_interval_seconds=1,
    )


@pytest.fixture
def ingestion_producer(ingestion_settings):
    """Create a real KafkaProducer for tests."""
    from src.producers.kafka_producer import KafkaProducer

    return KafkaProducer(ingestion_settings)


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


class TestScoreboardToKafka:
    """Test scoreboard collector → Kafka Avro producer flow."""

    @pytest.mark.asyncio
    async def test_scoreboard_produces_avro(
        self,
        ingestion_settings,
        ingestion_producer,
        kafka_consumer_factory,
        ensure_topics,
    ):
        """Mock ESPN → ScoreboardCollector.poll() → verify Avro message on Kafka."""
        from src.collectors.scoreboard import ScoreboardCollector

        collector = ScoreboardCollector(ingestion_settings, ingestion_producer)

        # Mock the HTTP client to return canned response
        mock_resp = httpx.Response(
            200, json=SCOREBOARD_RESPONSE, request=httpx.Request("GET", "http://test")
        )
        collector.client = AsyncMock()
        collector.client.get = AsyncMock(return_value=mock_resp)

        await collector.poll()

        # Consume from Kafka and verify
        consumer = kafka_consumer_factory(
            ["raw.scoreboard"], group_id="test-scoreboard"
        )
        msg = _consume_one(consumer)
        assert msg is not None, "No message received on raw.scoreboard"
        assert msg.key() == b"401584701"

        # Verify Avro deserialization
        schema_path = ROOT / "schemas" / "avro" / "scoreboard_event.avsc"
        registry = SchemaRegistryClient({"url": SCHEMA_REGISTRY_URL})
        deser = AvroDeserializer(registry, schema_path.read_text())
        ctx = SerializationContext("raw.scoreboard", MessageField.VALUE)
        data = deser(msg.value(), ctx)

        assert data["game_id"] == "401584701"
        assert data["home_team"] == "BOS"
        assert data["away_team"] == "LAL"
        assert data["home_score"] == 55
        assert data["away_score"] == 48
        assert data["status"] == "live"

        await collector.close()


class TestPlaysToKafka:
    """Test play-by-play collector → Kafka Avro producer flow."""

    @pytest.mark.asyncio
    async def test_plays_produce_avro(
        self,
        ingestion_settings,
        ingestion_producer,
        kafka_consumer_factory,
        ensure_topics,
    ):
        """Mock ESPN → PlayByPlayCollector.poll() → verify Avro messages on Kafka."""
        from src.collectors.playbyplay import PlayByPlayCollector

        collector = PlayByPlayCollector(
            ingestion_settings, ingestion_producer, game_id="401584701"
        )

        mock_resp = httpx.Response(
            200, json=SUMMARY_RESPONSE, request=httpx.Request("GET", "http://test")
        )
        collector.client = AsyncMock()
        collector.client.get = AsyncMock(return_value=mock_resp)

        await collector.poll()

        # Consume all 3 plays from Kafka
        consumer = kafka_consumer_factory(["raw.plays"], group_id="test-plays")
        messages = []
        for _ in range(3):
            msg = _consume_one(consumer, timeout=10)
            if msg:
                messages.append(msg)

        assert len(messages) >= 2, (
            f"Expected at least 2 play messages, got {len(messages)}"
        )

        # Verify Avro deserialization of first message
        schema_path = ROOT / "schemas" / "avro" / "play_event.avsc"
        registry = SchemaRegistryClient({"url": SCHEMA_REGISTRY_URL})
        deser = AvroDeserializer(registry, schema_path.read_text())
        ctx = SerializationContext("raw.plays", MessageField.VALUE)
        data = deser(messages[0].value(), ctx)

        assert data["game_id"] == "401584701"
        assert data["sequence_number"] in (1, 5, 8)

        await collector.close()


class TestAvroRoundtrip:
    """Test Avro serialization → deserialization roundtrip."""

    @pytest.mark.asyncio
    async def test_scoreboard_avro_roundtrip(
        self,
        ingestion_settings,
        ingestion_producer,
        kafka_consumer_factory,
        ensure_topics,
    ):
        """Produce Avro scoreboard → consume and deserialize → verify all fields."""
        from datetime import datetime, timezone

        value = {
            "game_id": "roundtrip-1",
            "home_team": "MIA",
            "away_team": "NYK",
            "home_team_name": "Miami Heat",
            "away_team_name": "New York Knicks",
            "home_score": 99,
            "away_score": 95,
            "status": "live",
            "status_detail": "4th 1:30",
            "quarter": 4,
            "clock": "1:30",
            "start_time": datetime.now(timezone.utc).isoformat(),
            "venue": "Kaseya Center",
            "polled_at": datetime.now(timezone.utc).isoformat(),
        }

        ingestion_producer.produce(
            topic="raw.scoreboard", key="roundtrip-1", value=value
        )
        ingestion_producer.flush()

        consumer = kafka_consumer_factory(["raw.scoreboard"], group_id="test-roundtrip")
        msg = _consume_one(consumer)
        assert msg is not None

        schema_path = ROOT / "schemas" / "avro" / "scoreboard_event.avsc"
        registry = SchemaRegistryClient({"url": SCHEMA_REGISTRY_URL})
        deser = AvroDeserializer(registry, schema_path.read_text())
        ctx = SerializationContext("raw.scoreboard", MessageField.VALUE)
        result = deser(msg.value(), ctx)

        assert result["game_id"] == "roundtrip-1"
        assert result["home_team"] == "MIA"
        assert result["away_team"] == "NYK"
        assert result["home_score"] == 99
        assert result["away_score"] == 95
        assert result["quarter"] == 4
        assert result["clock"] == "1:30"
        assert result["venue"] == "Kaseya Center"
