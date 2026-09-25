"""Tests for the URL override implemented by Task 13's `settings` module.

`settings.resolve_lunara_urls(config, environ) -> tuple[str, str]` lets environment
values win over `config["lunara"]`.
"""

CFG = {"lunara": {"api_url": "https://old.run.app", "ws_url": "wss://old.run.app/ws"}}


def test_env_overrides_config():
    from settings import resolve_lunara_urls

    env = {"LUNARA_API_URL": "http://127.0.0.1:8010", "LUNARA_WS_URL": "ws://127.0.0.1:8010/ws"}
    assert resolve_lunara_urls(CFG, env) == ("http://127.0.0.1:8010", "ws://127.0.0.1:8010/ws")


def test_config_used_when_env_absent():
    from settings import resolve_lunara_urls

    assert resolve_lunara_urls(CFG, {}) == ("https://old.run.app", "wss://old.run.app/ws")


def test_blank_env_does_not_override():
    from settings import resolve_lunara_urls

    assert resolve_lunara_urls(CFG, {"LUNARA_API_URL": "  "})[0] == "https://old.run.app"
