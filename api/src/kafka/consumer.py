"""Kafka consumer that writes raw.scoreboard and raw.plays events to PostgreSQL.

Runs as an asyncio background task inside the API process. Uses
``asyncio.to_thread`` to wrap the blocking ``confluent_kafka.Consumer.poll``
call so the event loop stays responsive.
"""

from __future__ import annotations

import asyncio
import json

import structlog
from confluent_kafka import Consumer, KafkaError
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError

from ..config import Settings
from ..db.models import Game, Play
from ..db.session import get_session_factory
from ..metrics import kafka_messages_consumed_total

logger = structlog.get_logger(__name__)

TOPICS = ["raw.scoreboard", "raw.plays", "prediction.results", "user.reactions"]


class KafkaConsumerLoop:
    """Background Kafka consumer that upserts games and inserts plays.

    Parameters:
        settings: Application configuration (provides ``kafka_bootstrap_servers``).
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._consumer: Consumer | None = None
        self._running = False

    async def run(self) -> None:
        """Main loop — poll Kafka and dispatch messages to handlers."""
        self._consumer = Consumer({
            "bootstrap.servers": self._settings.kafka_bootstrap_servers,
            "group.id": "api-db-writer",
            "auto.offset.reset": "latest",
            "enable.auto.commit": True,
        })
        self._consumer.subscribe(TOPICS)
        self._running = True

        logger.info("kafka_consumer.started", topics=TOPICS)

        try:
            while self._running:
                msg = await asyncio.to_thread(self._consumer.poll, 1.0)
                if msg is None:
                    continue
                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    logger.error("kafka_consumer.error", error=str(msg.error()))
                    continue

                topic = msg.topic()
                try:
                    value = json.loads(msg.value().decode("utf-8"))
                except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                    logger.warning("kafka_consumer.bad_message", error=str(exc))
                    continue

                kafka_messages_consumed_total.labels(topic=topic).inc()

                try:
                    if topic == "raw.scoreboard":
                        await self._handle_scoreboard(value)
                    elif topic == "raw.plays":
                        await self._handle_play(value)
                    elif topic == "prediction.results":
                        await self._handle_prediction_result(value)
                    elif topic == "user.reactions":
                        await self._handle_reaction(value)
                except Exception:
                    logger.exception("kafka_consumer.handler_error", topic=topic)
        finally:
            self._consumer.close()
            logger.info("kafka_consumer.stopped")

    def stop(self) -> None:
        """Signal the consumer loop to exit."""
        self._running = False

    async def _handle_scoreboard(self, data: dict) -> None:
        """Upsert a game row from a scoreboard event."""
        factory = get_session_factory()
        if factory is None:
            return

        from datetime import datetime, timezone

        start_time_raw = data.get("start_time")
        if isinstance(start_time_raw, str):
            try:
                start_time = datetime.fromisoformat(start_time_raw.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                start_time = datetime.now(timezone.utc)
        else:
            start_time = datetime.now(timezone.utc)

        values = {
            "id": data["game_id"],
            "home_team": data["home_team"],
            "away_team": data["away_team"],
            "status": data["status"],
            "home_score": data.get("home_score", 0),
            "away_score": data.get("away_score", 0),
            "quarter": data.get("quarter"),
            "clock": data.get("clock"),
            "start_time": start_time,
            "venue": data.get("venue"),
        }

        stmt = pg_insert(Game).values(**values).on_conflict_do_update(
            index_elements=["id"],
            set_={
                "status": values["status"],
                "home_score": values["home_score"],
                "away_score": values["away_score"],
                "quarter": values["quarter"],
                "clock": values["clock"],
                "venue": values["venue"],
            },
        )

        async with factory() as session:
            try:
                await session.execute(stmt)
                await session.commit()
                logger.debug(
                    "kafka_consumer.game_upserted",
                    game_id=data["game_id"],
                    status=data["status"],
                )
            except IntegrityError:
                await session.rollback()
                logger.warning(
                    "kafka_consumer.game_fk_missing",
                    game_id=data["game_id"],
                    home=data["home_team"],
                    away=data["away_team"],
                )

    async def _handle_play(self, data: dict) -> None:
        """Insert a play row, skipping duplicates."""
        factory = get_session_factory()
        if factory is None:
            return

        values = {
            "game_id": data["game_id"],
            "sequence_number": data["sequence_number"],
            "quarter": data["quarter"],
            "clock": data.get("clock"),
            "event_type": data.get("event_type"),
            "description": data.get("description"),
            "team": data.get("team"),
            "player_name": data.get("player_name"),
            "home_score": data.get("home_score"),
            "away_score": data.get("away_score"),
        }

        stmt = pg_insert(Play).values(**values).on_conflict_do_nothing(
            constraint="uq_plays_game_seq",
        )

        async with factory() as session:
            try:
                await session.execute(stmt)
                await session.commit()
                logger.debug(
                    "kafka_consumer.play_inserted",
                    game_id=data["game_id"],
                    seq=data["sequence_number"],
                )
            except IntegrityError:
                # FK violation — game doesn't exist yet; will succeed on next cycle
                await session.rollback()
                logger.warning(
                    "kafka_consumer.play_fk_missing",
                    game_id=data["game_id"],
                    seq=data["sequence_number"],
                )

    async def _handle_prediction_result(self, data: dict) -> None:
        """Resolve a prediction and broadcast the result via WebSocket."""
        from ..services.prediction_service import resolve_prediction
        from ..ws.live_feed import manager

        factory = get_session_factory()
        if factory is None:
            return

        async with factory() as session:
            try:
                await resolve_prediction(
                    session,
                    prediction_id=data["prediction_id"],
                    is_correct=data["is_correct"],
                    points_awarded=data.get("points_awarded", 0),
                )
            except Exception:
                logger.exception("kafka_consumer.resolve_failed", data=data)
                return

        game_id = data.get("game_id")
        if game_id:
            await manager.broadcast(game_id, {
                "type": "prediction_result",
                "data": data,
            })

    async def _handle_reaction(self, data: dict) -> None:
        """Broadcast a reaction event to all game viewers via WebSocket."""
        from ..ws.live_feed import manager

        game_id = data.get("game_id")
        if game_id:
            await manager.broadcast(game_id, {
                "type": "reaction",
                "data": data,
            })
