"""ESPN team ID ↔ abbreviation mapping for NBA teams."""

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

# Map Sport-suite abbreviations to play-by-play abbreviations
SPORT_SUITE_TO_PBP: dict[str, str] = {
    "GSW": "GS",
    "WAS": "WSH",
    "NYK": "NY",
    "NOP": "NO",
    "NOR": "NO",
    "SAS": "SA",
    "PHO": "PHX",
    "UTH": "UTA",
}

PBP_TO_SPORT_SUITE: dict[str, str] = {v: k for k, v in SPORT_SUITE_TO_PBP.items()}


def espn_id_for(abbrev: str) -> int | None:
    """Get ESPN team ID from abbreviation."""
    return ESPN_TEAM_IDS.get(abbrev)


def abbrev_for_espn_id(espn_id: int) -> str | None:
    """Get abbreviation from ESPN team ID."""
    return ABBREV_BY_ESPN_ID.get(espn_id)


def to_sport_suite_abbrev(pbp_abbrev: str) -> str:
    """Convert play-by-play abbreviation to Sport-suite format."""
    return PBP_TO_SPORT_SUITE.get(pbp_abbrev, pbp_abbrev)


def from_sport_suite_abbrev(ss_abbrev: str) -> str:
    """Convert Sport-suite abbreviation to play-by-play format."""
    return SPORT_SUITE_TO_PBP.get(ss_abbrev, ss_abbrev)


# ESPN scoreboard abbreviations that differ from PBP
_ESPN_TO_PBP: dict[str, str] = {
    "UTAH": "UTA",
    "GS": "GS",   # same
    "SA": "SA",    # same
    "NY": "NY",    # same
    "NO": "NO",    # same
}


def from_espn_abbrev(espn_abbrev: str) -> str:
    """Convert ESPN scoreboard abbreviation to play-by-play format."""
    return _ESPN_TO_PBP.get(espn_abbrev, espn_abbrev)
