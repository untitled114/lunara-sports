"""Prometheus metrics for the Play-by-Play API."""

from prometheus_client import Counter, Gauge
from prometheus_fastapi_instrumentator import Instrumentator

instrumentator = Instrumentator(
    excluded_handlers=["/health", "/metrics"],
)

websocket_connections_active = Gauge(
    "websocket_connections_active",
    "Number of active WebSocket connections",
)

espn_polls_total = Counter(
    "espn_polls_total",
    "Total ESPN API poll cycles",
    ["collector"],
)

kafka_messages_consumed_total = Counter(
    "kafka_messages_consumed_total",
    "Total Kafka messages consumed by the API",
    ["topic"],
)

dlq_messages_total = Counter(
    "dlq_messages_total",
    "Total messages sent to dead letter queues",
    ["topic"],
)
