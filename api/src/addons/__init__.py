"""Optional add-ons: extra routers and background tasks, found at startup.

An add-on is a subpackage of this package that exposes:

- ``routers``: a list of FastAPI routers to mount;
- ``background_tasks()``: a list of coroutines to run for the app's lifetime.

Importing the subpackage also registers its ORM models on the shared ``Base``, so
``create_tables`` sees them. With no subpackages present the API runs with its core
routers and pollers only.
"""

from __future__ import annotations

import importlib
import pkgutil
from types import ModuleType


def load_addons() -> list[ModuleType]:
    """Import every add-on subpackage, in name order."""
    return [
        importlib.import_module(f"{__name__}.{info.name}")
        for info in sorted(pkgutil.iter_modules(__path__), key=lambda i: i.name)
        if info.ispkg
    ]
