#!/usr/bin/env python3
"""Cephalon Lumen — Lunara Sports Discord Bot.

Subscribes to Lunara's WebSocket feed and DMs the owner
with live NBA pick updates: morning summary, approaching-line
alerts, and hit/miss results.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import discord
import httpx
import yaml

from formatter import PickFormatter
from ws_listener import WSListener

log = logging.getLogger("lumen")


def setup_logging() -> None:
    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(fmt)
    root.addHandler(handler)

    logging.getLogger("discord.gateway").setLevel(logging.WARNING)
    logging.getLogger("discord.http").setLevel(logging.WARNING)
    logging.getLogger("websockets").setLevel(logging.WARNING)


class Lumen(discord.Client):
    def __init__(self, config: dict) -> None:
        intents = discord.Intents.default()
        super().__init__(intents=intents)

        self.config = config
        self.owner_id: int = config["discord"]["owner_id"]
        self.api_url: str = config["lunara"]["api_url"]
        self.ws_url: str = config["lunara"]["ws_url"]
        self.alert_cfg: dict = config.get("alerts", {})
        self.start_time = datetime.now(timezone.utc)
        self.formatter = PickFormatter()
        self._ws_listener: WSListener | None = None
        self._listener_task: asyncio.Task | None = None

    async def on_ready(self) -> None:
        log.info("Lumen online — %s (ID: %s)", self.user, self.user.id)
        await self.change_presence(
            activity=discord.Activity(
                type=discord.ActivityType.watching,
                name="live picks",
            )
        )

        # Start health server for Cloud Run
        asyncio.create_task(self._health_server())

        # Start WebSocket listener
        self._ws_listener = WSListener(
            api_url=self.api_url,
            ws_url=self.ws_url,
            alert_cfg=self.alert_cfg,
            send_dm=self._send_dm,
            formatter=self.formatter,
        )
        self._listener_task = asyncio.create_task(self._ws_listener.run())
        log.info("WebSocket listener started")

        # Atlas fleet heartbeat
        if os.environ.get("ATLAS_HEARTBEAT_SECRET"):
            asyncio.create_task(self._atlas_heartbeat())

    async def _send_dm(self, content: str | None = None, embed: discord.Embed | None = None):
        """Send a DM to the owner."""
        try:
            user = await self.fetch_user(self.owner_id)
            if user:
                await user.send(content=content, embed=embed)
        except discord.Forbidden:
            log.warning("Cannot DM owner — DMs may be disabled")
        except Exception:
            log.exception("Failed to send DM")

    async def _health_server(self) -> None:
        """Minimal HTTP server so Cloud Run knows we're alive."""
        port = int(os.environ.get("PORT", "8080"))

        async def handle(reader, writer):
            await reader.read(1024)
            writer.write(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK")
            await writer.drain()
            writer.close()

        server = await asyncio.start_server(handle, "0.0.0.0", port)
        log.info("Health server listening on :%d", port)
        async with server:
            await server.serve_forever()

    async def _atlas_heartbeat(self) -> None:
        """Send periodic heartbeat to Cephalon Atlas fleet monitor."""
        await self.wait_until_ready()
        secret = os.environ.get("ATLAS_HEARTBEAT_SECRET", "")
        url = "http://localhost:8100/heartbeat"
        log.info("Atlas heartbeat sender started")

        while not self.is_closed():
            try:
                uptime = int((datetime.now(timezone.utc) - self.start_time).total_seconds())
                active_games = len(self._ws_listener._game_tasks) if self._ws_listener else 0
                payload = {
                    "secret": secret,
                    "bot": "lumen",
                    "status": "ok",
                    "uptime": uptime,
                    "active_games": active_games,
                }
                async with httpx.AsyncClient() as client:
                    await client.post(url, json=payload, timeout=5.0)
            except Exception:
                pass
            await asyncio.sleep(60)

    async def close(self) -> None:
        if self._listener_task:
            self._listener_task.cancel()
        if self._ws_listener:
            await self._ws_listener.stop()
        await super().close()


def main() -> None:
    setup_logging()

    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path) as f:
        config = yaml.safe_load(f)

    token = os.environ.get("DISCORD_TOKEN", config.get("discord", {}).get("token", ""))
    if not token:
        log.error("DISCORD_TOKEN env var not set")
        sys.exit(1)

    bot = Lumen(config)
    bot.run(token, log_handler=None)


if __name__ == "__main__":
    main()
