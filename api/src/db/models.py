"""SQLAlchemy ORM models matching the PostgreSQL schema."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    favorite_teams: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    prediction_score: Mapped[int] = mapped_column(Integer, default=0)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    membership_tier: Mapped[str] = mapped_column(String(10), default="free", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    predictions: Mapped[list[Prediction]] = relationship(back_populates="user")


class Team(Base):
    __tablename__ = "teams"

    abbrev: Mapped[str] = mapped_column(String(5), primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    conference: Mapped[str | None] = mapped_column(String(7))
    division: Mapped[str | None] = mapped_column(String(20))
    logo_url: Mapped[str | None] = mapped_column(Text)


class Game(Base):
    __tablename__ = "games"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    home_team: Mapped[str] = mapped_column(String(5), ForeignKey("teams.abbrev"))
    away_team: Mapped[str] = mapped_column(String(5), ForeignKey("teams.abbrev"))
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    home_score: Mapped[int] = mapped_column(Integer, default=0)
    away_score: Mapped[int] = mapped_column(Integer, default=0)
    quarter: Mapped[int | None] = mapped_column(Integer)
    clock: Mapped[str | None] = mapped_column(String(10))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    venue: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plays: Mapped[list[Play]] = relationship(back_populates="game")
    home_team_ref: Mapped[Team] = relationship(foreign_keys=[home_team])
    away_team_ref: Mapped[Team] = relationship(foreign_keys=[away_team])


class Play(Base):
    __tablename__ = "plays"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    game_id: Mapped[str] = mapped_column(String(20), ForeignKey("games.id"))
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    quarter: Mapped[int] = mapped_column(Integer, nullable=False)
    clock: Mapped[str | None] = mapped_column(String(10))
    event_type: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)
    team: Mapped[str | None] = mapped_column(String(3))
    player_name: Mapped[str | None] = mapped_column(String(100))
    home_score: Mapped[int | None] = mapped_column(Integer)
    away_score: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    game: Mapped[Game] = relationship(back_populates="plays")

    __table_args__ = (UniqueConstraint("game_id", "sequence_number", name="uq_plays_game_seq"),)


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    game_id: Mapped[str] = mapped_column(String(20), ForeignKey("games.id"))
    prediction_type: Mapped[str | None] = mapped_column(String(20))
    prediction_value: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool | None] = mapped_column(Boolean)
    points_awarded: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="predictions")

    __table_args__ = (
        UniqueConstraint("user_id", "game_id", "prediction_type", name="uq_predictions_user_game"),
    )


class Leaderboard(Base):
    __tablename__ = "leaderboard"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), primary_key=True)
    season: Mapped[str] = mapped_column(String(10), primary_key=True)
    total_points: Mapped[int] = mapped_column(Integer, default=0)
    correct_predictions: Mapped[int] = mapped_column(Integer, default=0)
    total_predictions: Mapped[int] = mapped_column(Integer, default=0)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    rank: Mapped[int | None] = mapped_column(Integer)

    user: Mapped[User] = relationship()


class Reaction(Base):
    __tablename__ = "reactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    play_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("plays.id"))
    emoji: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "play_id", name="uq_reactions_user_play"),)


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    game_id: Mapped[str] = mapped_column(String(20), ForeignKey("games.id"))
    play_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("plays.id"))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ModelPick(Base):
    __tablename__ = "model_picks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    game_id: Mapped[str] = mapped_column(String(30), ForeignKey("games.id"))
    player_name: Mapped[str] = mapped_column(String(100), nullable=False)
    team: Mapped[str] = mapped_column(String(10), nullable=False)
    market: Mapped[str] = mapped_column(String(20), nullable=False)
    line: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False)
    prediction: Mapped[str] = mapped_column(String(10), nullable=False)
    p_over: Mapped[float | None] = mapped_column(Numeric(4, 3))
    edge: Mapped[float | None] = mapped_column(Numeric(5, 2))
    book: Mapped[str | None] = mapped_column(String(30))
    model_version: Mapped[str | None] = mapped_column(String(10))
    tier: Mapped[str | None] = mapped_column(String(20))
    actual_value: Mapped[float | None] = mapped_column(Numeric(5, 1))
    is_hit: Mapped[bool | None] = mapped_column(Boolean)
    edge_pct: Mapped[float | None] = mapped_column(Numeric(6, 2))
    consensus_line: Mapped[float | None] = mapped_column(Numeric(5, 1))
    opponent_team: Mapped[str | None] = mapped_column(String(5))
    reasoning: Mapped[str | None] = mapped_column(Text)
    is_home: Mapped[bool | None] = mapped_column(Boolean)
    confidence: Mapped[str | None] = mapped_column(String(10))
    line_spread: Mapped[float | None] = mapped_column(Numeric(5, 1))
    game_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "game_id", "player_name", "market", "model_version", name="uq_model_picks_dedup"
        ),
    )


class UserTail(Base):
    __tablename__ = "user_tails"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    pick_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("model_picks.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "pick_id", name="uq_user_tails_user_pick"),)
