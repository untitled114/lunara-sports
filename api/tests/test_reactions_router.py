"""Tests for reactions router — add/remove/list reactions on plays."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch


class TestAddReaction:
    async def test_add_reaction_success(self, client):
        mock_reaction = MagicMock()
        mock_reaction.id = 1
        mock_reaction.user_id = "user-1"
        mock_reaction.play_id = 1
        mock_reaction.emoji = "🔥"
        mock_reaction.created_at = "2026-03-22T00:00:00Z"

        with (
            patch(
                "src.routers.reactions.create_reaction",
                new_callable=AsyncMock,
                return_value=mock_reaction,
            ),
            patch(
                "src.routers.reactions.get_play_game_id",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "src.models.schemas.ReactionResponse.from_orm_reaction",
                return_value={
                    "id": 1,
                    "user_id": "user-1",
                    "play_id": 1,
                    "emoji": "🔥",
                },
            ),
        ):
            resp = await client.post(
                "/plays/1/reactions",
                json={"emoji": "🔥"},
                headers={"x-user-id": "user-1"},
            )
            assert resp.status_code == 201

    async def test_add_reaction_duplicate(self, client):
        from sqlalchemy.exc import IntegrityError

        with (
            patch(
                "src.routers.reactions.create_reaction",
                new_callable=AsyncMock,
                side_effect=IntegrityError("dup", {}, None),
            ),
        ):
            resp = await client.post(
                "/plays/1/reactions",
                json={"emoji": "🔥"},
                headers={"x-user-id": "user-1"},
            )
            assert resp.status_code == 409

    async def test_add_reaction_broadcasts_over_websocket(self, client):
        mock_reaction = MagicMock()
        mock_reaction.id = 1
        mock_reaction.user_id = "user-1"
        mock_reaction.play_id = 1
        mock_reaction.emoji = "🔥"
        mock_reaction.created_at = "2026-03-22T00:00:00Z"

        with (
            patch(
                "src.routers.reactions.create_reaction",
                new_callable=AsyncMock,
                return_value=mock_reaction,
            ),
            patch(
                "src.routers.reactions.get_play_game_id",
                new_callable=AsyncMock,
                return_value="game-1",
            ),
            patch("src.routers.reactions.manager.broadcast", new_callable=AsyncMock) as bc,
            patch(
                "src.models.schemas.ReactionResponse.from_orm_reaction",
                return_value={
                    "id": 1,
                    "user_id": "user-1",
                    "play_id": 1,
                    "emoji": "🔥",
                },
            ),
        ):
            resp = await client.post(
                "/plays/1/reactions",
                json={"emoji": "🔥"},
                headers={"x-user-id": "user-1"},
            )
            assert resp.status_code == 201
            bc.assert_awaited_once()
            room, msg = bc.await_args.args
            assert room == "game-1"
            assert msg["data"]["action"] == "add"


class TestRemoveReaction:
    async def test_remove_reaction_success(self, client):
        with (
            patch(
                "src.routers.reactions.delete_reaction", new_callable=AsyncMock, return_value=True
            ),
            patch(
                "src.routers.reactions.get_play_game_id",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            resp = await client.delete(
                "/plays/1/reactions",
                headers={"x-user-id": "user-1"},
            )
            assert resp.status_code == 204

    async def test_remove_reaction_not_found(self, client):
        with patch(
            "src.routers.reactions.delete_reaction", new_callable=AsyncMock, return_value=False
        ):
            resp = await client.delete(
                "/plays/1/reactions",
                headers={"x-user-id": "user-1"},
            )
            assert resp.status_code == 404

    async def test_remove_reaction_broadcasts_over_websocket(self, client):
        with (
            patch(
                "src.routers.reactions.delete_reaction", new_callable=AsyncMock, return_value=True
            ),
            patch(
                "src.routers.reactions.get_play_game_id",
                new_callable=AsyncMock,
                return_value="game-1",
            ),
            patch("src.routers.reactions.manager.broadcast", new_callable=AsyncMock) as bc,
        ):
            resp = await client.delete(
                "/plays/1/reactions",
                headers={"x-user-id": "user-1"},
            )
            assert resp.status_code == 204
            bc.assert_awaited_once()
            assert bc.await_args.args[1]["data"]["action"] == "remove"


class TestListReactions:
    async def test_list_reactions(self, client):
        with patch(
            "src.routers.reactions.get_reaction_counts", new_callable=AsyncMock, return_value=[]
        ):
            resp = await client.get("/plays/1/reactions")
            assert resp.status_code == 200
            assert resp.json() == []
