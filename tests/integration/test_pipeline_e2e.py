"""End-to-end integration tests: ESPN → ingestion → Kafka → consumer.

These tests run ingestion components in-process against real Kafka/Schema Registry.
Requires: make test-infra
"""

from __future__ import annotations

import time
import uuid
from pathlib import Path
from unittest.mock import AsyncMock

import httpx
import pytest
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer
from confluent_kafka.serialization import MessageField, SerializationContext

from tests.integration.conftest import KAFKA_BOOTSTRAP, SCHEMA_REGISTRY_URL
from tests.integration.mock_espn import SCOREBOARD_RESPONSE, SUMMARY_RESPONSE

ROOT = Path(__file__).resolve().parents[2]

# Expected game ID from mock_espn fixtures
GAME_ID = SCOREBOARD_RESPONSE["events"][0]["id"]


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


def _consume_until_key(consumer, expected_key: bytes, timeout: float = 15.0):
    """Consume messages until one with the expected key is found.

    Kafka topics accumulate messages across runs, so a fresh consumer
    (auto.offset.reset=earliest) may read thousands of stale messages.
    This helper skips past them to find the one we just produced.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        msg = consumer.poll(1.0)
        if msg is None:
            continue
        if msg.error():
            continue
        if msg.key() == expected_key:
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

        # Consume from Kafka — skip stale messages to find the one we just produced
        group_id = f"test-scoreboard-{uuid.uuid4().hex[:8]}"
        consumer = kafka_consumer_factory(["raw.scoreboard"], group_id=group_id)
        msg = _consume_until_key(consumer, GAME_ID.encode())
        assert msg is not None, f"No message with key={GAME_ID} on raw.scoreboard"

        # Verify Avro deserialization
        schema_path = ROOT / "schemas" / "avro" / "scoreboard_event.avsc"
        registry = SchemaRegistryClient({"url": SCHEMA_REGISTRY_URL})
        deser = AvroDeserializer(registry, schema_path.read_text())
        ctx = SerializationContext("raw.scoreboard", MessageField.VALUE)
        data = deser(msg.value(), ctx)

        assert data["game_id"] == GAME_ID
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
            ingestion_settings, ingestion_producer, game_id=GAME_ID
        )

        mock_resp = httpx.Response(
            200, json=SUMMARY_RESPONSE, request=httpx.Request("GET", "http://test")
        )
        collector.client = AsyncMock()
        collector.client.get = AsyncMock(return_value=mock_resp)

        await collector.poll()

        # Consume play messages — search by key (game_id) to skip stale data
        group_id = f"test-plays-{uuid.uuid4().hex[:8]}"
        consumer = kafka_consumer_factory(["raw.plays"], group_id=group_id)
        messages = []
        deadline = time.monotonic() + 15.0
        while time.monotonic() < deadline and len(messages) < 3:
            msg = consumer.poll(1.0)
            if msg is None or msg.error():
                continue
            # Only collect messages for our test game
            if msg.key() == GAME_ID.encode():
                messages.append(msg)

        assert len(messages) >= 2, (
            f"Expected at least 2 play messages for {GAME_ID}, got {len(messages)}"
        )

        # Verify Avro deserialization of first message
        schema_path = ROOT / "schemas" / "avro" / "play_event.avsc"
        registry = SchemaRegistryClient({"url": SCHEMA_REGISTRY_URL})
        deser = AvroDeserializer(registry, schema_path.read_text())
        ctx = SerializationContext("raw.plays", MessageField.VALUE)
        data = deser(messages[0].value(), ctx)

        assert data["game_id"] == GAME_ID
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

        roundtrip_key = f"roundtrip-{uuid.uuid4().hex[:8]}"

        value = {
            "game_id": roundtrip_key,
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
            topic="raw.scoreboard", key=roundtrip_key, value=value
        )
        ingestion_producer.flush()

        group_id = f"test-roundtrip-{uuid.uuid4().hex[:8]}"
        consumer = kafka_consumer_factory(["raw.scoreboard"], group_id=group_id)
        msg = _consume_until_key(consumer, roundtrip_key.encode())
        assert msg is not None, f"No message with key={roundtrip_key} on raw.scoreboard"

        schema_path = ROOT / "schemas" / "avro" / "scoreboard_event.avsc"
        registry = SchemaRegistryClient({"url": SCHEMA_REGISTRY_URL})
        deser = AvroDeserializer(registry, schema_path.read_text())
        ctx = SerializationContext("raw.scoreboard", MessageField.VALUE)
        result = deser(msg.value(), ctx)

        assert result["game_id"] == roundtrip_key
        assert result["home_team"] == "MIA"
        assert result["away_team"] == "NYK"
        assert result["home_score"] == 99
        assert result["away_score"] == 95
        assert result["quarter"] == 4
        assert result["clock"] == "1:30"
        assert result["venue"] == "Kaseya Center"
