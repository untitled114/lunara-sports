"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the ingestion service.

    Values are read from environment variables (case-insensitive) and can be
    overridden via a `.env` file placed next to the running process.
    """

    kafka_bootstrap_servers: str = "localhost:9092"
    espn_base_url: str = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
    espn_poll_interval_seconds: int = 30
    espn_date: str | None = None  # Override date: YYYYMMDD format, None = today/next

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
