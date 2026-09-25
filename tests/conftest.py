"""Root test conftest — load each service's ``src`` package under its own name.

``api/src`` and ``ingestion/src`` are both a top-level package called ``src``,
so they cannot share one interpreter under that name. Cross-service tests here
import them through explicit aliases instead:

- ``api_src``       -> ``api/src``
- ``ingestion_src`` -> ``ingestion/src``

Each alias is built with ``importlib`` from the package's ``__init__.py`` and
registered in ``sys.modules``; submodules then resolve through that package's
own ``__path__`` (relative imports work). Neither ``src`` directory is put on
``sys.path``, so ``ingestion/src/http`` can never shadow the stdlib ``http``,
and nothing here touches the per-service unit suites (``cd api && pytest``
etc. never load this file).

Only modules that use relative imports (all of ``api/src``) or none at all
(``ingestion/src/sinks/postgres.py``) are importable through an alias.
Ingestion modules that do ``from src.x import ...`` are not, by design.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parents[1]

ALIASES: dict[str, Path] = {
    "api_src": ROOT / "api" / "src",
    "ingestion_src": ROOT / "ingestion" / "src",
}


def load_alias(alias: str, pkg_dir: Path) -> ModuleType:
    """Import the package at ``pkg_dir`` as top-level module ``alias`` (idempotent)."""
    existing = sys.modules.get(alias)
    if existing is not None:
        return existing
    spec = importlib.util.spec_from_file_location(
        alias, pkg_dir / "__init__.py", submodule_search_locations=[str(pkg_dir)]
    )
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {pkg_dir} as {alias}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[alias] = module
    try:
        spec.loader.exec_module(module)
    except BaseException:
        sys.modules.pop(alias, None)
        raise
    return module


for _alias, _dir in ALIASES.items():
    load_alias(_alias, _dir)
