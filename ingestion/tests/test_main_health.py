"""Characterization tests for __main__.py's health server and CLI entry point."""

from __future__ import annotations

import asyncio
import contextlib
import runpy
import socket
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.__main__ import health_server


def _free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


@pytest.mark.asyncio
async def test_health_server_answers_200_on_configured_port(monkeypatch):
    """health_server() binds PORT (on the default loopback host) and answers
    any request with a bare HTTP/1.1 200 OK."""
    port = _free_port()
    monkeypatch.setenv("PORT", str(port))
    monkeypatch.delenv("HEALTH_HOST", raising=False)

    task = asyncio.create_task(health_server())
    try:
        reader = writer = None
        for _ in range(50):
            try:
                reader, writer = await asyncio.open_connection("127.0.0.1", port)
                break
            except (ConnectionRefusedError, OSError):
                await asyncio.sleep(0)
        assert writer is not None, "health server never started listening"

        writer.write(b"GET / HTTP/1.1\r\n\r\n")
        await writer.drain()
        data = await reader.read(1024)
        writer.close()

        assert data == b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK"
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


async def _bind_args(monkeypatch, **env):
    """Run health_server() against a stubbed start_server; return (host, port)."""
    for k in ("PORT", "HEALTH_HOST"):
        monkeypatch.delenv(k, raising=False)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    with patch("src.__main__.asyncio.start_server", new_callable=AsyncMock) as mock_start:
        mock_server = AsyncMock()
        mock_server.serve_forever = AsyncMock()
        mock_server.__aenter__ = AsyncMock(return_value=mock_server)
        mock_server.__aexit__ = AsyncMock(return_value=False)
        mock_start.return_value = mock_server
        await health_server()
    mock_start.assert_awaited_once()
    mock_server.serve_forever.assert_awaited_once()
    _, host, port = mock_start.await_args.args
    return host, port


@pytest.mark.asyncio
async def test_health_server_defaults_to_loopback_port_8080(monkeypatch):
    """No PORT / HEALTH_HOST → 127.0.0.1:8080 (R21: never 0.0.0.0 by default;
    on sport-suite-main 8080 on all interfaces collides with Airflow)."""
    assert await _bind_args(monkeypatch) == ("127.0.0.1", 8080)


@pytest.mark.asyncio
async def test_health_server_honours_health_host_and_port(monkeypatch):
    """HEALTH_HOST / PORT override the bind (TEST-NET address; start_server
    is stubbed because binding a non-local address would fail)."""
    got = await _bind_args(monkeypatch, HEALTH_HOST="192.0.2.1", PORT="9123")
    assert got == ("192.0.2.1", 9123)


@pytest.mark.asyncio
async def test_main_returns_once_run_returns_and_stops_the_health_server():
    """SIGTERM → run() returns → main() must return too (else systemd waits
    TimeoutStopSec and SIGKILLs): the health server task is cancelled."""
    from src.__main__ import main

    started, cancelled = asyncio.Event(), asyncio.Event()

    async def forever_health_server():
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    async def fake_run():
        await started.wait()

    with (
        patch("src.__main__.health_server", forever_health_server),
        patch("src.__main__.run", fake_run),
    ):
        await asyncio.wait_for(main(), timeout=2)
    assert cancelled.is_set()


@pytest.mark.asyncio
async def test_main_returns_after_shutdown_is_set_with_the_real_run():
    """End to end: shutdown already set → run() closes the IO and main()
    returns with the health server still 'serving forever'."""
    from src.__main__ import main

    sink = MagicMock()
    sink.close = AsyncMock()
    http = AsyncMock()
    event = MagicMock()
    event.is_set.return_value = True

    async def forever_health_server():
        await asyncio.Event().wait()

    with (
        patch("src.__main__.health_server", forever_health_server),
        patch("src.__main__.Settings"),
        patch("src.__main__.build_io", new_callable=AsyncMock, return_value=(sink, http)),
        patch("src.__main__.ScoreboardCollector", return_value=AsyncMock()),
        patch("src.__main__.asyncio.Event", return_value=event),
        patch("src.__main__.asyncio.get_running_loop"),
    ):
        await asyncio.wait_for(main(), timeout=2)
    sink.close.assert_awaited_once()
    http.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_main_propagates_run_failure_and_still_stops_health_server():
    from src.__main__ import main

    started, cancelled = asyncio.Event(), asyncio.Event()

    async def forever_health_server():
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    async def failing_run():
        await started.wait()
        raise OSError("db unreachable")

    with (
        patch("src.__main__.health_server", forever_health_server),
        patch("src.__main__.run", failing_run),
        pytest.raises(OSError, match="db unreachable"),
    ):
        await asyncio.wait_for(main(), timeout=2)
    assert cancelled.is_set()


@pytest.mark.asyncio
async def test_main_logs_a_failed_health_server_and_still_returns(capsys):
    """A health server that died (e.g. port in use) is logged at shutdown,
    not raised over run()'s outcome."""
    from src.__main__ import main

    async def broken_health_server():
        raise OSError("address already in use")

    async def fake_run():
        await asyncio.sleep(0)

    with (
        patch("src.__main__.health_server", broken_health_server),
        patch("src.__main__.run", fake_run),
    ):
        await asyncio.wait_for(main(), timeout=2)
    assert "ingestion.health_server_failed" in capsys.readouterr().out


def test_module_guard_runs_main():
    """`if __name__ == "__main__": asyncio.run(main())`. asyncio.run is
    mocked so main() is never driven here (it is covered above)."""
    with patch("asyncio.run") as mock_run:
        runpy.run_module("src.__main__", run_name="__main__")
    mock_run.assert_called_once()
    (coro,) = mock_run.call_args.args
    assert coro.cr_code.co_name == "main"
    coro.close()
