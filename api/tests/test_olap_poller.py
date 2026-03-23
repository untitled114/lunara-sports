"""Tests for the OLAP poller — nightly Parquet export to GCS."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.olap_poller import _export_date, _seconds_until_midnight_et, run_olap_poller


class TestSecondsUntilMidnightET:
    def test_returns_positive(self):
        result = _seconds_until_midnight_et()
        assert result >= 60

    def test_at_least_60_seconds(self):
        result = _seconds_until_midnight_et()
        assert result >= 60


class TestExportDate:
    async def test_skips_when_no_factory(self):
        with patch("src.services.olap_poller.get_session_factory", return_value=None):
            await _export_date("my-bucket", date(2026, 3, 20))

    async def test_exports_successfully(self):
        mock_session = AsyncMock()
        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("src.services.olap_poller.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.olap_poller.export_picks_for_date",
                new_callable=AsyncMock,
                return_value=5,
            ),
        ):
            await _export_date("my-bucket", date(2026, 3, 20))

    async def test_handles_export_error(self):
        mock_session = AsyncMock()
        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("src.services.olap_poller.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.olap_poller.export_picks_for_date",
                new_callable=AsyncMock,
                side_effect=Exception("GCS down"),
            ),
        ):
            # Should not raise — error is caught and logged
            await _export_date("my-bucket", date(2026, 3, 20))

    async def test_no_rows_exported(self):
        mock_session = AsyncMock()
        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("src.services.olap_poller.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.olap_poller.export_picks_for_date",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            await _export_date("my-bucket", date(2026, 3, 20))


class TestRunOlapPoller:
    async def test_skips_when_no_bucket(self):
        settings = MagicMock()
        settings.gcs_olap_bucket = ""
        await run_olap_poller(settings)

    async def test_skips_when_no_settings(self):
        await run_olap_poller(None)
