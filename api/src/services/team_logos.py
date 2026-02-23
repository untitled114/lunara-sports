"""Populate team logo URLs from ESPN CDN at startup."""

from __future__ import annotations

import structlog
from sqlalchemy import text

from ..db.session import get_session_factory

logger = structlog.get_logger(__name__)

# ESPN CDN logo URL pattern: https://a.espncdn.com/i/teamlogos/nba/500/{slug}.png
# Slug is the lowercase ESPN abbreviation for the team
_LOGO_SLUGS: dict[str, str] = {
    "ATL": "atl",
    "BOS": "bos",
    "BKN": "bkn",
    "CHA": "cha",
    "CHI": "chi",
    "CLE": "cle",
    "DAL": "dal",
    "DEN": "den",
    "DET": "det",
    "GS": "gs",
    "HOU": "hou",
    "IND": "ind",
    "LAC": "lac",
    "LAL": "lal",
    "MEM": "mem",
    "MIA": "mia",
    "MIL": "mil",
    "MIN": "min",
    "NO": "no",
    "NY": "ny",
    "OKC": "okc",
    "ORL": "orl",
    "PHI": "phi",
    "PHX": "phx",
    "POR": "por",
    "SAC": "sac",
    "SA": "sa",
    "TOR": "tor",
    "UTA": "uta",
    "WSH": "wsh",
}

_CDN_BASE = "https://a.espncdn.com/i/teamlogos/nba/500"


async def populate_team_logos() -> None:
    """Update teams table with ESPN CDN logo URLs (idempotent)."""
    factory = get_session_factory()
    if not factory:
        return

    try:
        async with factory() as session:
            updated = 0
            for abbrev, slug in _LOGO_SLUGS.items():
                url = f"{_CDN_BASE}/{slug}.png"
                result = await session.execute(
                    text("""
                        UPDATE teams SET logo_url = :url
                        WHERE abbrev = :abbrev AND (logo_url IS NULL OR logo_url = '')
                    """),
                    {"url": url, "abbrev": abbrev},
                )
                updated += result.rowcount
            await session.commit()
            if updated:
                logger.info("team_logos.populated", updated=updated)
    except Exception as e:
        logger.warning("team_logos.failed", error=str(e))
