"""Tests for the plays router and service."""

import pytest


@pytest.mark.asyncio
async def test_list_plays(client):
    resp = await client.get("/games/401810001/plays")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    assert data[0]["sequence_number"] == 1
    assert data[1]["sequence_number"] == 10
    assert data[2]["sequence_number"] == 20


@pytest.mark.asyncio
async def test_list_plays_filter_quarter(client):
    resp = await client.get("/games/401810001/plays", params={"quarter": 1})
    assert resp.status_code == 200
    assert len(resp.json()) == 3  # all in Q1


@pytest.mark.asyncio
async def test_list_plays_after_sequence(client):
    resp = await client.get("/games/401810001/plays", params={"after_sequence": 1})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["sequence_number"] == 10
    assert data[1]["sequence_number"] == 20


@pytest.mark.asyncio
async def test_list_plays_empty_game(client):
    resp = await client.get("/games/NONEXISTENT/plays")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_play_has_player_name(client):
    resp = await client.get("/games/401810001/plays", params={"after_sequence": 0})
    data = resp.json()
    tatum_play = [p for p in data if p["player_name"] == "Jayson Tatum"]
    assert len(tatum_play) == 1
    assert tatum_play[0]["event_type"] == "jump_shot"


async def test_plays_come_in_espns_time_order(client, seeded_session):
    """ESPN's list position orders the plays; the sequence number does not."""
    from src.db.models import Play

    seeded_session.add_all(
        [
            Play(id=9001, game_id="401810001", sequence_number=50, quarter=4, espn_order=1),
            Play(id=9002, game_id="401810001", sequence_number=40, quarter=4, espn_order=2),
        ]
    )
    await seeded_session.commit()
    resp = await client.get("/games/401810001/plays", params={"quarter": 4})
    assert resp.status_code == 200
    ordered = [p["id"] for p in resp.json()]
    assert ordered.index(9001) < ordered.index(9002)
    assert resp.json()[ordered.index(9002)]["espn_order"] == 2


async def test_after_order_returns_the_plays_after_an_espn_position(client, seeded_session):
    from src.db.models import Play

    seeded_session.add_all(
        [
            Play(id=9101, game_id="401810001", sequence_number=60, quarter=4, espn_order=10),
            Play(id=9102, game_id="401810001", sequence_number=58, quarter=4, espn_order=11),
        ]
    )
    await seeded_session.commit()
    resp = await client.get("/games/401810001/plays", params={"after_order": 10})
    assert [p["id"] for p in resp.json()] == [9102]
