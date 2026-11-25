"""The root conftest's service aliases (runs without a database)."""

from __future__ import annotations

import http
import importlib.util
import sys
import sysconfig
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_aliases_point_at_each_service_package():
    import api_src.ws.play_poller as poller
    import ingestion_src.sinks.postgres as sink

    assert Path(poller.__file__).is_relative_to(ROOT / "api" / "src")
    assert Path(sink.__file__).is_relative_to(ROOT / "ingestion" / "src")


def test_stdlib_http_is_not_shadowed_by_ingestion_http():
    import ingestion_src.http  # noqa: F401 - loaded under the alias, not as ``http``

    stdlib = Path(sysconfig.get_paths()["stdlib"]).resolve()
    assert Path(http.__file__).resolve().is_relative_to(stdlib)
    assert sys.modules["http"] is http
    assert "ingestion_src.http" in sys.modules


def test_no_bare_src_package_is_importable():
    assert importlib.util.find_spec("src") is None
