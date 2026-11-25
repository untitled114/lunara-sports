"""LOG_LEVEL decides which structlog levels reach the log (default INFO)."""

import pytest
import structlog

from src.logging_setup import configure_logging


@pytest.fixture(autouse=True)
def _reset_structlog():
    yield
    structlog.reset_defaults()


def _emit(capsys):
    log = structlog.get_logger("t")
    log.debug("debug-line")
    log.info("info-line")
    return capsys.readouterr().out


def test_default_level_drops_debug(monkeypatch, capsys):
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    configure_logging()
    out = _emit(capsys)
    assert "info-line" in out
    assert "debug-line" not in out


def test_debug_level_keeps_debug(monkeypatch, capsys):
    monkeypatch.setenv("LOG_LEVEL", "debug")
    configure_logging()
    out = _emit(capsys)
    assert "debug-line" in out
    assert "info-line" in out


def test_unknown_level_falls_back_to_info(monkeypatch, capsys):
    monkeypatch.setenv("LOG_LEVEL", "chatty")
    configure_logging()
    out = _emit(capsys)
    assert "info-line" in out
    assert "debug-line" not in out
