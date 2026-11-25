"""Comments router - post and list game comments."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Game, User
from ..db.session import get_session
from ..models.schemas import CommentCreate, CommentResponse
from ..services.auth_deps import get_current_user
from ..services.comment_service import create_comment, get_game_comments

router = APIRouter(prefix="/games", tags=["comments"])


@router.post("/{game_id}/comments", response_model=CommentResponse, status_code=201)
async def post_comment(
    game_id: str,
    body: CommentCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Post a comment on a game."""
    if await session.get(Game, game_id) is None:
        raise HTTPException(status_code=404, detail="Game not found")
    comment = await create_comment(
        session,
        user_id=str(user.id),
        game_id=game_id,
        body=body.body,
        play_id=body.play_id,
    )
    return CommentResponse.from_orm_comment(comment)


@router.get("/{game_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    game_id: str,
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    """List recent comments for a game."""
    rows = await get_game_comments(session, game_id, limit=limit)
    return [CommentResponse.from_orm_comment(c) for c in rows]
