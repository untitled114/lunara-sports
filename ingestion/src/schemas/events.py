"""Pydantic models for events produced to Kafka topics."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ScoreboardEvent(BaseModel):
    """Snapshot of a single game's state from the ESPN scoreboard.

    Published to the ``raw.scoreboard`` topic.
    """

    game_id: str
    home_team: str  # abbreviation e.g. "BOS"
    away_team: str
    home_team_name: str  # display name e.g. "Boston Celtics"
    away_team_name: str
    home_score: int
    away_score: int
    status: str  # "scheduled", "live", "halftime", "final"
    status_detail: str  # human-readable e.g. "4th 3:45", "Final", "7:00 PM EST"
    quarter: int | None = None
    clock: str | None = None
    start_time: datetime
    venue: str | None = None
    polled_at: datetime


class PlayEvent(BaseModel):
    """A single play from a live or historical game.

    Published to the ``raw.plays`` topic.
    """

    game_id: str
    play_id: str  # ESPN play ID
    sequence_number: int
    quarter: int
    clock: str
    event_type: str  # normalized: "jump_shot", "rebound", "turnover", etc.
    event_text: str  # ESPN type.text: "Pullup Jump Shot", "Defensive Rebound"
    description: str  # full text: "LeBron James makes 15-foot jumper"
    team: str | None = None  # team abbreviation
    player_name: str | None = None  # primary player from description
    home_score: int
    away_score: int
    scoring_play: bool = False
    score_value: int = 0  # points scored on this play (0, 1, 2, 3)
    wallclock: datetime | None = None  # real-time timestamp of the play
    polled_at: datetime
