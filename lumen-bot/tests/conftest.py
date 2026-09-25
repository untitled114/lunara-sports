"""Shared fixtures for lumen-bot characterization tests.

The bot module doesn't exist as an installed package — tests add the
lumen-bot directory to sys.path so `import formatter`, `import brain`, etc.
work the same way the real bot process imports them.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from game_context import GameState, PickContext  # noqa: E402


@pytest.fixture(autouse=True)
def _isolate_default_game_log_dir(tmp_path, monkeypatch):
    """`WSListener()` and `Lumen.on_ready()` construct `GameLogRecorder()`
    with no arguments, which defaults to the relative path
    `game_log.DEFAULT_LOG_DIR` ("logs/game_context") — the same directory
    Sport-Suite ingests as ML training data (see game_log.py's module
    docstring). Any test that builds a real WSListener/Lumen without
    patching the game log must never let that default `mkdir`/write land in
    the actual repo tree.

    Running every test from an isolated `tmp_path` cwd guarantees that: the
    relative default path resolves under `tmp_path`, never under the real
    lumen-bot directory. See test_ws_listener.py's
    `test_default_relative_log_dir_never_touches_repo_cwd` for a test that
    asserts this directly.
    """
    monkeypatch.chdir(tmp_path)


@pytest.fixture
def game() -> GameState:
    """A live game, midway through the 3rd quarter."""
    g = GameState(game_id="401", home_team="BOS", away_team="NYK")
    g.home_score, g.away_score, g.quarter, g.clock, g.status = 55, 50, 3, "6:00", "live"
    return g


@pytest.fixture
def pick() -> PickContext:
    """A single unresolved OVER pick, matching the real PickContext signature
    (pick_id, player_name, team, opponent_team, market, line, prediction, tier,
    model_version, book, is_home are all required — no defaults)."""
    return PickContext(
        pick_id=1,
        player_name="Jayson Tatum",
        team="BOS",
        opponent_team="NYK",
        market="POINTS",
        line=26.5,
        prediction="OVER",
        tier="X",
        model_version="v3",
        book="DraftKings",
        is_home=True,
    )
