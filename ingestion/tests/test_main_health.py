"""Characterization tests for __main__.py's health server and CLI entry point."""

from __future__ import annotations

import asyncio
import contextlib
import runpy
import socket
from unittest.mock import AsyncMock, patch

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
    """health_server() (lines 142-154) binds PORT and answers any request with
    a bare HTTP/1.1 200 OK — the Cloud Run health check contract."""
    port = _free_port()
    monkeypatch.setenv("PORT", str(port))

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


@pytest.mark.asyncio
async def test_health_server_defaults_to_port_8080(monkeypatch):
    """No PORT env var → defaults to 8080 (line 144)."""
    monkeypatch.delenv("PORT", raising=False)
    with patch("src.__main__.asyncio.start_server", new_callable=AsyncMock) as mock_start:
        mock_server = AsyncMock()
        mock_server.serve_forever = AsyncMock()
        mock_server.__aenter__ = AsyncMock(return_value=mock_server)
        mock_server.__aexit__ = AsyncMock(return_value=False)
        mock_start.return_value = mock_server
        await health_server()
    mock_start.assert_awaited_once()
    _, host, port = mock_start.await_args.args
    assert host == "0.0.0.0"
    assert port == 8080


def test_module_guard_runs_main_which_gathers_health_server_and_run():
    """`if __name__ == "__main__":` defines main() and calls
    asyncio.run(main()) (lines 157-162). asyncio.gather is mocked so the two
    real infinite loops (health_server, run) are never actually driven —
    each is characterized on its own elsewhere — but main()'s own body
    (the await asyncio.gather(...) line) genuinely executes here.
    """
    with patch("asyncio.gather", new_callable=AsyncMock) as mock_gather:
        runpy.run_module("src.__main__", run_name="__main__")
    mock_gather.assert_awaited_once()
    health_coro, run_coro = mock_gather.await_args.args
    assert health_coro.cr_code.co_name == "health_server"
    assert run_coro.cr_code.co_name == "run"
    health_coro.close()
    run_coro.close()
