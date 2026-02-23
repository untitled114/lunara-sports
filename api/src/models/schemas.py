"""Pydantic request/response schemas for the Play-by-Play API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# ── Games ──────────────────────────────────────────────────────────────


class GameResponse(BaseModel):
    id: str
    home_team: str
    away_team: str
    home_score: int
    away_score: int
    status: str = Field(description="scheduled | live | halftime | final")
    quarter: int | None = None
    clock: str | None = None
    start_time: datetime
    venue: str | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Plays ──────────────────────────────────────────────────────────────


class PlayResponse(BaseModel):
    id: int
    game_id: str
    sequence_number: int
    quarter: int
    clock: str | None = None
    event_type: str | None = None
    description: str | None = None
    team: str | None = None
    player_name: str | None = None
    home_score: int | None = None
    away_score: int | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Predictions ────────────────────────────────────────────────────────


class PredictionCreate(BaseModel):
    game_id: str
    prediction_type: str = Field(description="winner | total_points | quarter_winner")
    prediction_value: str


class PredictionResponse(BaseModel):
    id: str
    user_id: str
    game_id: str
    prediction_type: str | None = None
    prediction_value: str
    is_correct: bool | None = None
    points_awarded: int | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_prediction(cls, p):
        return cls(
            id=str(p.id),
            user_id=str(p.user_id),
            game_id=p.game_id,
            prediction_type=p.prediction_type,
            prediction_value=p.prediction_value,
            is_correct=p.is_correct,
            points_awarded=p.points_awarded,
            created_at=p.created_at,
        )


# ── Reactions ──────────────────────────────────────────────────────────


class ReactionCreate(BaseModel):
    emoji: str = Field(max_length=10)


class ReactionResponse(BaseModel):
    id: int
    user_id: str
    play_id: int
    emoji: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_reaction(cls, r):
        return cls(
            id=r.id,
            user_id=str(r.user_id),
            play_id=r.play_id,
            emoji=r.emoji,
            created_at=r.created_at,
        )


class ReactionCount(BaseModel):
    emoji: str
    count: int


# ── Comments ──────────────────────────────────────────────────────────


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    play_id: int | None = None


class CommentResponse(BaseModel):
    id: int
    user_id: str
    game_id: str
    play_id: int | None = None
    body: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_comment(cls, c):
        return cls(
            id=c.id,
            user_id=str(c.user_id),
            game_id=c.game_id,
            play_id=c.play_id,
            body=c.body,
            created_at=c.created_at,
        )


# ── Leaderboard ────────────────────────────────────────────────────────


class LeaderboardEntry(BaseModel):
    user_id: str
    username: str
    total_points: int
    correct_predictions: int
    total_predictions: int
    streak: int
    rank: int | None = None

    model_config = {"from_attributes": True}


# ── Model Picks ───────────────────────────────────────────────────────


class ModelPickResponse(BaseModel):
    id: int
    game_id: str
    player_name: str
    team: str
    market: str
    line: float
    prediction: str
    p_over: float | None = None
    edge: float | None = None
    book: str | None = None
    model_version: str | None = None
    tier: str | None = None
    actual_value: float | None = None
    is_hit: bool | None = None
    edge_pct: float | None = None
    consensus_line: float | None = None
    opponent_team: str | None = None
    reasoning: str | None = None
    is_home: bool | None = None
    confidence: str | None = None
    line_spread: float | None = None
    is_gated: bool = False
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Standings ─────────────────────────────────────────────────────────


class StandingsTeam(BaseModel):
    rank: int
    name: str
    abbrev: str
    w: int
    l: int
    pct: str
    gb: str
    conf: str = ""
    home: str = ""
    road: str = ""
    l10: str = ""
    strk: str = ""
    logo_url: str = ""


class StandingsResponse(BaseModel):
    eastern: list[StandingsTeam]
    western: list[StandingsTeam]
    season: str = ""


# ── Teams ─────────────────────────────────────────────────────────────


class TeamListItem(BaseModel):
    name: str
    abbrev: str
    conference: str | None = None
    division: str | None = None
    logo_url: str = ""
    last_game: str = ""


class RosterPlayer(BaseModel):
    id: str = ""
    jersey: str = ""
    name: str
    position: str = ""
    height: str = ""
    weight: str = ""
    age: int | None = None
    experience: str = ""
    college: str = ""
    headshot_url: str = ""


class TeamScheduleGame(BaseModel):
    game_id: str
    date: str
    opponent: str
    home_away: str = ""
    result: str = ""
    status: str = ""
    score: str = ""


class TeamPlayerStats(BaseModel):
    player: str
    gp: int = 0
    mpg: float = 0.0
    ppg: float = 0.0
    rpg: float = 0.0
    apg: float = 0.0
    spg: float = 0.0
    bpg: float = 0.0
    fg_pct: str = ""
    three_pct: str = ""


class TeamDetailResponse(BaseModel):
    name: str
    abbrev: str
    city: str = ""
    venue: str = ""
    record: str = ""
    conference: str = ""
    division: str = ""
    color: str = "#3b82f6"
    logo_url: str = ""


# ── Players ───────────────────────────────────────────────────────────


class PlayerListItem(BaseModel):
    id: str = ""
    name: str
    jersey: str = ""
    position: str = ""
    height: str = ""
    weight: str = ""
    team: str = ""
    team_abbrev: str = ""
    headshot_url: str = ""


class PlayerSeasonStats(BaseModel):
    ppg: str = "0.0"
    rpg: str = "0.0"
    apg: str = "0.0"
    spg: str = "0.0"
    bpg: str = "0.0"
    fg_pct: str = "0.0%"
    three_pct: str = "0.0%"
    ft_pct: str = "0.0%"
    gp: int = 0


# ── Stats ─────────────────────────────────────────────────────────────


class StatLeader(BaseModel):
    rank: int
    player: str
    player_id: str = ""
    team: str = ""
    value: str = ""
    gp: int | None = None
    headshot_url: str = ""


class StatLeadersResponse(BaseModel):
    categories: dict[str, list[StatLeader]]


class TeamStatsRow(BaseModel):
    rank: int
    team: str
    abbrev: str = ""
    record: str = ""
    ortg: str = ""
    drtg: str = ""
    net_rtg: str = ""
    pace: str = ""
    ts_pct: str = ""


# ── Box Score ─────────────────────────────────────────────────────────


class BoxScorePlayer(BaseModel):
    name: str
    position: str = ""
    minutes: str = ""
    points: int = 0
    rebounds: int = 0
    assists: int = 0
    steals: int = 0
    blocks: int = 0
    turnovers: int = 0
    fouls: int = 0
    fg: str = ""
    three_pt: str = ""
    ft: str = ""
    plus_minus: str = ""
    starter: bool = False
    headshot_url: str = ""
    jersey: str = ""


class BoxScoreTeam(BaseModel):
    team: str
    abbrev: str = ""
    players: list[BoxScorePlayer]
    totals: dict = {}


class BoxScoreResponse(BaseModel):
    home: BoxScoreTeam
    away: BoxScoreTeam
    game_id: str = ""


# ── Enhanced Game ─────────────────────────────────────────────────────


class GameDetailResponse(GameResponse):
    home_team_full: str = ""
    away_team_full: str = ""
    home_record: str = ""
    away_record: str = ""


# ── Health ─────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str
    postgres: bool
    redis: bool
