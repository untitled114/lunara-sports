"""Tests for team_logos — ESPN CDN logo population."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.team_logos import _LOGO_SLUGS, populate_team_logos


class TestLogoSlugs:
    def test_30_teams(self):
        assert len(_LOGO_SLUGS) == 30

    def test_all_lowercase(self):
        for slug in _LOGO_SLUGS.values():
            assert slug == slug.lower()


@pytest.mark.asyncio
class TestPopulateTeamLogos:
    async def test_no_factory(self):
        with patch("src.services.team_logos.get_session_factory", return_value=None):
            await populate_team_logos()  # should not raise

    async def test_updates_logos(self):
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_factory = MagicMock(return_value=mock_ctx)

        with patch("src.services.team_logos.get_session_factory", return_value=mock_factory):
            await populate_team_logos()
            assert mock_session.execute.call_count == 30

    async def test_handles_error(self):
        mock_factory = MagicMock(side_effect=Exception("db error"))
        with patch("src.services.team_logos.get_session_factory", return_value=mock_factory):
            await populate_team_logos()  # should not raise
