"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the ingestion service.

    Values are read from environment variables (case-insensitive) and can be
    overridden via a `.env` file placed next to the running process.
    """

    # Postgres DSN the PostgresSink writes games/plays to — required.
    database_url: str

    espn_base_url: str = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
    espn_poll_interval_seconds: int = 5
    espn_date: str | None = None  # Override date: YYYYMMDD format, None = ESPN's current slate

    # EspnHttp: direct first; after `proxy_trigger_failures` consecutive
    # blocks (403/429/transport error) route via this proxy for
    # `proxy_cooldown_seconds`. Empty = no proxy fallback.
    espn_proxy_url: str = ""
    proxy_trigger_failures: int = 3
    proxy_cooldown_seconds: float = 300.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
