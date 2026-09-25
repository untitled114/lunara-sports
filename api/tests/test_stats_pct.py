"""Tests for stats_service — the retired team stats list (leaders: test_stat_leaders_season.py)."""

from __future__ import annotations

from src.services.stats_service import get_team_stats_list


class TestGetTeamStatsList:
    """Team stats leaderboard has no data source since the Sport-suite DB
    pools were retired (owner-approved) — always empty."""

    async def test_always_empty(self):
        result = await get_team_stats_list()
        assert result == []
