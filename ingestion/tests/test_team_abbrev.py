"""Tests for team_abbrev — ESPN abbreviation normalization.

This table is a deliberate duplicate of api/src/services/team_mapping.py's
`_ESPN_TO_PBP` (ingestion has no import path into the API package — see
team_abbrev.py's module docstring). These tests pin ingestion's copy to the
same values the API's own `test_team_mapping.py::TestFromEspnAbbrev` pins,
so a drift between the two packages' tables is caught by CI in either repo.
"""

from src.team_abbrev import normalize_abbrev


class TestNormalizeAbbrev:
    def test_utah_to_uta(self):
        assert normalize_abbrev("UTAH") == "UTA"

    def test_gsw_to_gs(self):
        assert normalize_abbrev("GSW") == "GS"

    def test_was_to_wsh(self):
        assert normalize_abbrev("WAS") == "WSH"

    def test_nyk_to_ny(self):
        assert normalize_abbrev("NYK") == "NY"

    def test_nop_to_no(self):
        assert normalize_abbrev("NOP") == "NO"

    def test_sas_to_sa(self):
        assert normalize_abbrev("SAS") == "SA"

    def test_unknown_passthrough(self):
        assert normalize_abbrev("BOS") == "BOS"

    def test_gs_passthrough(self):
        assert normalize_abbrev("GS") == "GS"
