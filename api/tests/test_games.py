"""Tests for the games router and service."""

import pytest


@pytest.mark.asyncio
async def test_list_games_by_date(client):
    resp = await client.get("/games/", params={"game_date": "2026-02-17"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == "401810001"
    assert data[0]["home_team"] == "BOS"
    assert data[0]["away_team"] == "LAL"
    assert data[0]["status"] == "live"


@pytest.mark.asyncio
async def test_list_games_empty_date(client):
    resp = await client.get("/games/", params={"game_date": "2020-01-01"})
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_get_game_detail(client):
    resp = await client.get("/games/401810001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "401810001"
    assert data["home_score"] == 55
    assert data["away_score"] == 48
    assert data["venue"] == "TD Garden"


@pytest.mark.asyncio
async def test_get_game_not_found(client):
    resp = await client.get("/games/NONEXISTENT")
    assert resp.status_code == 404
