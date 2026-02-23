"""Tests for sport_suite_games importer — abbreviation mapping."""

from __future__ import annotations

from src.importers.sport_suite_games import ABBREV_MAP, normalize_abbrev


class TestNormalizeAbbrev:
    def test_gsw_to_gs(self):
        assert normalize_abbrev("GSW") == "GS"

    def test_was_to_wsh(self):
        assert normalize_abbrev("WAS") == "WSH"

    def test_nyk_to_ny(self):
        assert normalize_abbrev("NYK") == "NY"

    def test_nop_to_no(self):
        assert normalize_abbrev("NOP") == "NO"

    def test_nor_to_no(self):
        assert normalize_abbrev("NOR") == "NO"

    def test_sas_to_sa(self):
        assert normalize_abbrev("SAS") == "SA"

    def test_pho_to_phx(self):
        assert normalize_abbrev("PHO") == "PHX"

    def test_uth_to_uta(self):
        assert normalize_abbrev("UTH") == "UTA"

    def test_passthrough(self):
        assert normalize_abbrev("BOS") == "BOS"
        assert normalize_abbrev("LAL") == "LAL"


class TestAbbrevMap:
    def test_all_mappings_present(self):
        assert len(ABBREV_MAP) == 8
