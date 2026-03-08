"""Pub/Sub stream processor — replaces Java Kafka Streams topology on GCP.

Subscribes to raw-plays and raw-scoreboard. For each play:
  1. TeamEnricher: joins with cached scoreboard → EnrichedEvent
  2. GameStateBuilder: aggregates into GameState (per-game, in-memory)
  3. Publishes enriched event to enriched-plays topic
  4. Publishes updated game state to game-state topic

Equivalent to GameEventTopology.java (TeamEnricher + GameStateBuilder).
Idempotent: duplicate sequence numbers are dropped by GameStateBuilder.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone

import structlog
from google.cloud import pubsub_v1

logger = structlog.get_logger(__name__)

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
SUB_PLAYS = os.environ.get("PUBSUB_SUB_PLAYS", "raw-plays-sub")
SUB_SCOREBOARD = os.environ.get("PUBSUB_SUB_SCOREBOARD", "raw-scoreboard-sub")
TOPIC_ENRICHED = os.environ.get("PUBSUB_TOPIC_ENRICHED", "enriched-plays")
TOPIC_STATE = os.environ.get("PUBSUB_TOPIC_STATE", "game-state")


def _topic_path(topic: str) -> str:
    return f"projects/{PROJECT}/topics/{topic}"


def _sub_path(sub: str) -> str:
    return f"projects/{PROJECT}/subscriptions/{sub}"


class ScoreboardCache:
    """In-memory cache of game_id → scoreboard snapshot.

    Updated by the scoreboard subscriber before plays are processed.
    Thread-safe via asyncio (single-threaded event loop).
    """

    def __init__(self) -> None:
        self._cache: dict[str, dict] = {}

    def update(self, event: dict) -> None:
        game_id = event.get("game_id")
        if game_id:
            self._cache[game_id] = event

    def get(self, game_id: str) -> dict | None:
        return self._cache.get(game_id)


class GameStateStore:
    """In-memory game state aggregator (mirrors GameStateBuilder.java).

    Skips duplicate/out-of-order events by sequence number watermark.
    """

    def __init__(self) -> None:
        self._states: dict[str, dict] = {}

    def apply(self, game_id: str, enriched: dict) -> dict:
        state = self._states.setdefault(
            game_id,
            {
                "game_id": game_id,
                "home_score": 0,
                "away_score": 0,
                "quarter": 0,
                "clock": "",
                "status": "LIVE",
                "last_play_sequence": -1,
                "play_count": 0,
                "scoring_play_count": 0,
                "home_team": None,
                "away_team": None,
                "home_team_name": None,
                "away_team_name": None,
                "venue": None,
                "last_play_description": None,
                "last_play_type": None,
                "updated_at": None,
            },
        )

        seq = enriched.get("sequence_number", 0)
        if seq <= state["last_play_sequence"]:
            return state  # duplicate — skip

        state.update(
            {
                "home_score": enriched.get("home_score", state["home_score"]),
                "away_score": enriched.get("away_score", state["away_score"]),
                "quarter": enriched.get("quarter", state["quarter"]),
                "clock": enriched.get("clock", state["clock"]),
                "last_play_sequence": seq,
                "play_count": state["play_count"] + 1,
                "last_play_description": enriched.get("description"),
                "last_play_type": enriched.get("event_type"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )

        if enriched.get("scoring_play"):
            state["scoring_play_count"] += 1

        # Team info — set once
        if state["home_team"] is None and enriched.get("home_team"):
            state.update(
                {
                    "home_team": enriched["home_team"],
                    "away_team": enriched.get("away_team"),
                    "home_team_name": enriched.get("home_team_name"),
                    "away_team_name": enriched.get("away_team_name"),
                    "venue": enriched.get("venue"),
                }
            )

        state["status"] = self._derive_status(enriched)
        self._states[game_id] = state
        return state

    @staticmethod
    def _derive_status(event: dict) -> str:
        event_type = event.get("event_type", "")
        if event_type == "game_end":
            return "FINAL"
        if event_type == "period_end" and event.get("quarter") == 2:
            return "HALFTIME"
        return "LIVE"


class StreamProcessor:
    def __init__(self) -> None:
        self.scoreboard_cache = ScoreboardCache()
        self.game_state_store = GameStateStore()
        self.publisher = pubsub_v1.PublisherClient()
        self.subscriber = pubsub_v1.SubscriberClient()

    def _publish(self, topic: str, data: dict) -> None:
        self.publisher.publish(
            _topic_path(topic),
            json.dumps(data).encode(),
        )

    def _enrich(self, play: dict) -> dict:
        """TeamEnricher: join play with scoreboard cache."""
        game_id = play.get("game_id", "")
        scoreboard = self.scoreboard_cache.get(game_id)

        enriched = {
            **play,
            "score_differential": play.get("home_score", 0) - play.get("away_score", 0),
            "enriched_at": datetime.now(timezone.utc).isoformat(),
        }

        if scoreboard:
            enriched.update(
                {
                    "home_team": scoreboard.get("home_team"),
                    "away_team": scoreboard.get("away_team"),
                    "home_team_name": scoreboard.get("home_team_name"),
                    "away_team_name": scoreboard.get("away_team_name"),
                    "venue": scoreboard.get("venue"),
                }
            )
        else:
            logger.debug("no_scoreboard_cache", game_id=game_id)

        return enriched

    def handle_scoreboard(self, message: pubsub_v1.subscriber.message.Message) -> None:
        try:
            event = json.loads(message.data.decode())
            self.scoreboard_cache.update(event)
            message.ack()
        except Exception:
            logger.exception("scoreboard_handler_error")
            message.nack()

    def handle_play(self, message: pubsub_v1.subscriber.message.Message) -> None:
        try:
            play = json.loads(message.data.decode())
            game_id = play.get("game_id", "")

            enriched = self._enrich(play)
            self._publish(TOPIC_ENRICHED, enriched)

            state = self.game_state_store.apply(game_id, enriched)
            self._publish(TOPIC_STATE, state)

            message.ack()
            logger.debug(
                "play_processed", game_id=game_id, seq=play.get("sequence_number")
            )
        except Exception:
            logger.exception("play_handler_error")
            message.nack()

    def run(self) -> None:
        logger.info(
            "stream_processor.started",
            project=PROJECT,
            sub_plays=SUB_PLAYS,
            sub_scoreboard=SUB_SCOREBOARD,
        )

        scoreboard_future = self.subscriber.subscribe(
            _sub_path(SUB_SCOREBOARD), callback=self.handle_scoreboard
        )
        plays_future = self.subscriber.subscribe(
            _sub_path(SUB_PLAYS), callback=self.handle_play
        )

        with self.subscriber:
            try:
                # Block indefinitely — subscribers run in background threads
                asyncio.get_event_loop().run_forever()
            except KeyboardInterrupt:
                scoreboard_future.cancel()
                plays_future.cancel()


def main() -> None:
    processor = StreamProcessor()
    processor.run()


if __name__ == "__main__":
    main()
