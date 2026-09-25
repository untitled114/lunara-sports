"""Tests for reaction_service — create/delete reactions, counts, play lookup."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from src.services.reaction_service import (
    create_reaction,
    delete_reaction,
    get_play_game_id,
    get_reaction_counts,
)

USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


class TestCreateReaction:
    async def test_creates_reaction(self, seeded_session):
        reaction = await create_reaction(seeded_session, user_id=USER_ID, play_id=1, emoji="🔥")
        assert reaction.id is not None
        assert reaction.emoji == "🔥"
        assert reaction.play_id == 1
        assert reaction.user_id == uuid.UUID(USER_ID)

    async def test_duplicate_reaction_raises_integrity_error(self, seeded_session):
        """Same (user_id, play_id) twice violates the unique constraint."""
        await create_reaction(seeded_session, user_id=USER_ID, play_id=2, emoji="🔥")
        with pytest.raises(IntegrityError):
            await create_reaction(seeded_session, user_id=USER_ID, play_id=2, emoji="👏")


class TestDeleteReaction:
    async def test_deletes_existing_reaction(self, seeded_session):
        await create_reaction(seeded_session, user_id=USER_ID, play_id=1, emoji="🔥")
        removed = await delete_reaction(seeded_session, user_id=USER_ID, play_id=1)
        assert removed is True

    async def test_delete_missing_reaction_returns_false(self, seeded_session):
        removed = await delete_reaction(seeded_session, user_id=USER_ID, play_id=999)
        assert removed is False


class TestGetReactionCounts:
    async def test_counts_grouped_by_emoji(self, seeded_session):
        other_user = uuid.uuid4()
        from src.db.models import User

        seeded_session.add(User(id=other_user, username="other", display_name="Other"))
        await seeded_session.flush()

        await create_reaction(seeded_session, user_id=USER_ID, play_id=1, emoji="🔥")
        await create_reaction(seeded_session, user_id=str(other_user), play_id=1, emoji="🔥")

        counts = await get_reaction_counts(seeded_session, play_id=1)
        assert counts == [{"emoji": "🔥", "count": 2}]

    async def test_empty_counts_for_play_with_no_reactions(self, seeded_session):
        counts = await get_reaction_counts(seeded_session, play_id=2)
        assert counts == []


class TestGetPlayGameId:
    async def test_returns_game_id_for_known_play(self, seeded_session):
        game_id = await get_play_game_id(seeded_session, play_id=1)
        assert game_id == "401810001"

    async def test_returns_none_for_unknown_play(self, seeded_session):
        game_id = await get_play_game_id(seeded_session, play_id=999999)
        assert game_id is None
