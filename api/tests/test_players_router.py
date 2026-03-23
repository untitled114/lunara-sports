"""Tests for players router — search, detail, stats, log."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from src.models.schemas import PlayerSeasonStats


class TestListPlayers:
    async def test_list_all(self, client):
        with patch("src.routers.players.get_all_players", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/players")
            assert resp.status_code == 200

    async def test_list_with_search(self, client):
        with patch("src.routers.players.get_all_players", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/players?search=LeBron")
            assert resp.status_code == 200


class TestPlayerDetail:
    async def test_found(self, client):
        with patch(
            "src.routers.players.get_player_by_id",
            new_callable=AsyncMock,
            return_value={"id": "123", "name": "LeBron James"},
        ):
            resp = await client.get("/players/123")
            assert resp.status_code == 200

    async def test_not_found(self, client):
        with patch(
            "src.routers.players.get_player_by_id", new_callable=AsyncMock, return_value=None
        ):
            resp = await client.get("/players/999")
            assert resp.status_code == 404


class TestPlayerStats:
    async def test_with_stats(self, client):
        stats = PlayerSeasonStats(gp=70, ppg="25.3", rpg="7.2", apg="8.1")
        with patch(
            "src.routers.players.get_player_season_stats",
            new_callable=AsyncMock,
            return_value=stats,
        ):
            resp = await client.get("/players/123/stats")
            assert resp.status_code == 200
            assert resp.json()["ppg"] == "25.3"

    async def test_no_stats_returns_empty(self, client):
        with patch(
            "src.routers.players.get_player_season_stats", new_callable=AsyncMock, return_value=None
        ):
            resp = await client.get("/players/123/stats")
            assert resp.status_code == 200
            # Should return empty PlayerSeasonStats, not 404
            assert resp.json()["gp"] == 0


class TestPlayerLog:
    async def test_get_log(self, client):
        with patch(
            "src.routers.players.get_player_game_log", new_callable=AsyncMock, return_value=[]
        ):
            resp = await client.get("/players/123/log")
            assert resp.status_code == 200
