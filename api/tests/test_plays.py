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
