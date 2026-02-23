"""Tests for the predictions router."""

import pytest


USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


@pytest.mark.asyncio
async def test_create_prediction(client):
    resp = await client.post(
        "/predictions/",
        json={
            "game_id": "401810001",
            "prediction_type": "winner",
            "prediction_value": "BOS",
        },
        headers={"x-user-id": USER_ID},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["game_id"] == "401810001"
    assert data["prediction_type"] == "winner"
    assert data["prediction_value"] == "BOS"
    assert data["user_id"] == USER_ID
    assert data["is_correct"] is None


@pytest.mark.asyncio
async def test_get_user_predictions(client):
    # Create one first
    await client.post(
        "/predictions/",
        json={
            "game_id": "401810001",
            "prediction_type": "total_points",
            "prediction_value": "220",
        },
        headers={"x-user-id": USER_ID},
    )

    resp = await client.get(f"/predictions/{USER_ID}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert all(p["user_id"] == USER_ID for p in data)


@pytest.mark.asyncio
async def test_get_leaderboard(client):
    resp = await client.get("/leaderboard/", params={"season": "2025-26"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["username"] == "testuser"
    assert data[0]["total_points"] == 150
    assert data[0]["correct_predictions"] == 30
    assert data[0]["streak"] == 5
