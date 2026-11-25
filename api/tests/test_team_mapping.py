"""Tests for team_mapping - abbreviation conversions."""

from src.services.team_mapping import (
    ESPN_TEAM_IDS,
    espn_id_for,
    from_espn_abbrev,
)


class TestEspnIdFor:
    def test_known_team(self):
        assert espn_id_for("BOS") == 2

    def test_unknown_team(self):
        assert espn_id_for("XXX") is None


class TestFromEspnAbbrev:
    def test_utah_to_uta(self):
        assert from_espn_abbrev("UTAH") == "UTA"

    def test_gs_passthrough(self):
        assert from_espn_abbrev("GS") == "GS"

    def test_unknown_passthrough(self):
        assert from_espn_abbrev("BOS") == "BOS"

    def test_gsw_to_gs(self):
        assert from_espn_abbrev("GSW") == "GS"

    def test_was_to_wsh(self):
        assert from_espn_abbrev("WAS") == "WSH"

    def test_nyk_to_ny(self):
        assert from_espn_abbrev("NYK") == "NY"

    def test_nop_to_no(self):
        assert from_espn_abbrev("NOP") == "NO"

    def test_sas_to_sa(self):
        assert from_espn_abbrev("SAS") == "SA"


class TestTeamIds:
    def test_30_teams(self):
        assert len(ESPN_TEAM_IDS) == 30

    def test_all_ids_unique(self):
        ids = list(ESPN_TEAM_IDS.values())
        assert len(ids) == len(set(ids))
