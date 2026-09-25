"""EspnHttp — direct ESPN with IPRoyal fallback (Task 9)."""

from __future__ import annotations

import httpx
import pytest
import respx

from src.http.espn import BLOCK_STATUSES, EspnHttp

pytestmark = pytest.mark.asyncio
URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary"


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def _route_both(http: EspnHttp, direct_status: int, proxy_status: int = 200):
    """Direct and proxied clients get separate respx mocks."""
    d = respx.MockRouter(assert_all_called=False)
    d.get(URL).mock(return_value=httpx.Response(direct_status, json={"via": "direct"}))
    p = respx.MockRouter(assert_all_called=False)
    p.get(URL).mock(return_value=httpx.Response(proxy_status, json={"via": "proxy"}))
    http._direct = httpx.AsyncClient(transport=httpx.MockTransport(d.handler))
    if http._proxied is not None:
        http._proxied = httpx.AsyncClient(transport=httpx.MockTransport(p.handler))
    return d, p


async def test_direct_success_uses_direct_only():
    http = EspnHttp("http://user:pw@proxy.iproyal.com:12321")
    _route_both(http, 200)
    r = await http.get(URL, params={"event": "1"})
    assert r.json() == {"via": "direct"} and not http.via_proxy


@pytest.mark.parametrize("status", sorted(BLOCK_STATUSES))
async def test_blocked_request_is_retried_via_proxy(status):
    http = EspnHttp("http://p", trigger_failures=3)
    _route_both(http, status)
    r = await http.get(URL)
    assert r.json() == {"via": "proxy"}
    assert not http.via_proxy  # one block is not enough to switch everything


async def test_consecutive_blocks_switch_to_proxy_for_cooldown():
    clock = Clock()
    http = EspnHttp("http://p", trigger_failures=3, cooldown_seconds=300, clock=clock)
    d, _ = _route_both(http, 403)
    for _ in range(3):
        await http.get(URL)
    assert http.via_proxy
    calls_before = d.calls.call_count
    await http.get(URL)
    assert d.calls.call_count == calls_before  # direct not tried during cooldown
    clock.t += 301
    await http.get(URL)
    assert d.calls.call_count == calls_before + 1  # probe direct after cooldown


async def test_direct_success_after_probe_resets_state():
    clock = Clock()
    http = EspnHttp("http://p", trigger_failures=2, cooldown_seconds=10, clock=clock)
    _route_both(http, 403)
    await http.get(URL)
    await http.get(URL)
    assert http.via_proxy
    clock.t += 11
    _route_both(http, 200)
    r = await http.get(URL)
    assert r.json() == {"via": "direct"} and not http.via_proxy


async def test_transport_error_falls_back_to_proxy():
    http = EspnHttp("http://p")
    _route_both(http, 200)

    def boom(request):
        raise httpx.ConnectError("reset", request=request)

    http._direct = httpx.AsyncClient(transport=httpx.MockTransport(boom))
    r = await http.get(URL)
    assert r.json() == {"via": "proxy"}


async def test_no_proxy_configured_returns_blocked_response():
    # Review Focus #4
    http = EspnHttp("")
    _route_both(http, 403)
    r = await http.get(URL)
    assert r.status_code == 403 and not http.via_proxy


async def test_no_proxy_configured_reraises_transport_error():
    http = EspnHttp("")

    def boom(request):
        raise httpx.ReadTimeout("slow", request=request)

    http._direct = httpx.AsyncClient(transport=httpx.MockTransport(boom))
    with pytest.raises(httpx.ReadTimeout):
        await http.get(URL)


async def test_proxy_also_blocked_returns_proxy_response_without_loop():
    # Review Focus #4
    http = EspnHttp("http://p")
    _, p = _route_both(http, 403, proxy_status=403)
    r = await http.get(URL)
    assert r.status_code == 403 and p.calls.call_count == 1


async def test_never_sends_browser_user_agent():
    http = EspnHttp("http://p")
    seen = []

    def capture(request):
        seen.append(request.headers.get("user-agent", ""))
        return httpx.Response(200, json={})

    http._direct = httpx.AsyncClient(transport=httpx.MockTransport(capture))
    await http.get(URL)
    assert seen and "Mozilla" not in seen[0]


async def test_default_clients_send_no_browser_ua_and_accept_gzip():
    http = EspnHttp("http://p")
    for c in (http._direct, http._proxied):
        assert "Mozilla" not in c.headers.get("user-agent", "")
        assert "gzip" in c.headers.get("accept-encoding", "")
    await http.aclose()


async def test_aclose_closes_both_clients():
    http = EspnHttp("http://p")
    await http.aclose()
    assert http._direct.is_closed and http._proxied.is_closed


async def test_aclose_without_proxy():
    http = EspnHttp("")
    assert http._proxied is None
    await http.aclose()
    assert http._direct.is_closed
