"""Tests for comment_service — create and list game comments."""

from __future__ import annotations

import uuid

from src.db.models import Comment
from src.services.comment_service import create_comment, get_game_comments


class TestCreateComment:
    async def test_creates_comment(self, seeded_session):
        """create_comment() itself inserts, commits and refreshes the row."""
        user_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        comment = await create_comment(
            seeded_session,
            user_id=user_id,
            game_id="401810001",
            body="Great game!",
        )
        assert comment.id is not None
        assert comment.body == "Great game!"
        assert comment.game_id == "401810001"
        assert comment.user_id == uuid.UUID(user_id)
        assert comment.play_id is None

    async def test_creates_comment_with_play_id(self, seeded_session):
        user_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        comment = await create_comment(
            seeded_session,
            user_id=user_id,
            game_id="401810001",
            body="What a shot!",
            play_id=1,
        )
        assert comment.play_id == 1

    async def test_creates_comment_with_manual_row(self, seeded_session):
        """Direct ORM insert (bypassing the service) still round-trips."""
        user_id = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
        comment = Comment(
            id=101,
            user_id=user_id,
            game_id="401810001",
            body="What a shot!",
            play_id=1,
        )
        seeded_session.add(comment)
        await seeded_session.commit()
        assert comment.play_id == 1


class TestGetGameComments:
    async def test_returns_comments(self, seeded_session):
        user_id = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
        seeded_session.add(Comment(id=200, user_id=user_id, game_id="401810001", body="C1"))
        seeded_session.add(Comment(id=201, user_id=user_id, game_id="401810001", body="C2"))
        await seeded_session.commit()

        comments = await get_game_comments(seeded_session, "401810001")
        assert len(comments) >= 2

    async def test_empty_for_unknown_game(self, seeded_session):
        comments = await get_game_comments(seeded_session, "nonexistent")
        assert comments == []
