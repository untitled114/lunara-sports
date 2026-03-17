"""Game Log Recorder — captures timestamped game context for ML training.

Records snapshots of game state + pick context at key moments (quarter ends,
halftime, pick state changes) as JSONL files. Sport-Suite V4 can ingest these
to train models that understand in-game dynamics:
  - How pace at halftime correlates with final stat totals
  - How blowouts affect star player minutes
  - Score-differential impact on stat accumulation rates

Output: One JSONL file per game date in logs/game_context/
"""

from __future__ import annotations

import json
import logging
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from game_context import GameState, PickContext

log = logging.getLogger("lumen.gamelog")

# Default log directory
DEFAULT_LOG_DIR = "logs/game_context"


def _eastern_today() -> date:
    utc_now = datetime.now(timezone.utc)
    et_now = utc_now - timedelta(hours=5)
    return et_now.date()


class GameLogRecorder:
    """Appends game context snapshots to daily JSONL files."""

    def __init__(self, log_dir: str = DEFAULT_LOG_DIR) -> None:
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self._current_date: date | None = None
        self._file_handle = None

    def _get_file(self):
        today = _eastern_today()
        if today != self._current_date:
            self._close()
            self._current_date = today
            path = self.log_dir / f"game_context_{today.isoformat()}.jsonl"
            self._file_handle = open(path, "a")
            log.info("Game log opened: %s", path)
        return self._file_handle

    def _close(self):
        if self._file_handle:
            self._file_handle.close()
            self._file_handle = None

    def record_game_snapshot(self, game: GameState, event: str) -> None:
        """Record a full game state snapshot with all pick contexts."""
        record = {
            "ts": time.time(),
            "event": event,
            "game_id": game.game_id,
            "home_team": game.home_team,
            "away_team": game.away_team,
            "home_score": game.home_score,
            "away_score": game.away_score,
            "score_diff": game.score_diff,
            "status": game.status,
            "quarter": game.quarter,
            "clock": game.clock,
            "game_minutes_elapsed": round(game.game_minutes_elapsed, 1),
            "is_blowout": game.is_blowout,
            "is_garbage_time": game.is_garbage_time,
            "phase": game.phase.name,
            "picks": [self._pick_snapshot(ctx, game) for ctx in game.picks.values()],
        }
        self._write(record)

    def record_pick_update(self, game: GameState, ctx: PickContext, event: str) -> None:
        """Record a single pick update with game context."""
        record = {
            "ts": time.time(),
            "event": event,
            "game_id": game.game_id,
            "home_score": game.home_score,
            "away_score": game.away_score,
            "score_diff": game.score_diff,
            "quarter": game.quarter,
            "clock": game.clock,
            "game_minutes_elapsed": round(game.game_minutes_elapsed, 1),
            "is_blowout": game.is_blowout,
            "pick": self._pick_snapshot(ctx, game),
        }
        self._write(record)

    def _pick_snapshot(self, ctx: PickContext, game: GameState) -> dict:
        """Serialize a pick context for the log — rich data for V4 training."""
        bs = ctx.box_score
        return {
            "pick_id": ctx.pick_id,
            "player_name": ctx.player_name,
            "team": ctx.team,
            "opponent_team": ctx.opponent_team,
            "market": ctx.market,
            "line": ctx.line,
            "prediction": ctx.prediction,
            "tier": ctx.tier,
            "model_version": ctx.model_version,
            "book": ctx.book,
            "is_home": ctx.is_home,
            "actual_value": ctx.actual_value,
            "is_hit": ctx.is_hit,
            "pace_projection": ctx.latest_pace,
            "comfort_level": ctx.comfort_level,
            "score_diff_team": game.score_diff_for_team(ctx.team),
            "snapshots_count": len(ctx.snapshots),
            # Box score context (V4 training features)
            "player_minutes": bs.minutes,
            "fouls": bs.fouls,
            "fg_made": bs.fg_made,
            "fg_attempted": bs.fg_attempted,
            "three_made": bs.three_made,
            "three_attempted": bs.three_attempted,
            "ft_made": bs.ft_made,
            "ft_attempted": bs.ft_attempted,
            "plus_minus": bs.plus_minus,
            "starter": bs.starter,
            "season_avg": ctx.season_avg,
        }

    def _write(self, record: dict) -> None:
        try:
            f = self._get_file()
            if f:
                f.write(json.dumps(record, default=str) + "\n")
                f.flush()
        except Exception:
            log.exception("Failed to write game log record")

    def close(self) -> None:
        self._close()
