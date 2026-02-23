"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the API service.

    Values are read from environment variables (case-insensitive) and can be
    overridden via a `.env` file placed next to the running process.
    """

    database_url: str = "postgresql+asyncpg://playbyplay:dev_password@localhost:5432/playbyplay"
    redis_url: str = "redis://localhost:6379/0"
    kafka_bootstrap_servers: str = "localhost:9092"
    schema_registry_url: str = "http://localhost:8081"

    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Sport-suite database credentials (optional, for enrichment)
    sport_suite_db_user: str = ""
    sport_suite_db_password: str = ""
    sport_suite_db_host: str = "localhost"

    # Sport-suite predictions directory (empty = disabled)
    sport_suite_predictions_dir: str = ""

    # JWT auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_days: int = 7

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
