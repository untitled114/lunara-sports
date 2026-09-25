"""Kafka is retired: reactions broadcast directly; nothing imports src.kafka (Task 11)."""

from __future__ import annotations

import importlib
from unittest.mock import AsyncMock, patch

import pytest

# Seeded in conftest.py::seeded_session: game "401810001", play id 1, user
# aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee ("testuser"). Reactions/predictions read
# the caller's identity from the raw X-User-Id header (see auth_deps.py — JWT
# Bearer is also accepted app-wide, but these two routers only check the
# header) and reaction_service.create_reaction() does uuid.UUID(user_id) plus
# a FK to users.id, so the header value must be that seeded user's UUID string,
# not an arbitrary "u1".
GAME_ID = "401810001"
PLAY_ID = 1
USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

# NOTE (R5): test_prediction_create_does_not_need_a_broker below is NOT
# marked xfail. It already passes on current code — the test client never
# calls kafka.producer.init_producer(), so get_producer() is None and the
# /predictions/ endpoint skips the broker entirely today. Empirically
# confirmed XPASS(strict) before this marker was removed. Kept as a plain
# characterization test per Ruling R5.


@pytest.mark.xfail(strict=True, reason="pending Task 11")
def test_kafka_package_is_gone():
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("src.kafka")


@pytest.mark.xfail(strict=True, reason="pending Task 11")
def test_settings_have_no_kafka_or_gcs():
    from src.config import Settings

    s = Settings(_env_file=None)
    assert not hasattr(s, "kafka_bootstrap_servers")
    assert not hasattr(s, "gcs_olap_bucket")
    assert s.olap_export_dir == ""


@pytest.mark.xfail(strict=True, reason="pending Task 11")
async def test_add_reaction_broadcasts_to_game_room(client, seeded_session):
    # Patch the ws.live_feed singleton itself (not a name in src.routers.reactions),
    # so this is robust whether Task 11 binds `manager` at module scope in
    # reactions.py or imports it locally inside the handler.
    with patch("src.ws.live_feed.manager.broadcast", new_callable=AsyncMock) as bc:
        r = await client.post(
            f"/plays/{PLAY_ID}/reactions",
            json={"emoji": "🔥"},
            headers={"X-User-Id": USER_ID},
        )
    assert r.status_code in (200, 201)
    bc.assert_awaited_once()
    room, msg = bc.await_args.args
    assert room == GAME_ID and msg["type"] == "reaction"
    assert msg["data"] == {
        "play_id": PLAY_ID,
        "game_id": GAME_ID,
        "user_id": USER_ID,
        "emoji": "🔥",
        "action": "add",
    }


@pytest.mark.xfail(strict=True, reason="pending Task 11")
async def test_remove_reaction_broadcasts_remove(client, seeded_session):
    await client.post(
        f"/plays/{PLAY_ID}/reactions",
        json={"emoji": "🔥"},
        headers={"X-User-Id": USER_ID},
    )
    with patch("src.ws.live_feed.manager.broadcast", new_callable=AsyncMock) as bc:
        r = await client.delete(f"/plays/{PLAY_ID}/reactions", headers={"X-User-Id": USER_ID})
    assert r.status_code == 204
    assert bc.await_args.args[1]["data"]["action"] == "remove"


async def test_prediction_create_does_not_need_a_broker(client, seeded_session):
    """Already passes today (R5): no xfail marker — kept as characterization."""
    r = await client.post(
        "/predictions/",
        json={"game_id": GAME_ID, "prediction_type": "winner", "prediction_value": "BOS"},
        headers={"X-User-Id": USER_ID},
    )
    assert r.status_code in (200, 201)
