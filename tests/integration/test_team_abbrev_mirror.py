"""Pins ingestion's and the API's ESPN-team-abbreviation tables together.

Ingestion (``ingestion/src/team_abbrev.py``) deliberately duplicates the API's
mapping (``api/src/services/team_mapping.py``'s ``_ESPN_TO_PBP``) because the two
are separate, non-importing packages (see D13 and each file's module docstring).
Nothing else enforces that the two tables stay equal, so a future edit to one
without the other would silently reintroduce the UTAH/UTA split this pair fixed.

This test parses both files with ``ast`` rather than importing them: it runs in
the shared integration venv, which never installs either service's own ``src``
package (see the root conftest / test_aliases.py), and it must not care about
either module's other imports or runtime behavior — only its literal dict.
"""

from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

API_TEAM_MAPPING = ROOT / "api" / "src" / "services" / "team_mapping.py"
INGESTION_TEAM_ABBREV = ROOT / "ingestion" / "src" / "team_abbrev.py"


def _extract_str_dict(path: Path, var_name: str) -> dict[str, str]:
    """Extract a module-level ``VAR_NAME: dict[str, str] = {...}`` literal by name.

    Handles both a plain assignment and an annotated one (``AnnAssign``, which is
    what both source files actually use) so this doesn't depend on either module
    matching the other's exact declaration style.
    """
    tree = ast.parse(path.read_text())
    for node in ast.walk(tree):
        target = None
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
        elif isinstance(node, ast.AnnAssign):
            target = node.target

        if not (isinstance(target, ast.Name) and target.id == var_name):
            continue
        if not isinstance(node.value, ast.Dict):
            continue

        result: dict[str, str] = {}
        for key_node, value_node in zip(
            node.value.keys, node.value.values, strict=True
        ):
            key = ast.literal_eval(key_node)
            value = ast.literal_eval(value_node)
            result[key] = value
        return result

    raise AssertionError(f"no dict literal named {var_name!r} found in {path}")


def test_ingestion_and_api_espn_abbrev_tables_are_pinned_together():
    api_table = _extract_str_dict(API_TEAM_MAPPING, "_ESPN_TO_PBP")
    ingestion_table = _extract_str_dict(INGESTION_TEAM_ABBREV, "_ESPN_TO_CANONICAL")

    # Identity entries ("GS": "GS") document intent but carry no normalization
    # meaning, and the two files don't (and needn't) list the same identity
    # entries — only the actual renames have to match.
    api_renames = {k: v for k, v in api_table.items() if k != v}
    ingestion_renames = {k: v for k, v in ingestion_table.items() if k != v}

    assert api_renames == ingestion_renames
    assert api_renames, "sanity: the tables must not both be empty"
    assert api_renames["UTAH"] == "UTA"  # the live bug this test exists to guard
