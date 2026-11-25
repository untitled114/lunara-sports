"""ESPN team ID <-> abbreviation mapping for NBA teams."""

# ESPN internal team IDs mapped to standard abbreviations
ESPN_TEAM_IDS: dict[str, int] = {
    "ATL": 1,
    "BOS": 2,
    "BKN": 17,
    "CHA": 30,
    "CHI": 4,
    "CLE": 5,
    "DAL": 6,
    "DEN": 7,
    "DET": 8,
    "GS": 9,
    "HOU": 10,
    "IND": 11,
    "LAC": 12,
    "LAL": 13,
    "MEM": 29,
    "MIA": 14,
    "MIL": 15,
    "MIN": 16,
    "NO": 3,
    "NY": 18,
    "OKC": 25,
    "ORL": 19,
    "PHI": 20,
    "PHX": 21,
    "POR": 22,
    "SAC": 23,
    "SA": 24,
    "TOR": 28,
    "UTA": 26,
    "WSH": 27,
}

ABBREV_BY_ESPN_ID: dict[int, str] = {v: k for k, v in ESPN_TEAM_IDS.items()}


def espn_id_for(abbrev: str) -> int | None:
    """Get ESPN team ID from abbreviation."""
    return ESPN_TEAM_IDS.get(abbrev)


# ESPN scoreboard abbreviations that differ from PBP
_ESPN_TO_PBP: dict[str, str] = {
    "UTAH": "UTA",
    "GS": "GS",  # same
    "SA": "SA",  # same
    "NY": "NY",  # same
    "NO": "NO",  # same
    # Defensive: long-form abbreviations ESPN's live endpoints don't currently
    # send (confirmed against captured scoreboard/standings fixtures), but that
    # match the NBA-style convention - normalize them the same way if
    # ESPN ever does.
    "GSW": "GS",
    "WAS": "WSH",
    "NYK": "NY",
    "NOP": "NO",
    "SAS": "SA",
}


def from_espn_abbrev(espn_abbrev: str) -> str:
    """Convert ESPN scoreboard/standings abbreviation to play-by-play format."""
    return _ESPN_TO_PBP.get(espn_abbrev, espn_abbrev)
