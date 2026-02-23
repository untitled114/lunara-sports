"""Shared fixtures for integration tests.

Requires infrastructure services running (Kafka, Schema Registry, Postgres, Redis).
Start with: make test-infra
"""

from __future__ import annotations

import time

import pytest
from confluent_kafka import Consumer, Producer
from confluent_kafka.admin import AdminClient, NewTopic

KAFKA_BOOTSTRAP = "localhost:29092"
SCHEMA_REGISTRY_URL = "http://localhost:8081"


@pytest.fixture(scope="session")
def kafka_admin():
    """AdminClient connected to the test Kafka cluster."""
    admin = AdminClient({"bootstrap.servers": KAFKA_BOOTSTRAP})
    # Wait for broker to be ready
    for _ in range(30):
        try:
            metadata = admin.list_topics(timeout=5)
            if metadata.brokers:
                break
        except Exception:
            pass
        time.sleep(1)
    else:
        pytest.skip("Kafka broker not available")
    return admin


@pytest.fixture(scope="session")
def ensure_topics(kafka_admin):
    """Ensure all required topics exist (including DLQs)."""
    required = [
        "raw.scoreboard",
        "raw.plays",
        "enriched.plays",
        "game.state",
        "dlq.raw.scoreboard",
        "dlq.raw.plays",
        "dlq.enriched.plays",
    ]
    metadata = kafka_admin.list_topics(timeout=10)
    existing = set(metadata.topics.keys())
    missing = [t for t in required if t not in existing]

    if missing:
        new_topics = [
            NewTopic(t, num_partitions=1, replication_factor=1) for t in missing
        ]
        futures = kafka_admin.create_topics(new_topics)
        for topic, future in futures.items():
            try:
                future.result(timeout=10)
            except Exception:
                pass  # topic may already exist

    return required


@pytest.fixture
def kafka_producer(ensure_topics):
    """Raw confluent_kafka Producer for test message injection."""
    producer = Producer({"bootstrap.servers": KAFKA_BOOTSTRAP})
    yield producer
    producer.flush(5)


@pytest.fixture
def kafka_consumer_factory(ensure_topics):
    """Factory to create consumers subscribed to specific topics."""
    consumers = []

    def _create(topics: list[str], group_id: str = "test-consumer"):
        consumer = Consumer(
            {
                "bootstrap.servers": KAFKA_BOOTSTRAP,
                "group.id": group_id,
                "auto.offset.reset": "earliest",
                "enable.auto.commit": True,
            }
        )
        consumer.subscribe(topics)
        consumers.append(consumer)
        return consumer

    yield _create

    for c in consumers:
        c.close()
