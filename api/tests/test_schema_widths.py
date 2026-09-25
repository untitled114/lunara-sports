"""ORM column widths must hold ESPN's 4-letter abbreviations (Utah is "UTAH")."""

from __future__ import annotations

from src.db.models import Base


def _team_columns():
    for table in Base.metadata.sorted_tables:
        for column in table.columns:
            if "team" in column.name and getattr(column.type, "length", None) is not None:
                yield table.name, column


def test_every_team_abbrev_column_fits_utah():
    too_narrow = [
        f"{table}.{col.name}({col.type.length})"
        for table, col in _team_columns()
        if col.type.length < len("UTAH")
    ]
    assert too_narrow == []


def test_play_team_matches_migration_013():
    plays = Base.metadata.tables["plays"]
    assert plays.c.team.type.length == 5
