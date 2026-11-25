"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the API service.

    Values are read from environment variables (case-insensitive) and can be
    overridden via a `.env` file placed next to the running process.
    """

    database_url: str = "postgresql+asyncpg://playbyplay:dev_password@localhost:5432/playbyplay"
    redis_url: str = "redis://localhost:6379/0"

    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # JWT auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_days: int = 7

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
