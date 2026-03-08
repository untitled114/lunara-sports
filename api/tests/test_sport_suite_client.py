"""Tests for sport_suite_client — pick result feedback to Sport-Suite."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.sport_suite_client import post_pick_result


@pytest.mark.asyncio
class TestPostPickResult:
    async def test_returns_true_on_200(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client = AsyncMock()
        mock_client.patch = AsyncMock(return_value=mock_response)

        with patch("src.services.sport_suite_client.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await post_pick_result(
                "https://api.sport-suite.internal", "key-123", "uuid-abc", 28.0, True
            )

        assert result is True
        mock_client.patch.assert_called_once()
        call_kwargs = mock_client.patch.call_args
        assert call_kwargs[1]["json"] == {"actual_value": 28.0, "is_hit": True, "source": "lunara"}

    async def test_returns_false_on_non_200(self):
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_client = AsyncMock()
        mock_client.patch = AsyncMock(return_value=mock_response)

        with patch("src.services.sport_suite_client.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await post_pick_result(
                "https://api.sport-suite.internal", "key-123", "uuid-abc", 28.0, True
            )

        assert result is False

    async def test_returns_false_on_exception(self):
        mock_client = AsyncMock()
        mock_client.patch = AsyncMock(side_effect=Exception("timeout"))

        with patch("src.services.sport_suite_client.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await post_pick_result(
                "https://api.sport-suite.internal", "key-123", "uuid-abc", 28.0, True
            )

        assert result is False
