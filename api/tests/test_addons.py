"""The add-on hook: core runs alone, and add-ons plug in without core naming them."""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import APIRouter, FastAPI

from src import addons
from src.main import lifespan, mount_addon_routers

SRC = Path(__file__).resolve().parent.parent / "src"


def test_load_addons_imports_each_subpackage_in_name_order():
    found = addons.load_addons()
    assert all(isinstance(m, ModuleType) for m in found)
    names = [m.__name__ for m in found]
    assert names == sorted(names)
    assert all(n.startswith("src.addons.") for n in names)
    for m in found:
        assert isinstance(m.routers, list)
        assert callable(m.background_tasks)


def test_load_addons_with_no_subpackages_is_empty(tmp_path):
    with patch.object(addons, "__path__", [str(tmp_path)]):
        assert addons.load_addons() == []


def test_core_modules_never_name_an_addon():
    """Only the add-on loader knows add-ons exist; core code stays generic."""
    addon_names = [p.name for p in (SRC / "addons").iterdir() if (p / "__init__.py").exists()]
    for path in SRC.rglob("*.py"):
        rel = path.relative_to(SRC)
        if rel.parts[0] == "addons" and len(rel.parts) > 2:
            continue
        text = path.read_text()
        for name in addon_names:
            assert f"addons.{name}" not in text, f"{rel} imports add-on {name}"


async def test_lifespan_runs_and_cancels_addon_tasks():
    started = asyncio.Event()
    cancelled = asyncio.Event()

    async def addon_task():
        started.set()
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            cancelled.set()
            raise

    fake = SimpleNamespace(routers=[], background_tasks=lambda: [addon_task()])
    with (
        patch("src.main.ADDONS", [fake]),
        patch("src.main.Settings", MagicMock()),
        patch("src.main.init_db", MagicMock()),
        patch("src.main.create_tables", AsyncMock()),
        patch("src.main.seed_teams", AsyncMock()),
        patch("src.main.init_redis", AsyncMock()),
        patch("src.main.init_espn_client", MagicMock()),
        patch("src.main.populate_team_logos", AsyncMock()),
        patch("src.main.close_espn_client", AsyncMock()),
        patch("src.main.close_redis", AsyncMock()),
        patch("src.main.close_db", AsyncMock()),
        patch("src.main.run_play_poller", AsyncMock()),
        patch("src.main.run_scoreboard_poller", AsyncMock()),
    ):
        async with lifespan(FastAPI()):
            await asyncio.wait_for(started.wait(), 1)
        assert cancelled.is_set()


def test_mount_addon_routers_mounts_every_router():
    first, second = APIRouter(), APIRouter()

    @first.get("/one")
    def one():
        return 1

    @second.get("/two")
    def two():
        return 2

    target = FastAPI()
    mount_addon_routers(
        target, [SimpleNamespace(routers=[first]), SimpleNamespace(routers=[second])]
    )
    assert {"/one", "/two"} <= set(target.openapi()["paths"])
