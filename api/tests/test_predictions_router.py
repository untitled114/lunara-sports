"""Tests for predictions router — submit and retrieve user predictions."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch


class TestSubmitPrediction:
    async def test_submit_success(self, client):
        mock_pred = MagicMock()
        mock_pred.id = uuid.uuid4()
        mock_pred.user_id = uuid.uuid4()
        mock_pred.game_id = "401810001"
        mock_pred.prediction_type = "winner"
        mock_pred.prediction_value = "BOS"
        mock_pred.is_correct = None
        mock_pred.points_awarded = 0
        mock_pred.created_at = datetime.now(timezone.utc)
        mock_pred.resolved_at = None

        with (
            patch(
                "src.routers.predictions.create_prediction",
                new_callable=AsyncMock,
                return_value=mock_pred,
            ),
            patch("src.routers.predictions.get_producer", return_value=None),
        ):
            resp = await client.post(
                "/predictions/",
                json={
                    "game_id": "401810001",
                    "prediction_type": "winner",
                    "prediction_value": "BOS",
                },
                headers={"x-user-id": str(uuid.uuid4())},
            )
            assert resp.status_code == 201

    async def test_submit_duplicate(self, client):
        from sqlalchemy.exc import IntegrityError

        with patch(
            "src.routers.predictions.create_prediction",
            new_callable=AsyncMock,
            side_effect=IntegrityError("dup", {}, None),
        ):
            resp = await client.post(
                "/predictions/",
                json={
                    "game_id": "401810001",
                    "prediction_type": "winner",
                    "prediction_value": "BOS",
                },
                headers={"x-user-id": str(uuid.uuid4())},
            )
            assert resp.status_code == 409

    async def test_submit_with_kafka(self, client):
        mock_pred = MagicMock()
        mock_pred.id = uuid.uuid4()
        mock_pred.user_id = uuid.uuid4()
        mock_pred.game_id = "401810001"
        mock_pred.prediction_type = "winner"
        mock_pred.prediction_value = "BOS"
        mock_pred.is_correct = None
        mock_pred.points_awarded = 0
        mock_pred.created_at = datetime.now(timezone.utc)
        mock_pred.resolved_at = None

        mock_producer = MagicMock()
        with (
            patch(
                "src.routers.predictions.create_prediction",
                new_callable=AsyncMock,
                return_value=mock_pred,
            ),
            patch("src.routers.predictions.get_producer", return_value=mock_producer),
        ):
            resp = await client.post(
                "/predictions/",
                json={
                    "game_id": "401810001",
                    "prediction_type": "winner",
                    "prediction_value": "BOS",
                },
                headers={"x-user-id": str(uuid.uuid4())},
            )
            assert resp.status_code == 201
            mock_producer.produce.assert_called_once()


class TestGetUserPredictions:
    async def test_get_predictions(self, client):
        with patch(
            "src.routers.predictions.get_user_predictions", new_callable=AsyncMock, return_value=[]
        ):
            user_id = str(uuid.uuid4())
            resp = await client.get(f"/predictions/{user_id}")
            assert resp.status_code == 200
            assert resp.json() == []
