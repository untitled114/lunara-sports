"""Reactions broadcast straight to the game's WebSocket room; predictions are written directly."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from .auth_helpers import bearer

# Seeded in conftest.py::seeded_session: game "401810001", play id 1, user
# aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee ("testuser"). Writes sign in with that user's JWT
# (tests/auth_helpers.py), and reactions keep a FK to users.id.
GAME_ID = "401810001"
PLAY_ID = 1
USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


async def test_add_reaction_broadcasts_to_game_room(client, seeded_session):
    # Patch the ws.live_feed singleton itself (not a name in src.routers.reactions),
    # so this holds whether reactions.py binds `manager` at module scope or imports
    # it inside the handler.
    with patch("src.ws.live_feed.manager.broadcast", new_callable=AsyncMock) as bc:
        r = await client.post(
            f"/plays/{PLAY_ID}/reactions",
            json={"emoji": "fire"},
            headers=bearer(USER_ID),
        )
    assert r.status_code in (200, 201)
    bc.assert_awaited_once()
    room, msg = bc.await_args.args
    assert room == GAME_ID and msg["type"] == "reaction"
    assert msg["data"] == {
        "play_id": PLAY_ID,
        "game_id": GAME_ID,
        "user_id": USER_ID,
        "emoji": "fire",
        "action": "add",
    }


async def test_remove_reaction_broadcasts_remove(client, seeded_session):
    await client.post(
        f"/plays/{PLAY_ID}/reactions",
        json={"emoji": "fire"},
        headers=bearer(USER_ID),
    )
    with patch("src.ws.live_feed.manager.broadcast", new_callable=AsyncMock) as bc:
        r = await client.delete(f"/plays/{PLAY_ID}/reactions", headers=bearer(USER_ID))
    assert r.status_code == 204
    assert bc.await_args.args[1]["data"]["action"] == "remove"


async def test_prediction_create_does_not_need_a_broker(client, seeded_session):
    """Creating a prediction writes the row with no broker involved."""
    r = await client.post(
        "/predictions/",
        json={"game_id": GAME_ID, "prediction_type": "winner", "prediction_value": "BOS"},
        headers=bearer(USER_ID),
    )
    assert r.status_code in (200, 201)
