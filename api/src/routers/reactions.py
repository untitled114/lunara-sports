"""Reactions router — add/remove emoji reactions on plays."""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..kafka.producer import get_producer
from ..models.schemas import ReactionCount, ReactionCreate, ReactionResponse
from ..services.reaction_service import (
    create_reaction,
    delete_reaction,
    get_play_game_id,
    get_reaction_counts,
)

router = APIRouter(prefix="/plays", tags=["reactions"])


@router.post("/{play_id}/reactions", response_model=ReactionResponse, status_code=201)
async def add_reaction(
    play_id: int,
    body: ReactionCreate,
    x_user_id: str = Header(description="Authenticated user ID"),
    session: AsyncSession = Depends(get_session),
):
    """Add an emoji reaction to a play."""
    try:
        reaction = await create_reaction(session, x_user_id, play_id, body.emoji)
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Already reacted to this play") from exc

    # Publish to Kafka for WS broadcast
    producer = get_producer()
    if producer is not None:
        game_id = await get_play_game_id(session, play_id)
        producer.produce(
            "user.reactions",
            f"{x_user_id}:{play_id}",
            {
                "play_id": play_id,
                "game_id": game_id,
                "user_id": x_user_id,
                "emoji": body.emoji,
                "action": "add",
            },
        )

    return ReactionResponse.from_orm_reaction(reaction)


@router.delete("/{play_id}/reactions", status_code=204)
async def remove_reaction(
    play_id: int,
    x_user_id: str = Header(description="Authenticated user ID"),
    session: AsyncSession = Depends(get_session),
):
    """Remove the current user's reaction from a play."""
    removed = await delete_reaction(session, x_user_id, play_id)
    if not removed:
        raise HTTPException(status_code=404, detail="No reaction found")

    producer = get_producer()
    if producer is not None:
        game_id = await get_play_game_id(session, play_id)
        producer.produce(
            "user.reactions",
            f"{x_user_id}:{play_id}",
            {
                "play_id": play_id,
                "game_id": game_id,
                "user_id": x_user_id,
                "action": "remove",
            },
        )


@router.get("/{play_id}/reactions", response_model=list[ReactionCount])
async def list_reactions(
    play_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Return emoji counts for a play."""
    return await get_reaction_counts(session, play_id)
