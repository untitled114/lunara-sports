"""Root test conftest — unify the ``src`` namespace.

Both ``api/src/`` and ``ingestion/src/`` expose a top-level ``src`` package.
When pytest collects all test files, whichever ``src`` gets imported first
shadows the other, causing ``ModuleNotFoundError`` for submodules that live
in the *other* package (e.g. ``src.kafka`` in api vs ``src.resilience`` in
ingestion).

Fix: add both parent dirs to ``sys.path`` early, import ``src``, then extend
``src.__path__`` so Python can resolve submodules from *either* location.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

_api_dir = str(ROOT / "api")
_ing_dir = str(ROOT / "ingestion")

# Ensure both parent dirs are on sys.path so ``import src`` works
for d in (_api_dir, _ing_dir):
    if d not in sys.path:
        sys.path.insert(0, d)

# Now import src (whichever location wins) and extend its __path__
import src  # noqa: E402

_api_src = str(ROOT / "api" / "src")
_ing_src = str(ROOT / "ingestion" / "src")

for p in (_ing_src, _api_src):
    if p not in src.__path__:
        src.__path__.append(p)
