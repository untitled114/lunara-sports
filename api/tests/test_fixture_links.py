"""Captured ESPN files keep the data the tests read and drop ESPN's navigation menus: the
`links` lists point to ESPN's own pages and no test reads them."""

import json
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def _has_links(o) -> bool:
    if isinstance(o, dict):
        return "links" in o or any(_has_links(v) for v in o.values())
    if isinstance(o, list):
        return any(_has_links(v) for v in o)
    return False


def test_no_captured_espn_file_carries_navigation_links():
    with_links = sorted(
        f.name for f in FIXTURES.glob("espn_*.json") if _has_links(json.loads(f.read_text()))
    )
    assert with_links == []
