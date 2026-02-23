"""Tests for kafka_producer — Avro serialization, delivery callbacks, datetime conversion."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

from confluent_kafka.serialization import MessageField, SerializationContext

from src.producers.kafka_producer import (
    _datetime_to_millis,
    _delivery_callback,
    _to_dict,
)


class TestDatetimeToMillis:
    def test_datetime_object(self):
        dt = datetime(2026, 2, 20, 12, 0, tzinfo=timezone.utc)
        result = _datetime_to_millis(dt)
        assert isinstance(result, int)
        assert result > 0

    def test_iso_string(self):
        result = _datetime_to_millis("2026-02-20T12:00:00Z")
        assert isinstance(result, int)
        assert result > 0

    def test_iso_string_with_offset(self):
        result = _datetime_to_millis("2026-02-20T12:00:00+00:00")
        assert isinstance(result, int)

    def test_epoch_seconds(self):
        result = _datetime_to_millis(1708502400.0)
        assert result == 1708502400000

    def test_epoch_millis(self):
        result = _datetime_to_millis(1708502400000)
        assert result == 1708502400000

    def test_integer(self):
        result = _datetime_to_millis(1708502400)
        assert result == 1708502400000

    def test_none(self):
        assert _datetime_to_millis(None) is None


class TestToDict:
    def test_converts_timestamps(self):
        data = {
            "start_time": "2026-02-20T12:00:00Z",
            "polled_at": "2026-02-20T12:00:00Z",
            "name": "test",
        }
        ctx = SerializationContext("raw.scoreboard", MessageField.VALUE)
        result = _to_dict(data, ctx)
        assert isinstance(result["start_time"], int)
        assert isinstance(result["polled_at"], int)
        assert result["name"] == "test"

    def test_no_timestamp_fields(self):
        data = {"game_id": "123", "score": 50}
        ctx = SerializationContext("raw.scoreboard", MessageField.VALUE)
        result = _to_dict(data, ctx)
        assert result == {"game_id": "123", "score": 50}

    def test_none_timestamp(self):
        data = {"start_time": None, "name": "test"}
        ctx = SerializationContext("raw.scoreboard", MessageField.VALUE)
        result = _to_dict(data, ctx)
        assert result["start_time"] is None


class TestDeliveryCallback:
    def test_success(self):
        msg = MagicMock()
        msg.topic.return_value = "raw.scoreboard"
        msg.partition.return_value = 0
        msg.offset.return_value = 42
        _delivery_callback(None, msg)  # should not raise

    def test_error(self):
        err = MagicMock()
        err.__str__ = lambda self: "timeout"
        msg = MagicMock()
        msg.topic.return_value = "raw.scoreboard"
        _delivery_callback(err, msg)  # should not raise, just logs
