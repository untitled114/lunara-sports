"""Historical data loader for backfilling past games.

Fetches completed game data from ESPN for a given date range and publishes
events to Kafka so downstream consumers can rebuild state.
"""

from __future__ import annotations

import asyncio
from datetime import date, timedelta

import structlog

from src.collectors.playbyplay import PlayByPlayCollector
from src.collectors.scoreboard import ScoreboardCollector
from src.config import Settings
from src.producers.kafka_producer import KafkaProducer

logger = structlog.get_logger(__name__)


class HistoricalLoader:
    """Batch loader that backfills historical game and play-by-play data.

    Parameters:
        settings: Application configuration.
        producer: Kafka producer used to publish events.
    """

    def __init__(self, settings: Settings, producer: KafkaProducer) -> None:
        self.settings = settings
        self.producer = producer

    async def load_date_range(self, start: date, end: date) -> None:
        """Load all games and plays for every date in [start, end].

        For each date:
        1. Fetch the scoreboard (game states) and publish to raw.scoreboard
        2. For each completed game, fetch play-by-play and publish to raw.plays
        3. Sleep between dates to respect ESPN rate limits
        """
        current = start
        total_games = 0
        total_plays = 0

        while current <= end:
            date_str = current.strftime("%Y%m%d")
            logger.info("historical.loading_date", date=str(current))

            # Temporarily override the ESPN date setting
            original_date = self.settings.espn_date
            self.settings.espn_date = date_str

            try:
                # Fetch and publish scoreboard
                collector = ScoreboardCollector(self.settings, self.producer)
                try:
                    games = await collector.collect()
                    for game in games:
                        self.producer.produce(
                            topic="raw.scoreboard",
                            key=game["game_id"],
                            value=game,
                        )
                    self.producer.flush()
                    total_games += len(games)
                    logger.info("historical.scoreboard_done", date=str(current), games=len(games))
                except Exception as e:
                    logger.error("historical.scoreboard_error", date=str(current), error=str(e))
                    games = []
                finally:
                    await collector.close()

                # Fetch play-by-play for each final game
                for game in games:
                    if game.get("status") != "final":
                        continue

                    game_id = game["game_id"]
                    try:
                        plays_loaded = await self._load_single_game_pbp(game_id)
                        total_plays += plays_loaded
                    except Exception as e:
                        logger.error("historical.pbp_error", game_id=game_id, error=str(e))

                    # Rate limit: 1 second between games
                    await asyncio.sleep(1)

            finally:
                self.settings.espn_date = original_date

            logger.info("historical.date_complete", date=str(current), games=len(games))

            # Rate limit: 2 seconds between dates
            await asyncio.sleep(2)
            current += timedelta(days=1)

        logger.info(
            "historical.complete",
            start=str(start),
            end=str(end),
            total_games=total_games,
            total_plays=total_plays,
        )

    async def load_game(self, game_id: str) -> None:
        """Load a single historical game by its ESPN game ID.

        Fetches play-by-play data and publishes to Kafka.
        """
        logger.info("historical.loading_game", game_id=game_id)
        plays_loaded = await self._load_single_game_pbp(game_id)
        logger.info("historical.game_complete", game_id=game_id, plays=plays_loaded)

    async def _load_single_game_pbp(self, game_id: str) -> int:
        """Fetch and publish play-by-play for a single game. Returns play count."""
        pbp_collector = PlayByPlayCollector(self.settings, self.producer, game_id)
        try:
            await pbp_collector.poll()
            return pbp_collector.new_play_count
        finally:
            await pbp_collector.close()
