"""Authentication router — register, login, profile."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import User
from ..db.session import get_session
from ..services.auth_deps import get_current_user
from ..services.auth_service import authenticate, create_access_token, register

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user_id: str
    username: str
    membership_tier: str


class ProfileResponse(BaseModel):
    id: str
    username: str
    email: str | None
    display_name: str | None
    membership_tier: str
    prediction_score: int


@router.post("/register", response_model=AuthResponse)
async def register_user(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_session),
):
    """Create a new user account and return a JWT."""
    try:
        user = await register(session, body.username, body.email, body.password)
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=409, detail="Username or email already taken") from None
        raise

    token = create_access_token(str(user.id), user.membership_tier)
    return AuthResponse(
        token=token,
        user_id=str(user.id),
        username=user.username,
        membership_tier=user.membership_tier,
    )


@router.post("/login", response_model=AuthResponse)
async def login_user(
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    """Authenticate and return a JWT."""
    user = await authenticate(session, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user.id), user.membership_tier)
    return AuthResponse(
        token=token,
        user_id=str(user.id),
        username=user.username,
        membership_tier=user.membership_tier,
    )


@router.get("/me", response_model=ProfileResponse)
async def get_profile(user: User = Depends(get_current_user)):
    """Return the current user's profile."""
    return ProfileResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        membership_tier=user.membership_tier,
        prediction_score=user.prediction_score,
    )
