"""EspnHttp: the plain ESPN client, and how the service chooses its client."""

from __future__ import annotations

import sys

import httpx
import pytest

from src.http import OPTIONAL_TRANSPORT, build_http
from src.http.espn import EspnHttp

pytestmark = pytest.mark.asyncio
URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary"


async def test_get_passes_url_and_params_through():
    http = EspnHttp()
    seen = []

    def capture(request):
        seen.append(str(request.url))
        return httpx.Response(200, json={"ok": True})

    http._direct = httpx.AsyncClient(transport=httpx.MockTransport(capture))
    r = await http.get(URL, params={"event": "1"})
    assert r.json() == {"ok": True}
    assert seen == [URL + "?event=1"]
    await http.aclose()


async def test_never_sends_browser_user_agent():
    http = EspnHttp()
    seen = []

    def capture(request):
        seen.append(request.headers.get("user-agent", ""))
        return httpx.Response(200, json={})

    http._direct = httpx.AsyncClient(transport=httpx.MockTransport(capture))
    await http.get(URL)
    assert seen and "Mozilla" not in seen[0]
    await http.aclose()


async def test_default_client_sends_no_browser_ua_and_accepts_gzip():
    http = EspnHttp()
    assert "Mozilla" not in http._direct.headers.get("user-agent", "")
    assert "gzip" in http._direct.headers.get("accept-encoding", "")
    await http.aclose()
    assert http._direct.is_closed


async def test_build_http_without_the_optional_transport_is_the_plain_client(monkeypatch):
    monkeypatch.setitem(sys.modules, OPTIONAL_TRANSPORT, None)
    http = build_http()
    try:
        assert type(http) is EspnHttp
    finally:
        await http.aclose()


async def test_build_http_does_not_hide_a_broken_transport(monkeypatch):
    import importlib

    def broken(name):
        raise ModuleNotFoundError("No module named 'missing_dep'", name="missing_dep")

    monkeypatch.setattr(importlib, "import_module", broken)
    with pytest.raises(ModuleNotFoundError):
        build_http()


async def test_build_http_uses_the_optional_transport_when_present(monkeypatch):
    from types import SimpleNamespace

    client = object()
    monkeypatch.setitem(sys.modules, OPTIONAL_TRANSPORT, SimpleNamespace(build=lambda: client))
    assert build_http() is client
