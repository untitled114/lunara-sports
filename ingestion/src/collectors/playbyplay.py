"""ESPN play-by-play collector.

Polls the ESPN game summary endpoint for individual play events and publishes
each play to the ``raw.plays`` Kafka topic. Deduplicates against previously
seen sequence numbers so only new plays are produced on each poll cycle.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

import httpx
import structlog

from src.collectors.base import BaseCollector
from src.config import Settings
from src.producers.kafka_producer import KafkaProducer
from src.resilience.circuit_breaker import CircuitBreaker, CircuitOpenError
from src.resilience.retry import espn_retry
from src.schemas.events import PlayEvent

logger = structlog.get_logger(__name__)

TOPIC = "raw.plays"

# Normalize ESPN type.text → snake_case event type
_EVENT_TYPE_MAP = {
    "jumpball": "jump_ball",
    "jump shot": "jump_shot",
    "pullup jump shot": "jump_shot",
    "floating jump shot": "jump_shot",
    "turnaround jump shot": "jump_shot",
    "step back jump shot": "jump_shot",
    "fadeaway jump shot": "jump_shot",
    "hook shot": "hook_shot",
    "driving layup": "layup",
    "layup": "layup",
    "cutting layup shot": "layup",
    "finger roll layup": "layup",
    "reverse layup": "layup",
    "running layup": "layup",
    "driving floating jump shot": "floater",
    "dunk": "dunk",
    "driving dunk": "dunk",
    "alley oop dunk": "dunk",
    "cutting dunk shot": "dunk",
    "running dunk": "dunk",
    "tip shot": "tip_shot",
    "free throw 1 of 1": "free_throw",
    "free throw 1 of 2": "free_throw",
    "free throw 2 of 2": "free_throw",
    "free throw 1 of 3": "free_throw",
    "free throw 2 of 3": "free_throw",
    "free throw 3 of 3": "free_throw",
    "offensive rebound": "rebound_offensive",
    "defensive rebound": "rebound_defensive",
    "team offensive rebound": "rebound_offensive",
    "team defensive rebound": "rebound_defensive",
    "turnover": "turnover",
    "steal": "steal",
    "block": "block",
    "personal foul": "foul",
    "shooting foul": "foul_shooting",
    "offensive foul": "foul_offensive",
    "loose ball foul": "foul_loose_ball",
    "flagrant foul type 1": "foul_flagrant",
    "technical foul": "foul_technical",
    "substitution": "substitution",
    "timeout": "timeout",
    "official timeout": "timeout",
    "end of period": "period_end",
    "end of game": "game_end",
}

# Regex to extract the first player name from ESPN play text.
# Matches patterns like "LeBron James makes..." or "De'Aaron Fox misses..."
_PLAYER_RE = re.compile(r"^([A-Z][a-zA-Z'\-\.]+(?: (?:Jr\.|Sr\.|III|II|IV|[A-Z][a-zA-Z'\-\.]+))+)")


def _normalize_event_type(event_text: str) -> str:
    """Map ESPN event text to a normalized snake_case type."""
    key = event_text.strip().lower()
    if key in _EVENT_TYPE_MAP:
        return _EVENT_TYPE_MAP[key]
    # Fallback: generic free throw
    if "free throw" in key:
        return "free_throw"
    # Fallback: generic foul
    if "foul" in key:
        return "foul"
    # Fallback: generic rebound
    if "rebound" in key:
        return "rebound"
    # Fallback: snake_case the raw text
    return re.sub(r"[^a-z0-9]+", "_", key).strip("_")


def _extract_player_name(text: str) -> str | None:
    """Extract the primary player name from ESPN play description text."""
    if not text:
        return None
    m = _PLAYER_RE.match(text)
    if m:
        return m.group(1)
    return None


def _build_team_map(header: dict) -> dict[str, str]:
    """Build a team_id → abbreviation map from the summary header."""
    team_map = {}
    competitions = header.get("competitions", [])
    if competitions:
        for comp in competitions[0].get("competitors", []):
            team = comp.get("team", {})
            team_id = str(team.get("id", ""))
            abbrev = team.get("abbreviation", "")
            if team_id and abbrev:
                team_map[team_id] = abbrev
    return team_map


def _parse_play(
    play: dict, game_id: str, team_map: dict[str, str], polled_at: datetime
) -> PlayEvent | None:
    """Parse a single ESPN play dict into a PlayEvent."""
    try:
        seq = int(play.get("sequenceNumber", 0))
    except (ValueError, TypeError):
        return None

    period_obj = play.get("period", {})
    quarter = period_obj.get("number", 0)

    clock_obj = play.get("clock", {})
    clock = clock_obj.get("displayValue", "0:00")

    type_obj = play.get("type", {})
    event_text = type_obj.get("text", "Unknown")
    event_type = _normalize_event_type(event_text)

    description = play.get("text", "")
    player_name = _extract_player_name(description)

    team_obj = play.get("team", {})
    team_id = str(team_obj.get("id", ""))
    team_abbrev = team_map.get(team_id)

    wallclock_str = play.get("wallclock")
    wallclock = None
    if wallclock_str:
        try:
            wallclock = datetime.fromisoformat(wallclock_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            pass

    return PlayEvent(
        game_id=game_id,
        play_id=play.get("id", ""),
        sequence_number=seq,
        quarter=quarter,
        clock=clock,
        event_type=event_type,
        event_text=event_text,
        description=description,
        team=team_abbrev,
        player_name=player_name,
        home_score=play.get("homeScore", 0),
        away_score=play.get("awayScore", 0),
        scoring_play=play.get("scoringPlay", False),
        score_value=play.get("scoreValue", 0),
        wallclock=wallclock,
        polled_at=polled_at,
    )


class PlayByPlayCollector(BaseCollector):
    """Fetches play-by-play data for a single NBA game from ESPN.

    Uses the ``/summary?event={game_id}`` endpoint to retrieve plays.
    Tracks the highest seen sequence number to avoid producing duplicates.

    Parameters:
        settings: Application configuration.
        producer: Kafka producer used to publish events.
        game_id: ESPN game identifier to poll.
    """

    def __init__(self, settings: Settings, producer: KafkaProducer, game_id: str) -> None:
        self.settings = settings
        self.producer = producer
        self.game_id = game_id
        self.client = httpx.AsyncClient(timeout=10.0)
        self._max_sequence: int = -1  # highest sequence number seen so far
        self._circuit_breaker = CircuitBreaker()

    @property
    def new_play_count(self) -> int:
        """Number of plays seen (based on max sequence). Useful for monitoring."""
        return self._max_sequence + 1 if self._max_sequence >= 0 else 0

    @espn_retry
    async def _fetch(self) -> dict:
        """Fetch game summary JSON from ESPN with retry."""
        url = f"{self.settings.espn_base_url}/summary"
        params = {"event": self.game_id}
        logger.debug("playbyplay.fetching", game_id=self.game_id)

        resp = await self.client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()

    async def collect(self) -> list[dict]:
        """GET /summary?event={game_id} and return new play dicts.

        Only returns plays with sequence numbers greater than the highest
        previously seen, providing built-in deduplication.
        """
        data = await self._circuit_breaker.call(self._fetch())

        polled_at = datetime.now(timezone.utc)
        team_map = _build_team_map(data.get("header", {}))
        raw_plays = data.get("plays", [])

        new_plays = []
        for raw in raw_plays:
            try:
                seq = int(raw.get("sequenceNumber", 0))
            except (ValueError, TypeError):
                continue
            if seq <= self._max_sequence:
                continue

            parsed = _parse_play(raw, self.game_id, team_map, polled_at)
            if parsed:
                new_plays.append(parsed.model_dump(mode="json"))

        # Update high-water mark
        if new_plays:
            self._max_sequence = max(p["sequence_number"] for p in new_plays)

        logger.info(
            "playbyplay.collected",
            game_id=self.game_id,
            new_plays=len(new_plays),
            total_in_response=len(raw_plays),
            max_sequence=self._max_sequence,
        )
        return new_plays

    async def poll(self) -> None:
        """Run one poll cycle: collect plays and produce new ones to Kafka."""
        try:
            plays = await self.collect()
        except CircuitOpenError:
            logger.warning(
                "playbyplay.circuit_open",
                game_id=self.game_id,
                action="skipping_cycle",
            )
            return
        except httpx.HTTPStatusError as exc:
            logger.error(
                "playbyplay.http_error",
                game_id=self.game_id,
                status=exc.response.status_code,
            )
            return
        except httpx.RequestError as exc:
            logger.error(
                "playbyplay.request_error",
                game_id=self.game_id,
                error=str(exc),
            )
            return

        for play in plays:
            self.producer.produce(topic=TOPIC, key=self.game_id, value=play)
            logger.debug(
                "playbyplay.produced",
                game_id=self.game_id,
                seq=play["sequence_number"],
                event_type=play["event_type"],
                desc=play["description"][:80],
            )

        if plays:
            self.producer.flush()
            logger.info(
                "playbyplay.poll_complete",
                game_id=self.game_id,
                new_plays_published=len(plays),
            )

    async def close(self) -> None:
        """Shut down the HTTP client and flush the producer."""
        await self.client.aclose()
        self.producer.flush()
