"""ESPN team abbreviation normalization.

Ingestion is a standalone package (no import path into the API package), so this
small table is a deliberate, separately-maintained duplicate of
``api/src/services/team_mapping.py``'s ``_ESPN_TO_PBP`` table. If ESPN changes an
abbreviation, or a new long-form/short-form pair turns up, update BOTH files, and
both packages' ``test_utah_to_uta``-style pinning tests keep them honest.

Without this, ESPN's raw abbreviations (e.g. "UTAH" for the Jazz) end up written
into ``games``/``plays`` by the collectors while the API writes the canonical
short form ("UTA") for the same team — two spellings of one team in the same DB.
"""

from __future__ import annotations

# ESPN abbreviations that differ from the canonical (API/play-by-play) form.
# Mirrors api/src/services/team_mapping.py's `_ESPN_TO_PBP` — keep both in sync.
_ESPN_TO_CANONICAL: dict[str, str] = {
    "UTAH": "UTA",
    "GSW": "GS",
    "WAS": "WSH",
    "NYK": "NY",
    "NOP": "NO",
    "SAS": "SA",
}


def normalize_abbrev(espn_abbrev: str) -> str:
    """Convert an ESPN team abbreviation to the canonical form games/plays use."""
    return _ESPN_TO_CANONICAL.get(espn_abbrev, espn_abbrev)
