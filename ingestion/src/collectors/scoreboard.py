"""ESPN scoreboard collector.

Polls the ESPN scoreboard endpoint for current NBA game states and publishes
each game snapshot to the ``raw.scoreboard`` Kafka topic.
"""

from __future__ import annotations

import asyncio
import signal
from datetime import datetime, timezone

import httpx
import structlog

from src.collectors.base import BaseCollector
from src.config import Settings
from src.producers.kafka_producer import KafkaProducer
from src.schemas.events import ScoreboardEvent

logger = structlog.get_logger(__name__)

TOPIC = "raw.scoreboard"

# ESPN status.type.name → our status string
_STATUS_MAP = {
    "STATUS_SCHEDULED": "scheduled",
    "STATUS_IN_PROGRESS": "live",
    "STATUS_HALFTIME": "halftime",
    "STATUS_END_PERIOD": "live",
    "STATUS_FINAL": "final",
    "STATUS_POSTPONED": "postponed",
    "STATUS_CANCELED": "canceled",
    "STATUS_DELAYED": "delayed",
}


def _parse_competitor(competitors: list[dict], home_away: str) -> dict:
    """Extract team info for the home or away side."""
    for c in competitors:
        if c.get("homeAway") == home_away:
            team = c.get("team", {})
            return {
                "abbrev": team.get("abbreviation", "UNK"),
                "name": team.get("displayName", "Unknown"),
                "score": int(c.get("score", 0)),
            }
    return {"abbrev": "UNK", "name": "Unknown", "score": 0}


def _parse_game(event: dict, polled_at: datetime) -> ScoreboardEvent | None:
    """Parse a single ESPN event into a ScoreboardEvent."""
    competitions = event.get("competitions", [])
    if not competitions:
        return None

    comp = competitions[0]
    competitors = comp.get("competitors", [])
    status_obj = comp.get("status", {})
    status_type = status_obj.get("type", {})

    home = _parse_competitor(competitors, "home")
    away = _parse_competitor(competitors, "away")

    espn_status = status_type.get("name", "STATUS_SCHEDULED")
    status = _STATUS_MAP.get(espn_status, "scheduled")
    status_detail = status_type.get("shortDetail", status_type.get("detail", ""))

    period = status_obj.get("period")
    display_clock = status_obj.get("displayClock")

    venue_obj = comp.get("venue", {})
    venue = venue_obj.get("fullName")

    start_time_str = event.get("date", comp.get("date", ""))
    try:
        start_time = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        start_time = polled_at

    return ScoreboardEvent(
        game_id=event.get("id", ""),
        home_team=home["abbrev"],
        away_team=away["abbrev"],
        home_team_name=home["name"],
        away_team_name=away["name"],
        home_score=home["score"],
        away_score=away["score"],
        status=status,
        status_detail=status_detail,
        quarter=period if period and period > 0 else None,
        clock=display_clock if display_clock and display_clock != "0.0" else None,
        start_time=start_time,
        venue=venue,
        polled_at=polled_at,
    )


class ScoreboardCollector(BaseCollector):
    """Fetches the NBA scoreboard from ESPN's public API.

    Parameters:
        settings: Application configuration.
        producer: Kafka producer used to publish events.
    """

    def __init__(self, settings: Settings, producer: KafkaProducer) -> None:
        self.settings = settings
        self.producer = producer
        self.client = httpx.AsyncClient(timeout=10.0)

    async def collect(self) -> list[dict]:
        """GET /scoreboard and return a list of parsed ScoreboardEvent dicts."""
        url = f"{self.settings.espn_base_url}/scoreboard"
        params = {}
        if self.settings.espn_date:
            params["dates"] = self.settings.espn_date
        logger.info("scoreboard.fetching", url=url, date=self.settings.espn_date or "auto")

        resp = await self.client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

        polled_at = datetime.now(timezone.utc)
        events = data.get("events", [])
        results = []

        for event in events:
            parsed = _parse_game(event, polled_at)
            if parsed:
                results.append(parsed.model_dump(mode="json"))

        logger.info("scoreboard.collected", games=len(results))
        return results

    async def poll(self) -> None:
        """Run one poll cycle: collect scoreboard data and produce to Kafka."""
        try:
            games = await self.collect()
        except httpx.HTTPStatusError as exc:
            logger.error("scoreboard.http_error", status=exc.response.status_code)
            return
        except httpx.RequestError as exc:
            logger.error("scoreboard.request_error", error=str(exc))
            return

        for game in games:
            game_id = game["game_id"]
            self.producer.produce(topic=TOPIC, key=game_id, value=game)
            logger.debug(
                "scoreboard.produced",
                game_id=game_id,
                matchup=f"{game['away_team']} @ {game['home_team']}",
                status=game["status"],
                score=f"{game['away_score']}-{game['home_score']}",
            )

        self.producer.flush()
        logger.info("scoreboard.poll_complete", games_published=len(games))

    async def close(self) -> None:
        """Shut down the HTTP client and flush the producer."""
        await self.client.aclose()
        self.producer.flush()


async def _run_polling_loop() -> None:
    """Entry-point loop that polls on the configured interval."""
    settings = Settings()
    producer = KafkaProducer(settings)
    collector = ScoreboardCollector(settings, producer)

    shutdown = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, shutdown.set)

    logger.info(
        "scoreboard.starting",
        interval=settings.espn_poll_interval_seconds,
        espn_url=settings.espn_base_url,
    )

    try:
        while not shutdown.is_set():
            await collector.poll()
            try:
                await asyncio.wait_for(
                    shutdown.wait(),
                    timeout=settings.espn_poll_interval_seconds,
                )
            except (TimeoutError, asyncio.TimeoutError):
                pass
    finally:
        logger.info("scoreboard.shutting_down")
        await collector.close()


if __name__ == "__main__":
    asyncio.run(_run_polling_loop())
