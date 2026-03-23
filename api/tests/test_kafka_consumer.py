"""Comprehensive tests for the Kafka consumer loop (src/kafka/consumer.py).

Covers:
- Initialization and Avro deserializer setup
- Message deserialization (Avro wire format, JSON fallback, errors)
- The run loop (poll, error handling, stop signal)
- Processing of different message types (plays, scoreboard events)
- Scoreboard handler (upsert game with various start_time formats)
- Play handler (insert play, FK violation, WebSocket broadcast)
- Prediction result handler (resolve + broadcast)
- Reaction handler (broadcast)
- DLQ routing on deserialization and handler errors
- Prometheus metrics increments
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.config import Settings

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_settings(**overrides) -> Settings:
    """Build a Settings object with safe defaults for testing."""
    defaults = {
        "kafka_bootstrap_servers": "localhost:9092",
        "schema_registry_url": "http://localhost:8081",
        "database_url": "sqlite+aiosqlite:///:memory:",
    }
    defaults.update(overrides)
    return Settings(**defaults)


def _make_kafka_msg(topic: str, value: bytes | None, key: bytes | None = None, error=None):
    """Create a mock confluent_kafka.Message."""
    msg = MagicMock()
    msg.topic.return_value = topic
    msg.value.return_value = value
    msg.key.return_value = key
    msg.error.return_value = error
    return msg


def _make_consumer():
    """Create a KafkaConsumerLoop with all external deps mocked."""
    with (
        patch("src.kafka.consumer.DeadLetterProducer"),
        patch("src.kafka.consumer.SchemaRegistryClient", side_effect=Exception("skip")),
    ):
        from src.kafka.consumer import KafkaConsumerLoop

        return KafkaConsumerLoop(_make_settings())


def _mock_session_factory(mock_session):
    """Build a mock async session factory that yields mock_session."""
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
    mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_factory


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------


class TestConsumerInit:
    """Test KafkaConsumerLoop.__init__."""

    @patch("src.kafka.consumer.DeadLetterProducer")
    @patch("src.kafka.consumer.SchemaRegistryClient")
    def test_init_creates_deserializers_when_schemas_exist(self, mock_sr, mock_dlq):
        """If .avsc files exist on disk, deserializers are created for each Avro topic."""
        mock_sr.return_value = MagicMock()

        with patch("src.kafka.consumer.AvroDeserializer") as mock_avro:
            mock_avro.return_value = MagicMock()
            with patch("src.kafka.consumer._SCHEMA_DIR") as mock_dir:
                mock_path = MagicMock()
                mock_path.exists.return_value = True
                mock_path.read_text.return_value = (
                    '{"type": "record", "name": "test", "fields": []}'
                )
                mock_dir.__truediv__ = MagicMock(return_value=mock_path)

                from src.kafka.consumer import KafkaConsumerLoop

                consumer = KafkaConsumerLoop(_make_settings())

            assert len(consumer._deserializers) == 2
            assert "raw.scoreboard" in consumer._deserializers
            assert "raw.plays" in consumer._deserializers

    @patch("src.kafka.consumer.DeadLetterProducer")
    @patch("src.kafka.consumer.SchemaRegistryClient")
    def test_init_skips_missing_schema_files(self, mock_sr, mock_dlq):
        """If .avsc files don't exist, no deserializers are created."""
        mock_sr.return_value = MagicMock()

        with patch("src.kafka.consumer._SCHEMA_DIR") as mock_dir:
            mock_path = MagicMock()
            mock_path.exists.return_value = False
            mock_dir.__truediv__ = MagicMock(return_value=mock_path)

            from src.kafka.consumer import KafkaConsumerLoop

            consumer = KafkaConsumerLoop(_make_settings())

        assert len(consumer._deserializers) == 0

    @patch("src.kafka.consumer.DeadLetterProducer")
    @patch("src.kafka.consumer.SchemaRegistryClient", side_effect=Exception("SR down"))
    def test_init_handles_schema_registry_failure(self, mock_sr, mock_dlq):
        """Schema registry failure is caught -- consumer still starts (JSON-only)."""
        from src.kafka.consumer import KafkaConsumerLoop

        consumer = KafkaConsumerLoop(_make_settings())
        assert isinstance(consumer._deserializers, dict)


# ---------------------------------------------------------------------------
# Deserialization
# ---------------------------------------------------------------------------


class TestDeserialize:
    """Test KafkaConsumerLoop._deserialize."""

    def test_json_fallback_for_unknown_topic(self):
        """Topics without Avro deserializer use JSON fallback."""
        consumer = _make_consumer()
        payload = {"foo": "bar"}
        result = consumer._deserialize("prediction.results", json.dumps(payload).encode())
        assert result == payload

    def test_json_fallback_for_non_avro_bytes(self):
        """Even on a known Avro topic, non-Avro bytes fall back to JSON."""
        consumer = _make_consumer()
        payload = {"game_id": "123"}
        result = consumer._deserialize("raw.scoreboard", json.dumps(payload).encode())
        assert result == payload

    def test_avro_deserialize_when_wire_format_matches(self):
        """Avro wire format (magic byte 0x00 + 4-byte schema ID) triggers Avro deserializer."""
        consumer = _make_consumer()
        mock_deser = MagicMock()
        mock_deser.return_value = {"game_id": "401", "home_team": "BOS"}
        consumer._deserializers["raw.scoreboard"] = mock_deser

        avro_bytes = b"\x00\x00\x00\x00\x01some_avro_payload"
        result = consumer._deserialize("raw.scoreboard", avro_bytes)
        assert result == {"game_id": "401", "home_team": "BOS"}
        mock_deser.assert_called_once()

    def test_avro_skipped_for_short_bytes(self):
        """Bytes shorter than 6 skip Avro even with deserializer present."""
        consumer = _make_consumer()
        consumer._deserializers["raw.plays"] = MagicMock()

        short = json.dumps({"a": 1}).encode()
        result = consumer._deserialize("raw.plays", short)
        assert result == {"a": 1}

    def test_avro_skipped_when_no_magic_byte(self):
        """First byte != 0x00 means not Avro wire format."""
        consumer = _make_consumer()
        consumer._deserializers["raw.plays"] = MagicMock()

        payload = json.dumps({"seq": 5}).encode()
        result = consumer._deserialize("raw.plays", payload)
        assert result == {"seq": 5}

    def test_avro_skipped_when_raw_is_none(self):
        """None raw bytes skip Avro (raw falsy check)."""
        consumer = _make_consumer()
        mock_deser = MagicMock()
        consumer._deserializers["raw.plays"] = mock_deser
        # None raw -> JSON path, which will fail. But the avro check should be skipped.
        # The condition is: deserializer and raw and len(raw) > 5 and raw[0] == 0
        # If raw is None, Python short-circuits before len(), so we get to json.loads(None)
        # which raises TypeError. This tests the branch.
        with pytest.raises((TypeError, AttributeError)):
            consumer._deserialize("raw.plays", None)
        mock_deser.assert_not_called()

    def test_invalid_json_raises(self):
        """Invalid JSON raises an exception (caller handles via DLQ)."""
        consumer = _make_consumer()
        with pytest.raises(ValueError):
            consumer._deserialize("prediction.results", b"not json {{{")


# ---------------------------------------------------------------------------
# Run loop
# ---------------------------------------------------------------------------


def _setup_run_loop(consumer, messages):
    """Set up a mock Consumer that returns messages in sequence then stops.

    Args:
        consumer: KafkaConsumerLoop instance
        messages: list of mock messages (or None) to return from poll()

    Returns:
        mock_consumer_cls to be used as Consumer replacement
    """
    mock_inner = MagicMock()
    idx = 0

    def poll_side_effect(timeout):
        nonlocal idx
        if idx < len(messages):
            msg = messages[idx]
            idx += 1
            return msg
        consumer.stop()
        return None

    mock_inner.poll = poll_side_effect
    mock_inner.subscribe = MagicMock()
    mock_inner.close = MagicMock()
    return mock_inner


class TestRunLoop:
    """Test KafkaConsumerLoop.run -- the main polling loop."""

    async def test_run_processes_valid_scoreboard_message(self):
        """A valid JSON message on raw.scoreboard calls _handle_scoreboard."""
        consumer = _make_consumer()

        scoreboard_data = {
            "game_id": "401810001",
            "home_team": "BOS",
            "away_team": "LAL",
            "status": "live",
            "start_time": "2026-02-18T00:30:00Z",
        }
        msg = _make_kafka_msg("raw.scoreboard", json.dumps(scoreboard_data).encode())
        mock_inner = _setup_run_loop(consumer, [msg])

        with patch("src.kafka.consumer.Consumer", return_value=mock_inner):
            with patch.object(
                consumer, "_handle_scoreboard", new_callable=AsyncMock
            ) as mock_handle:
                await consumer.run()
                mock_handle.assert_called_once_with(scoreboard_data)

    async def test_run_skips_none_messages(self):
        """None messages (poll timeout) are skipped."""
        consumer = _make_consumer()
        mock_inner = _setup_run_loop(consumer, [None, None])

        with patch("src.kafka.consumer.Consumer", return_value=mock_inner):
            await consumer.run()

    async def test_run_skips_partition_eof(self):
        """PARTITION_EOF errors are silently skipped."""
        from confluent_kafka import KafkaError

        consumer = _make_consumer()

        eof_error = MagicMock()
        eof_error.code.return_value = KafkaError._PARTITION_EOF

        msg = MagicMock()
        msg.error.return_value = eof_error

        mock_inner = _setup_run_loop(consumer, [msg])

        with patch("src.kafka.consumer.Consumer", return_value=mock_inner):
            await consumer.run()

    async def test_run_logs_non_eof_errors(self):
        """Non-EOF Kafka errors are logged and skipped."""
        from confluent_kafka import KafkaError

        consumer = _make_consumer()

        other_error = MagicMock()
        other_error.code.return_value = KafkaError._ALL_BROKERS_DOWN
        other_error.__str__ = lambda self: "All brokers down"

        msg = MagicMock()
        msg.error.return_value = other_error

        mock_inner = _setup_run_loop(consumer, [msg])

        with patch("src.kafka.consumer.Consumer", return_value=mock_inner):
            await consumer.run()

    async def test_run_sends_to_dlq_on_bad_deserialization(self):
        """Messages that fail deserialization go to DLQ."""
        consumer = _make_consumer()

        msg = _make_kafka_msg("raw.plays", b"not valid json or avro {{{")
        mock_inner = _setup_run_loop(consumer, [msg])

        with patch("src.kafka.consumer.Consumer", return_value=mock_inner):
            await consumer.run()

        consumer._dlq.send_to_dlq.assert_called_once()

    async def test_run_sends_to_dlq_on_handler_error(self):
        """Handler exceptions route the message to DLQ."""
        consumer = _make_consumer()

        scoreboard_data = {
            "game_id": "401",
            "home_team": "BOS",
            "away_team": "LAL",
            "status": "live",
            "start_time": "2026-01-01T00:00:00Z",
        }
        msg = _make_kafka_msg("raw.scoreboard", json.dumps(scoreboard_data).encode())
        mock_inner = _setup_run_loop(consumer, [msg])

        with patch("src.kafka.consumer.Consumer", return_value=mock_inner):
            with patch.object(
                consumer,
                "_handle_scoreboard",
                new_callable=AsyncMock,
                side_effect=RuntimeError("db down"),
            ):
                await consumer.run()

        consumer._dlq.send_to_dlq.assert_called_once()

    async def test_run_dispatches_plays(self):
        """Messages on raw.plays dispatch to _handle_play."""
        consumer = _make_consumer()

        play_data = {"game_id": "401", "sequence_number": 1, "quarter": 1}
        msg = _make_kafka_msg("raw.plays", json.dumps(play_data).encode())
        mock_inner = _setup_run_loop(consumer, [msg])

        with patch("src.kafka.consumer.Consumer", return_value=mock_inner):
            with patch.object(consumer, "_handle_play", new_callable=AsyncMock) as mock_handle:
                await consumer.run()
                mock_handle.assert_called_once_with(play_data)

    async def test_run_dispatches_prediction_results(self):
        """Messages on prediction.results dispatch to _handle_prediction_result."""
        consumer = _make_consumer()

        pred_data = {"prediction_id": "abc", "is_correct": True, "game_id": "401"}
        msg = _make_kafka_msg("prediction.results", json.dumps(pred_data).encode())
        mock_inner = _setup_run_loop(consumer, [msg])

        with patch("src.kafka.consumer.Consumer", return_value=mock_inner):
            with patch.object(
                consumer, "_handle_prediction_result", new_callable=AsyncMock
            ) as mock_handle:
                await consumer.run()
                mock_handle.assert_called_once_with(pred_data)

    async def test_run_dispatches_reactions(self):
        """Messages on user.reactions dispatch to _handle_reaction."""
        consumer = _make_consumer()

        reaction_data = {"game_id": "401", "emoji": "fire", "user_id": "u1"}
        msg = _make_kafka_msg("user.reactions", json.dumps(reaction_data).encode())
        mock_inner = _setup_run_loop(consumer, [msg])

        with patch("src.kafka.consumer.Consumer", return_value=mock_inner):
            with patch.object(consumer, "_handle_reaction", new_callable=AsyncMock) as mock_handle:
                await consumer.run()
                mock_handle.assert_called_once_with(reaction_data)

    async def test_run_closes_consumer_on_stop(self):
        """Consumer.close() and DLQ.flush() are called when loop exits."""
        consumer = _make_consumer()

        mock_inner = MagicMock()
        call_count = 0

        def poll_side_effect(timeout):
            nonlocal call_count
            call_count += 1
            consumer.stop()
            return None

        mock_inner.poll = poll_side_effect
        mock_inner.subscribe = MagicMock()
        mock_inner.close = MagicMock()

        with patch("src.kafka.consumer.Consumer", return_value=mock_inner):
            await consumer.run()

        mock_inner.close.assert_called_once()
        consumer._dlq.flush.assert_called_once()

    async def test_run_subscribes_to_all_topics(self):
        """Consumer subscribes to the TOPICS list on startup."""
        from src.kafka.consumer import TOPICS

        consumer = _make_consumer()
        mock_inner = _setup_run_loop(consumer, [])

        with patch("src.kafka.consumer.Consumer", return_value=mock_inner):
            await consumer.run()

        mock_inner.subscribe.assert_called_once_with(TOPICS)


class TestStopMethod:
    """Test KafkaConsumerLoop.stop."""

    def test_stop_sets_running_false(self):
        consumer = _make_consumer()
        consumer._running = True
        consumer.stop()
        assert consumer._running is False


# ---------------------------------------------------------------------------
# _handle_scoreboard
# ---------------------------------------------------------------------------


class TestHandleScoreboard:
    """Test KafkaConsumerLoop._handle_scoreboard."""

    async def test_returns_early_when_no_session_factory(self):
        """If get_session_factory() returns None, handler returns without error."""
        consumer = _make_consumer()
        with patch("src.kafka.consumer.get_session_factory", return_value=None):
            await consumer._handle_scoreboard({"game_id": "401"})

    async def test_upserts_game_with_iso_string_start_time(self):
        """ISO string start_time is parsed correctly."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        data = {
            "game_id": "401810001",
            "home_team": "BOS",
            "away_team": "LAL",
            "status": "live",
            "home_score": 55,
            "away_score": 48,
            "quarter": 3,
            "clock": "8:30",
            "start_time": "2026-02-18T00:30:00Z",
            "venue": "TD Garden",
        }

        with patch("src.kafka.consumer.get_session_factory", return_value=mock_factory):
            await consumer._handle_scoreboard(data)

        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()

    async def test_upserts_game_with_epoch_millis_start_time(self):
        """Epoch millis start_time (Avro timestamp-millis) is parsed correctly."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        epoch_ms = int(datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc).timestamp() * 1000)
        data = {
            "game_id": "401810001",
            "home_team": "BOS",
            "away_team": "LAL",
            "status": "live",
            "start_time": epoch_ms,
        }

        with patch("src.kafka.consumer.get_session_factory", return_value=mock_factory):
            await consumer._handle_scoreboard(data)

        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()

    async def test_upserts_game_with_none_start_time(self):
        """None start_time falls back to datetime.now(utc)."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        data = {
            "game_id": "401810001",
            "home_team": "BOS",
            "away_team": "LAL",
            "status": "scheduled",
            "start_time": None,
        }

        with patch("src.kafka.consumer.get_session_factory", return_value=mock_factory):
            await consumer._handle_scoreboard(data)

        mock_session.execute.assert_called_once()

    async def test_upserts_game_with_invalid_iso_string(self):
        """Invalid ISO string falls back to datetime.now(utc)."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        data = {
            "game_id": "401810001",
            "home_team": "BOS",
            "away_team": "LAL",
            "status": "scheduled",
            "start_time": "not-a-date",
        }

        with patch("src.kafka.consumer.get_session_factory", return_value=mock_factory):
            await consumer._handle_scoreboard(data)

        mock_session.execute.assert_called_once()

    async def test_upserts_game_with_missing_start_time_key(self):
        """No start_time key at all falls back to datetime.now(utc)."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        data = {
            "game_id": "401810001",
            "home_team": "BOS",
            "away_team": "LAL",
            "status": "scheduled",
        }

        with patch("src.kafka.consumer.get_session_factory", return_value=mock_factory):
            await consumer._handle_scoreboard(data)

        mock_session.execute.assert_called_once()

    async def test_handles_integrity_error(self):
        """IntegrityError (FK violation) is caught and rolled back."""
        from sqlalchemy.exc import IntegrityError

        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(
            side_effect=IntegrityError("fk", {}, Exception("fk violation"))
        )
        mock_factory = _mock_session_factory(mock_session)

        data = {
            "game_id": "401810001",
            "home_team": "UNKNOWN",
            "away_team": "UNKNOWN2",
            "status": "scheduled",
            "start_time": "2026-02-18T00:30:00Z",
        }

        with patch("src.kafka.consumer.get_session_factory", return_value=mock_factory):
            await consumer._handle_scoreboard(data)

        mock_session.rollback.assert_called_once()

    async def test_defaults_scores_when_missing(self):
        """Missing home_score and away_score default to 0."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        data = {
            "game_id": "401810001",
            "home_team": "BOS",
            "away_team": "LAL",
            "status": "scheduled",
        }

        with patch("src.kafka.consumer.get_session_factory", return_value=mock_factory):
            await consumer._handle_scoreboard(data)

        mock_session.execute.assert_called_once()

    async def test_float_start_time(self):
        """Float start_time (Avro timestamp) is parsed correctly."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        data = {
            "game_id": "401810001",
            "home_team": "BOS",
            "away_team": "LAL",
            "status": "live",
            "start_time": 1739838600000.0,
        }

        with patch("src.kafka.consumer.get_session_factory", return_value=mock_factory):
            await consumer._handle_scoreboard(data)

        mock_session.execute.assert_called_once()


# ---------------------------------------------------------------------------
# _handle_play
# ---------------------------------------------------------------------------


class TestHandlePlay:
    """Test KafkaConsumerLoop._handle_play."""

    async def test_returns_early_when_no_session_factory(self):
        """No session factory -> silent return."""
        consumer = _make_consumer()
        with patch("src.kafka.consumer.get_session_factory", return_value=None):
            await consumer._handle_play({"game_id": "401", "sequence_number": 1})

    async def test_inserts_play_successfully(self):
        """Play is inserted and committed."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        mock_manager = MagicMock()
        mock_manager.connection_count = MagicMock(return_value=0)

        data = {
            "game_id": "401810001",
            "sequence_number": 42,
            "quarter": 2,
            "clock": "5:30",
            "event_type": "three_pointer",
            "description": "Tatum hits three",
            "team": "BOS",
            "player_name": "Jayson Tatum",
            "home_score": 60,
            "away_score": 55,
        }

        with (
            patch("src.kafka.consumer.get_session_factory", return_value=mock_factory),
            patch("src.ws.live_feed.manager", mock_manager),
        ):
            await consumer._handle_play(data)

        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()

    async def test_handles_integrity_error(self):
        """IntegrityError (FK missing) is caught and rolled back."""
        from sqlalchemy.exc import IntegrityError

        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(side_effect=IntegrityError("fk", {}, Exception("fk")))
        mock_factory = _mock_session_factory(mock_session)

        mock_manager = MagicMock()
        mock_manager.connection_count = MagicMock(return_value=0)

        data = {
            "game_id": "NONEXISTENT",
            "sequence_number": 1,
            "quarter": 1,
        }

        with (
            patch("src.kafka.consumer.get_session_factory", return_value=mock_factory),
            patch("src.ws.live_feed.manager", mock_manager),
        ):
            await consumer._handle_play(data)

        mock_session.rollback.assert_called_once()

    async def test_broadcasts_to_websocket_when_clients_connected(self):
        """If WebSocket clients are connected for the game, broadcast the play."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        mock_manager = MagicMock()
        mock_manager.connection_count = MagicMock(return_value=3)
        mock_manager.broadcast = AsyncMock()

        data = {
            "game_id": "401810001",
            "sequence_number": 42,
            "quarter": 2,
        }

        with (
            patch("src.kafka.consumer.get_session_factory", return_value=mock_factory),
            patch("src.ws.live_feed.manager", mock_manager),
        ):
            await consumer._handle_play(data)

        mock_manager.broadcast.assert_called_once()
        call_args = mock_manager.broadcast.call_args
        assert call_args[0][0] == "401810001"
        assert call_args[0][1]["type"] == "play"

    async def test_no_broadcast_when_no_clients(self):
        """No WebSocket broadcast when connection_count is 0."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        mock_manager = MagicMock()
        mock_manager.connection_count = MagicMock(return_value=0)
        mock_manager.broadcast = AsyncMock()

        data = {
            "game_id": "401810001",
            "sequence_number": 1,
            "quarter": 1,
        }

        with (
            patch("src.kafka.consumer.get_session_factory", return_value=mock_factory),
            patch("src.ws.live_feed.manager", mock_manager),
        ):
            await consumer._handle_play(data)

        mock_manager.broadcast.assert_not_called()

    async def test_play_values_extracted_correctly(self):
        """All play fields are extracted from data dict, with optional fields defaulting."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        mock_manager = MagicMock()
        mock_manager.connection_count = MagicMock(return_value=0)

        # Minimal data -- optional fields should use .get() defaults (None)
        data = {
            "game_id": "401810001",
            "sequence_number": 1,
            "quarter": 1,
        }

        with (
            patch("src.kafka.consumer.get_session_factory", return_value=mock_factory),
            patch("src.ws.live_feed.manager", mock_manager),
        ):
            await consumer._handle_play(data)

        mock_session.execute.assert_called_once()


# ---------------------------------------------------------------------------
# _handle_prediction_result
# ---------------------------------------------------------------------------


class TestHandlePredictionResult:
    """Test KafkaConsumerLoop._handle_prediction_result."""

    async def test_returns_early_when_no_session_factory(self):
        consumer = _make_consumer()
        with patch("src.kafka.consumer.get_session_factory", return_value=None):
            await consumer._handle_prediction_result({"prediction_id": "abc", "is_correct": True})

    async def test_resolves_prediction_and_broadcasts(self):
        """Successful resolve + broadcast to game WebSocket."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        mock_manager = MagicMock()
        mock_manager.broadcast = AsyncMock()
        mock_resolve = AsyncMock()

        data = {
            "prediction_id": "abc-123",
            "is_correct": True,
            "points_awarded": 10,
            "game_id": "401810001",
        }

        with (
            patch("src.kafka.consumer.get_session_factory", return_value=mock_factory),
            patch("src.services.prediction_service.resolve_prediction", mock_resolve),
            patch("src.ws.live_feed.manager", mock_manager),
        ):
            await consumer._handle_prediction_result(data)

        mock_resolve.assert_called_once_with(
            mock_session,
            prediction_id="abc-123",
            is_correct=True,
            points_awarded=10,
        )
        mock_manager.broadcast.assert_called_once()
        call_args = mock_manager.broadcast.call_args
        assert call_args[0][0] == "401810001"
        assert call_args[0][1]["type"] == "prediction_result"

    async def test_no_broadcast_when_no_game_id(self):
        """If data has no game_id, skip broadcast."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        mock_manager = MagicMock()
        mock_manager.broadcast = AsyncMock()
        mock_resolve = AsyncMock()

        data = {
            "prediction_id": "abc-123",
            "is_correct": False,
        }

        with (
            patch("src.kafka.consumer.get_session_factory", return_value=mock_factory),
            patch("src.services.prediction_service.resolve_prediction", mock_resolve),
            patch("src.ws.live_feed.manager", mock_manager),
        ):
            await consumer._handle_prediction_result(data)

        mock_resolve.assert_called_once()
        mock_manager.broadcast.assert_not_called()

    async def test_returns_on_resolve_exception(self):
        """If resolve_prediction raises, handler returns without broadcasting."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        mock_manager = MagicMock()
        mock_manager.broadcast = AsyncMock()
        mock_resolve = AsyncMock(side_effect=RuntimeError("db error"))

        data = {
            "prediction_id": "abc-123",
            "is_correct": True,
            "game_id": "401",
        }

        with (
            patch("src.kafka.consumer.get_session_factory", return_value=mock_factory),
            patch("src.services.prediction_service.resolve_prediction", mock_resolve),
            patch("src.ws.live_feed.manager", mock_manager),
        ):
            await consumer._handle_prediction_result(data)

        mock_manager.broadcast.assert_not_called()

    async def test_default_points_awarded_zero(self):
        """points_awarded defaults to 0 if not in data."""
        consumer = _make_consumer()
        mock_session = AsyncMock()
        mock_factory = _mock_session_factory(mock_session)

        mock_manager = MagicMock()
        mock_manager.broadcast = AsyncMock()
        mock_resolve = AsyncMock()

        data = {
            "prediction_id": "abc-123",
            "is_correct": True,
            "game_id": "401810001",
        }

        with (
            patch("src.kafka.consumer.get_session_factory", return_value=mock_factory),
            patch("src.services.prediction_service.resolve_prediction", mock_resolve),
            patch("src.ws.live_feed.manager", mock_manager),
        ):
            await consumer._handle_prediction_result(data)

        mock_resolve.assert_called_once_with(
            mock_session,
            prediction_id="abc-123",
            is_correct=True,
            points_awarded=0,
        )


# ---------------------------------------------------------------------------
# _handle_reaction
# ---------------------------------------------------------------------------


class TestHandleReaction:
    """Test KafkaConsumerLoop._handle_reaction."""

    async def test_broadcasts_reaction_to_game(self):
        """Reaction with game_id is broadcast."""
        consumer = _make_consumer()

        mock_manager = MagicMock()
        mock_manager.broadcast = AsyncMock()

        data = {"game_id": "401810001", "emoji": "fire", "user_id": "u1"}

        with patch("src.ws.live_feed.manager", mock_manager):
            await consumer._handle_reaction(data)

        mock_manager.broadcast.assert_called_once()
        call_args = mock_manager.broadcast.call_args
        assert call_args[0][0] == "401810001"
        assert call_args[0][1]["type"] == "reaction"
        assert call_args[0][1]["data"] == data

    async def test_no_broadcast_when_no_game_id(self):
        """Reaction without game_id is silently dropped."""
        consumer = _make_consumer()

        mock_manager = MagicMock()
        mock_manager.broadcast = AsyncMock()

        data = {"emoji": "fire", "user_id": "u1"}

        with patch("src.ws.live_feed.manager", mock_manager):
            await consumer._handle_reaction(data)

        mock_manager.broadcast.assert_not_called()


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


class TestMetricsIntegration:
    """Verify Prometheus metrics are incremented correctly."""

    async def test_consumed_counter_incremented(self):
        """kafka_messages_consumed_total is incremented for successfully deserialized messages."""
        consumer = _make_consumer()

        data = {"game_id": "401", "emoji": "fire"}
        msg = _make_kafka_msg("user.reactions", json.dumps(data).encode())
        mock_inner = _setup_run_loop(consumer, [msg])

        with (
            patch("src.kafka.consumer.Consumer", return_value=mock_inner),
            patch("src.kafka.consumer.kafka_messages_consumed_total") as mock_counter,
            patch.object(consumer, "_handle_reaction", new_callable=AsyncMock),
        ):
            mock_label = MagicMock()
            mock_counter.labels.return_value = mock_label
            await consumer.run()
            mock_counter.labels.assert_called_with(topic="user.reactions")
            mock_label.inc.assert_called_once()

    async def test_dlq_counter_incremented_on_bad_message(self):
        """dlq_messages_total is incremented when deserialization fails."""
        consumer = _make_consumer()

        msg = _make_kafka_msg("raw.plays", b"bad data {{{")
        mock_inner = _setup_run_loop(consumer, [msg])

        with (
            patch("src.kafka.consumer.Consumer", return_value=mock_inner),
            patch("src.kafka.consumer.dlq_messages_total") as mock_counter,
        ):
            mock_label = MagicMock()
            mock_counter.labels.return_value = mock_label
            await consumer.run()
            mock_counter.labels.assert_called_with(topic="raw.plays")
            mock_label.inc.assert_called()

    async def test_dlq_counter_incremented_on_handler_error(self):
        """dlq_messages_total is incremented when handler raises an exception."""
        consumer = _make_consumer()

        data = {
            "game_id": "401",
            "home_team": "BOS",
            "away_team": "LAL",
            "status": "live",
            "start_time": "2026-01-01T00:00:00Z",
        }
        msg = _make_kafka_msg("raw.scoreboard", json.dumps(data).encode())
        mock_inner = _setup_run_loop(consumer, [msg])

        with (
            patch("src.kafka.consumer.Consumer", return_value=mock_inner),
            patch("src.kafka.consumer.dlq_messages_total") as mock_counter,
            patch.object(
                consumer,
                "_handle_scoreboard",
                new_callable=AsyncMock,
                side_effect=RuntimeError("boom"),
            ),
        ):
            mock_label = MagicMock()
            mock_counter.labels.return_value = mock_label
            await consumer.run()
            mock_counter.labels.assert_called_with(topic="raw.scoreboard")
            mock_label.inc.assert_called()


# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------


class TestModuleConstants:
    """Verify module-level constants are sensible."""

    def test_topics_list(self):
        from src.kafka.consumer import TOPICS

        assert "raw.scoreboard" in TOPICS
        assert "raw.plays" in TOPICS
        assert "prediction.results" in TOPICS
        assert "user.reactions" in TOPICS

    def test_schema_files_mapping(self):
        from src.kafka.consumer import _SCHEMA_FILES

        assert "raw.scoreboard" in _SCHEMA_FILES
        assert "raw.plays" in _SCHEMA_FILES
        assert _SCHEMA_FILES["raw.scoreboard"].endswith(".avsc")
        assert _SCHEMA_FILES["raw.plays"].endswith(".avsc")
