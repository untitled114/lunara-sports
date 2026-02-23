"""Tests for team_mapping — abbreviation conversions."""

from src.services.team_mapping import (
    ESPN_TEAM_IDS,
    abbrev_for_espn_id,
    espn_id_for,
    from_espn_abbrev,
    from_sport_suite_abbrev,
    to_sport_suite_abbrev,
)


class TestEspnIdFor:
    def test_known_team(self):
        assert espn_id_for("BOS") == 2

    def test_unknown_team(self):
        assert espn_id_for("XXX") is None


class TestAbbrevForEspnId:
    def test_known_id(self):
        assert abbrev_for_espn_id(2) == "BOS"

    def test_unknown_id(self):
        assert abbrev_for_espn_id(999) is None


class TestSportSuiteAbbrev:
    def test_gsw_to_gs(self):
        assert from_sport_suite_abbrev("GSW") == "GS"

    def test_was_to_wsh(self):
        assert from_sport_suite_abbrev("WAS") == "WSH"

    def test_nyk_to_ny(self):
        assert from_sport_suite_abbrev("NYK") == "NY"

    def test_nop_to_no(self):
        assert from_sport_suite_abbrev("NOP") == "NO"

    def test_sas_to_sa(self):
        assert from_sport_suite_abbrev("SAS") == "SA"

    def test_passthrough(self):
        assert from_sport_suite_abbrev("BOS") == "BOS"


class TestToPbpAbbrev:
    def test_gs_to_gsw(self):
        assert to_sport_suite_abbrev("GS") == "GSW"

    def test_wsh_to_was(self):
        assert to_sport_suite_abbrev("WSH") == "WAS"

    def test_passthrough(self):
        assert to_sport_suite_abbrev("BOS") == "BOS"


class TestFromEspnAbbrev:
    def test_utah_to_uta(self):
        assert from_espn_abbrev("UTAH") == "UTA"

    def test_gs_passthrough(self):
        assert from_espn_abbrev("GS") == "GS"

    def test_unknown_passthrough(self):
        assert from_espn_abbrev("BOS") == "BOS"


class TestTeamIds:
    def test_30_teams(self):
        assert len(ESPN_TEAM_IDS) == 30

    def test_all_ids_unique(self):
        ids = list(ESPN_TEAM_IDS.values())
        assert len(ids) == len(set(ids))
