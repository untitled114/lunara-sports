"""Lumen runtime settings — environment overrides config.yaml."""

from __future__ import annotations

from collections.abc import Mapping


def resolve_lunara_urls(config: dict, environ: Mapping[str, str]) -> tuple[str, str]:
    lun = config.get("lunara", {})
    api = (environ.get("LUNARA_API_URL") or "").strip() or lun["api_url"]
    ws = (environ.get("LUNARA_WS_URL") or "").strip() or lun["ws_url"]
    return api, ws
