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

    # Sport-suite predictions directory (deprecated — use API instead)
    sport_suite_predictions_dir: str = ""

    # Sport-suite API (cloud-safe pick sync — takes precedence over predictions dir)
    sport_suite_api_url: str = ""
    sport_suite_api_key: str = ""

    # Local-directory OLAP export (Parquet for V4 model retraining). Empty disables the poller.
    olap_export_dir: str = ""

    # JWT auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_days: int = 7

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
