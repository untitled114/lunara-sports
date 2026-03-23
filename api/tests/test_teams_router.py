"""Tests for teams router — list, detail, roster, schedule, stats."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from src.models.schemas import TeamDetailResponse


class TestListTeams:
    async def test_list(self, client):
        with patch("src.routers.teams.get_teams", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/teams")
            assert resp.status_code == 200


class TestTeamDetail:
    async def test_found(self, client):
        detail = TeamDetailResponse(
            abbrev="BOS",
            name="Boston Celtics",
            conference="Eastern",
            division="Atlantic",
            logo_url="",
            record="",
            wins=50,
            losses=20,
        )
        with patch(
            "src.routers.teams.get_team_detail", new_callable=AsyncMock, return_value=detail
        ):
            resp = await client.get("/teams/BOS")
            assert resp.status_code == 200

    async def test_not_found(self, client):
        with patch("src.routers.teams.get_team_detail", new_callable=AsyncMock, return_value=None):
            resp = await client.get("/teams/XXX")
            assert resp.status_code == 404

    async def test_case_insensitive(self, client):
        detail = TeamDetailResponse(
            abbrev="BOS",
            name="Boston Celtics",
            conference="Eastern",
            division="Atlantic",
            logo_url="",
            record="",
            wins=50,
            losses=20,
        )
        with patch(
            "src.routers.teams.get_team_detail", new_callable=AsyncMock, return_value=detail
        ):
            resp = await client.get("/teams/bos")
            assert resp.status_code == 200


class TestTeamRoster:
    async def test_get_roster(self, client):
        with patch("src.routers.teams.get_team_roster", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/teams/BOS/roster")
            assert resp.status_code == 200


class TestTeamSchedule:
    async def test_get_schedule(self, client):
        with patch("src.routers.teams.get_team_schedule", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/teams/BOS/schedule")
            assert resp.status_code == 200


class TestTeamStats:
    async def test_get_stats(self, client):
        with patch("src.routers.teams.get_team_stats", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/teams/BOS/stats")
            assert resp.status_code == 200
