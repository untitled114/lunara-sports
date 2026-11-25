"""HTTP clients for the ESPN API."""

from __future__ import annotations

import importlib

from .espn import EspnHttp

OPTIONAL_TRANSPORT = f"{__name__}.transport"


def build_http() -> EspnHttp:
    """The ESPN client the service shares.

    A deployment may ship an optional transport module (``OPTIONAL_TRANSPORT``) whose
    ``build()`` returns the client instead; without it, the plain client is used.
    """
    try:
        module = importlib.import_module(OPTIONAL_TRANSPORT)
    except ModuleNotFoundError as e:
        if e.name != OPTIONAL_TRANSPORT:
            raise
        return EspnHttp()
    return module.build()
