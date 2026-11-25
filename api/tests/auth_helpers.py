"""Signed-in requests in tests: a real JWT for a user id, as the API issues it."""

from __future__ import annotations

from src.services.auth_service import create_access_token

SEEDED_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"  # conftest.py::seeded_session's user


def bearer(user_id: str = SEEDED_USER_ID, tier: str = "free") -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user_id), tier)}"}
