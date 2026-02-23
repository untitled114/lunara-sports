"""Predictions router — submit and retrieve user predictions."""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..kafka.producer import get_producer
from ..models.schemas import PredictionCreate, PredictionResponse
from ..services.prediction_service import (
    create_prediction,
    get_user_predictions,
)

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("/", response_model=PredictionResponse, status_code=201)
async def submit_prediction(
    prediction: PredictionCreate,
    x_user_id: str = Header(description="Authenticated user ID"),
    session: AsyncSession = Depends(get_session),
):
    """Submit a prediction for a game outcome."""
    try:
        result = await create_prediction(
            session,
            user_id=x_user_id,
            game_id=prediction.game_id,
            prediction_type=prediction.prediction_type,
            prediction_value=prediction.prediction_value,
        )
    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="Prediction already exists for this user/game/type",
        )

    # Publish to Kafka for downstream processing
    producer = get_producer()
    if producer is not None:
        producer.produce("user.predictions", f"{x_user_id}:{prediction.game_id}", {
            "prediction_id": str(result.id),
            "user_id": x_user_id,
            "game_id": prediction.game_id,
            "prediction_type": prediction.prediction_type,
            "prediction_value": prediction.prediction_value,
        })

    return PredictionResponse.from_orm_prediction(result)


@router.get("/{user_id}", response_model=list[PredictionResponse])
async def user_predictions(
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Return all predictions for a given user."""
    rows = await get_user_predictions(session, user_id)
    return [PredictionResponse.from_orm_prediction(r) for r in rows]
