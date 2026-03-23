"""Tests for comment_service — create and list game comments."""

from __future__ import annotations

import uuid

from src.db.models import Comment
from src.services.comment_service import get_game_comments


class TestCreateComment:
    async def test_creates_comment(self, seeded_session):
        user_id = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
        comment = Comment(
            id=100,
            user_id=user_id,
            game_id="401810001",
            body="Great game!",
        )
        seeded_session.add(comment)
        await seeded_session.commit()
        await seeded_session.refresh(comment)
        assert comment.body == "Great game!"
        assert comment.game_id == "401810001"

    async def test_creates_comment_with_play_id(self, seeded_session):
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
