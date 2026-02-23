"""Tests for DB-backed services — comments, reactions, plays, game queries."""

from __future__ import annotations

import uuid
from datetime import timezone

import pytest

from src.db.models import Comment, Game, Play, Reaction, Team
from src.services.comment_service import get_game_comments
from src.services.game_service import _game_to_dict
from src.services.play_service import get_plays
from src.services.reaction_service import (
    delete_reaction,
    get_play_game_id,
    get_reaction_counts,
)


@pytest.fixture
async def db_session(session):
    """Session with teams, games, plays, and a user for service tests."""
    from datetime import datetime

    from src.db.models import User

    session.add_all(
        [
            Team(abbrev="BOS", name="Boston Celtics"),
            Team(abbrev="LAL", name="Los Angeles Lakers"),
        ]
    )
    await session.flush()

    game = Game(
        id="g100",
        home_team="BOS",
        away_team="LAL",
        status="live",
        home_score=55,
        away_score=48,
        quarter=3,
        clock="5:00",
        start_time=datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc),
        venue="TD Garden",
    )
    session.add(game)
    await session.flush()

    session.add_all(
        [
            Play(
                id=100,
                game_id="g100",
                sequence_number=1,
                quarter=1,
                clock="12:00",
                event_type="jump_ball",
                description="Tip-off",
                team="BOS",
                home_score=0,
                away_score=0,
            ),
            Play(
                id=101,
                game_id="g100",
                sequence_number=10,
                quarter=1,
                clock="11:00",
                event_type="jump_shot",
                description="Tatum jumper",
                team="BOS",
                player_name="Jayson Tatum",
                home_score=2,
                away_score=0,
            ),
            Play(
                id=102,
                game_id="g100",
                sequence_number=20,
                quarter=2,
                clock="6:00",
                event_type="layup",
                description="LeBron layup",
                team="LAL",
                player_name="LeBron James",
                home_score=30,
                away_score=28,
            ),
        ]
    )
    await session.flush()

    user_id = uuid.UUID("11111111-2222-3333-4444-555555555555")
    session.add(User(id=user_id, username="testuser", display_name="Test"))
    await session.commit()
    return session


# ── Play Service ──────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestPlayService:
    async def test_get_all_plays(self, db_session):
        plays = await get_plays(db_session, "g100")
        assert len(plays) == 3

    async def test_filter_by_quarter(self, db_session):
        plays = await get_plays(db_session, "g100", quarter=1)
        assert len(plays) == 2

    async def test_after_sequence(self, db_session):
        plays = await get_plays(db_session, "g100", after_sequence=5)
        assert len(plays) == 2

    async def test_empty_game(self, db_session):
        plays = await get_plays(db_session, "nonexistent")
        assert plays == []

    async def test_limit(self, db_session):
        plays = await get_plays(db_session, "g100", limit=1)
        assert len(plays) == 1


# ── Comment Service ───────────────────────────────────────────────────


@pytest.mark.asyncio
class TestCommentService:
    async def test_create_comment(self, db_session):
        uid = "11111111-2222-3333-4444-555555555555"
        # SQLite needs explicit BigInteger IDs
        c = Comment(id=1000, user_id=uuid.UUID(uid), game_id="g100", body="Great play!")
        db_session.add(c)
        await db_session.commit()
        await db_session.refresh(c)
        assert c.id == 1000
        assert c.body == "Great play!"
        assert c.game_id == "g100"

    async def test_create_comment_on_play(self, db_session):
        uid = "11111111-2222-3333-4444-555555555555"
        c = Comment(id=1001, user_id=uuid.UUID(uid), game_id="g100", body="Nice!", play_id=100)
        db_session.add(c)
        await db_session.commit()
        assert c.play_id == 100

    async def test_get_game_comments(self, db_session):
        uid = "11111111-2222-3333-4444-555555555555"
        db_session.add(Comment(id=1002, user_id=uuid.UUID(uid), game_id="g100", body="Comment 1"))
        db_session.add(Comment(id=1003, user_id=uuid.UUID(uid), game_id="g100", body="Comment 2"))
        await db_session.commit()
        comments = await get_game_comments(db_session, "g100")
        assert len(comments) == 2

    async def test_get_comments_empty_game(self, db_session):
        comments = await get_game_comments(db_session, "nonexistent")
        assert comments == []


# ── Reaction Service ──────────────────────────────────────────────────


@pytest.mark.asyncio
class TestReactionService:
    async def test_create_reaction(self, db_session):
        uid = "11111111-2222-3333-4444-555555555555"
        # SQLite needs explicit BigInteger IDs
        r = Reaction(id=2000, user_id=uuid.UUID(uid), play_id=100, emoji="🔥")
        db_session.add(r)
        await db_session.commit()
        assert r.emoji == "🔥"
        assert r.play_id == 100

    async def test_delete_reaction(self, db_session):
        uid = "11111111-2222-3333-4444-555555555555"
        r = Reaction(id=2001, user_id=uuid.UUID(uid), play_id=101, emoji="👍")
        db_session.add(r)
        await db_session.commit()
        removed = await delete_reaction(db_session, uid, 101)
        assert removed is True

    async def test_delete_nonexistent(self, db_session):
        uid = "11111111-2222-3333-4444-555555555555"
        removed = await delete_reaction(db_session, uid, 999)
        assert removed is False

    async def test_get_reaction_counts(self, db_session):
        uid = "11111111-2222-3333-4444-555555555555"
        r = Reaction(id=2002, user_id=uuid.UUID(uid), play_id=102, emoji="🔥")
        db_session.add(r)
        await db_session.commit()
        counts = await get_reaction_counts(db_session, 102)
        assert len(counts) == 1
        assert counts[0]["emoji"] == "🔥"
        assert counts[0]["count"] == 1

    async def test_get_play_game_id(self, db_session):
        game_id = await get_play_game_id(db_session, 100)
        assert game_id == "g100"

    async def test_get_play_game_id_not_found(self, db_session):
        game_id = await get_play_game_id(db_session, 99999)
        assert game_id is None


# ── Game Service helpers ──────────────────────────────────────────────


class TestGameToDict:
    def test_basic_conversion(self):
        from datetime import datetime

        game = Game(
            id="g1",
            home_team="BOS",
            away_team="LAL",
            status="live",
            home_score=55,
            away_score=48,
            quarter=3,
            clock="8:30",
            start_time=datetime(2026, 2, 18, 0, 30, tzinfo=timezone.utc),
            venue="TD Garden",
        )
        d = _game_to_dict(game)
        assert d["id"] == "g1"
        assert d["home_team"] == "BOS"
        assert d["away_team"] == "LAL"
        assert d["home_score"] == 55
        assert d["status"] == "live"
        assert "2026-02-18" in d["start_time"]

    def test_none_start_time(self):
        game = Game(
            id="g2",
            home_team="BOS",
            away_team="LAL",
            status="scheduled",
            start_time=None,
        )
        d = _game_to_dict(game)
        assert d["start_time"] is None
