# Lunara Backend → Oracle Cloud Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lunara's backend runs on OCI sport-suite-main, with live play-by-play working end to end (for the first time), direct ESPN polling with an IPRoyal fallback, and 99.1% line+branch coverage on every Python service.

**Architecture:**
- **One event path:** ESPN → ingestion (`EventSink` → Postgres) → API (`play_poller` + scoreboard poller) → WebSocket.
- **Retired:** Kafka, Pub/Sub and both stream processors.
- **Hosting:** everything runs as systemd services under user `lunara`, in `/opt/lunara`, behind nginx and Cloudflare. It shares the existing Postgres 16 instance (new `lunara` database) and gets its own Redis.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy async + asyncpg, httpx, Redis 7, Postgres 16 (TimescaleDB container on 5500), systemd, nginx, Cloudflare DNS, pytest + pytest-cov + respx.

**Spec:** `docs/superpowers/specs/2026-09-24-lunara-oci-migration-design.md`

## Global Constraints

**Coverage and tooling**
- Coverage: **≥ 99.1% combined line+branch per service** (`api`, `ingestion`, `lumen-bot`), measured with `coverage.py branch = true` and enforced by `fail_under = 99.1` in each `pyproject.toml`, in pre-commit, and in CI.
- Tests first: every behavior change starts as a test.
  - New-feature tests land in Phase 1 marked `@pytest.mark.xfail(strict=True, reason="pending Task N")`.
  - The implementing task removes the marker. A strict xfail that passes early fails the suite.
- Python 3.12. Ruff `>=0.8,<0.17` with each package's explicit rule set. Pre-commit runs ruff-format.

**Commits and deletions**
- Commits: conventional (`feat|fix|refactor|test|docs|chore(scope): msg`), **no `Co-Authored-By`**.
- Deletions: only the paths listed in Task 15 (owner-approved 2026-09-24). Nothing else gets deleted.

**Runtime behavior**
- Timezone: America/New_York wherever a "today" is computed (`ZoneInfo("America/New_York")`).
- ESPN requests use httpx's default User-Agent. **Never** set a browser UA; ESPN answers 403.

**Ports and locations on sport-suite-main**

| Thing | Where |
|---|---|
| Lunara API | 127.0.0.1:**8010** |
| Redis | 127.0.0.1:**6380** |
| Postgres | 127.0.0.1:**5500**, database `lunara`, role `lunara_app` |
| Sport-suite API | 127.0.0.1:8000 — **do not touch** |
| Code | `/opt/lunara` — never under `/home/sportsuite/sport-suite` (that tree is `rsync --delete`d) |
| Secrets | only in `/etc/lunara/*.env` (0640 root:lunara) — never in git |

## Review Focus

1. **ESPN `event_type` longer than 30 chars.** `storage/postgres/migrations/003_plays.sql` declares `VARCHAR(30)`, while the ORM says 50. A long type must still insert. Migration `012` widens the column, and Task 8 tests a 45-char type.
2. **Game with a team abbreviation missing from `teams`** (All-Star, international). The foreign-key violation must skip that one game, not drop the batch or stop plays for other games. Covered by a Task 2/8 test.
3. **Postgres down or failing mid-flush.** Buffered events must be kept and retried on the next flush; no play is lost to a transient error. Covered by a Task 2/8 test.
4. **Proxy configured but also refused, or no proxy configured.** No crash and no tight loop: return the blocked response, and the existing circuit breaker backs off. Covered by a Task 3/9 test.
5. **Ingestion restart mid-game.** Collectors restart at sequence -1 and resend every play. Duplicates must be ignored (`ON CONFLICT DO NOTHING`), with no duplicate WS broadcasts. Covered by a Task 2/8 test.

---

## File Structure

| Path | Responsibility |
|---|---|
| `ingestion/src/sinks/base.py` (new) | `EventSink` Protocol: `produce()`, `async flush()`, `async close()` |
| `ingestion/src/sinks/postgres.py` (new) | `PostgresSink`: buffers events and writes games and plays with asyncpg |
| `ingestion/src/http/espn.py` (new) | `EspnHttp`: direct GET with IPRoyal fallback and proxy cooldown |
| `ingestion/src/__main__.py` (modify) | Builds one `EspnHttp` and one `PostgresSink`, injects them into collectors |
| `ingestion/src/collectors/{scoreboard,playbyplay,historical}.py` (modify) | Take `(settings, sink, http)`; `await sink.flush()` |
| `ingestion/src/config.py` (modify) | Drop kafka/pubsub; add `database_url`, `espn_proxy_url`, `proxy_trigger_failures`, `proxy_cooldown_seconds` |
| `storage/postgres/migrations/012_widen_play_event_type.sql` (new) | `plays.event_type` → `VARCHAR(50)` |
| `api/src/routers/reactions.py`, `predictions.py` (modify) | Direct WS broadcast; drop Kafka |
| `api/src/main.py`, `config.py`, `metrics.py` (modify) | No Kafka; `olap_export_dir` |
| `api/src/services/olap_exporter.py`, `olap_poller.py` (modify) | Local Parquet export |
| `lumen-bot/settings.py` (new) | `resolve_lunara_urls(config, environ)` |
| `lumen-bot/bot.py` (modify) | Uses `resolve_lunara_urls` |
| `deploy/oci/` (new) | `provision.sh`, `deploy.sh`, `lunara-api.service`, `lunara-ingestion.service`, `cephalon-lumen.service`, `nginx-api.lunara-app.com.conf`, `docker-compose.redis.yml`, `live_slate_check.py`, `README.md` |
| `deploy/tests/` (new) | pytest checks on the unit, nginx and compose files and on `live_slate_check.py` |
| `tests/integration/test_sink_to_api.py` (new) | Real Postgres: sink writes a play, then the API poller broadcasts it |

---

# Phase 1 — Tests first

### Task 1: Coverage gates (configured, not yet enforced)

**Files:**
- Modify: `api/pyproject.toml`, `ingestion/pyproject.toml`, `lumen-bot/pyproject.toml`
- Modify: `.pre-commit-config.yaml`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `[tool.coverage]` in all three packages; `fail_under` is set to its real value in Task 16, after the code gets there.

- [ ] **Step 1: Add coverage config to each package.**
  - `api/pyproject.toml` and `ingestion/pyproject.toml` get:

    ```toml
    [tool.coverage.run]
    branch = true
    source = ["src"]

    [tool.coverage.report]
    fail_under = 0      # raised to 99.1 in Task 16 once met
    show_missing = true
    skip_covered = true
    ```

  - `lumen-bot/pyproject.toml` gets:

    ```toml
    [tool.coverage.run]
    branch = true
    source = ["."]
    omit = ["tests/*", ".venv/*", "venv/*"]

    [tool.coverage.report]
    fail_under = 0      # raised to 99.1 in Task 16 once met
    show_missing = true
    skip_covered = true
    ```

- [ ] **Step 2: Pre-commit.** Replace the `pytest-api` and `pytest-ingestion` entries and add `pytest-lumen`. `fail_under` now comes from pyproject, not the hook.

  ```yaml
  - id: pytest-api
    name: pytest api (coverage gate from pyproject)
    entry: bash -c 'cd api && python3 -m pytest tests/ -q --tb=short --no-header --cov --cov-report=term-missing'
    language: system
    pass_filenames: false
    files: ^api/
  - id: pytest-ingestion
    name: pytest ingestion (coverage gate from pyproject)
    entry: bash -c 'cd ingestion && python3 -m pytest tests/ -q --tb=short --no-header --cov --cov-report=term-missing'
    language: system
    pass_filenames: false
    files: ^ingestion/
  - id: pytest-lumen
    name: pytest lumen-bot (coverage gate from pyproject)
    entry: bash -c 'cd lumen-bot && python3 -m pytest tests/ -q --tb=short --no-header --cov --cov-report=term-missing'
    language: system
    pass_filenames: false
    files: ^lumen-bot/
  ```

- [ ] **Step 3: CI.** In `python-lint-test`, change the three test steps to measure coverage:

  ```yaml
      - name: Test ingestion
        run: cd ingestion && pytest tests/ -q --cov --cov-report=term-missing
      - name: Test api
        run: cd api && pytest tests/ -q --cov --cov-report=term-missing
      - name: Test lumen-bot
        run: cd lumen-bot && pytest tests/ -q --cov --cov-report=term-missing
  ```

- [ ] **Step 4: Verify.** Run `for d in api ingestion lumen-bot; do (cd $d && pytest tests/ -q --cov | tail -1); done`.
  Expected: all pass. The printed totals are ≈95 / 77 / 40.
- [ ] **Step 5: Commit.** `git commit -am "test(ci): measure line+branch coverage in all Python services"`

---

### Task 2: `PostgresSink` tests (new behavior, strict xfail)

**Files:**
- Create: `ingestion/tests/test_postgres_sink.py`
- Modify: `ingestion/pyproject.toml` (dev deps: `asyncpg>=0.30`)

**Interfaces (implemented in Task 8):**
- `src.sinks.base.EventSink` Protocol:
  - `produce(topic: str, key: str, value: dict) -> None`
  - `async flush() -> None`
  - `async close() -> None`
- `src.sinks.postgres.PostgresSink(dsn: str, pool: asyncpg.Pool | None = None)`
  - `async connect() -> None`
  - `pending: int` (property)
  - Implements `EventSink`.
  - Topics `raw.scoreboard` (upsert `games`) and `raw.plays` (insert `plays`); any other topic raises `ValueError`.
  - Module constants `UPSERT_GAME_SQL` and `INSERT_PLAY_SQL`.

- [ ] **Step 1: Write the tests.** They use a fake pool that records `executemany` / `execute` calls and can raise on command.

```python
"""PostgresSink — ingestion writes games/plays straight to Postgres (Task 8)."""

from __future__ import annotations

from datetime import datetime, timezone

import asyncpg
import pytest

from src.sinks.postgres import INSERT_PLAY_SQL, UPSERT_GAME_SQL, PostgresSink

pytestmark = pytest.mark.xfail(strict=True, reason="pending Task 8")


class FakeConn:
    def __init__(self, fail_on: set[str] | None = None, fk_rows: set[str] | None = None):
        self.calls: list[tuple[str, list]] = []
        self.single: list[tuple[str, tuple]] = []
        self.fail_on = fail_on or set()
        self.fk_rows = fk_rows or set()

    async def executemany(self, sql, rows):
        if "games" in sql and "games" in self.fail_on:
            raise asyncpg.PostgresConnectionError("db down")
        if self.fk_rows and any(r[0] in self.fk_rows for r in rows):
            raise asyncpg.ForeignKeyViolationError("fk")
        self.calls.append((sql, list(rows)))

    async def execute(self, sql, *args):
        if args and args[0] in self.fk_rows:
            raise asyncpg.ForeignKeyViolationError("fk")
        self.single.append((sql, args))

    def transaction(self):
        conn = self

        class _Tx:
            async def __aenter__(self):
                return conn

            async def __aexit__(self, *exc):
                return False

        return _Tx()


class FakePool:
    def __init__(self, conn: FakeConn):
        self.conn = conn
        self.closed = False

    def acquire(self):
        conn = self.conn

        class _Acq:
            async def __aenter__(self):
                return conn

            async def __aexit__(self, *exc):
                return False

        return _Acq()

    async def close(self):
        self.closed = True


GAME = {
    "game_id": "401", "home_team": "BOS", "away_team": "NYK", "home_team_name": "Boston Celtics",
    "away_team_name": "New York Knicks", "home_score": 10, "away_score": 8, "status": "live",
    "status_detail": "1st 5:00", "quarter": 1, "clock": "5:00",
    "start_time": "2026-10-20T23:30:00Z", "venue": "TD Garden", "polled_at": "2026-10-20T23:35:00Z",
}
PLAY = {
    "game_id": "401", "play_id": "p1", "sequence_number": 7, "quarter": 1, "clock": "5:00",
    "event_type": "jump_shot", "event_text": "Pullup Jump Shot", "description": "X makes jumper",
    "team": "BOS", "player_name": "X", "home_score": 10, "away_score": 8,
    "scoring_play": True, "score_value": 2, "wallclock": None, "polled_at": "2026-10-20T23:35:00Z",
}


async def test_flush_upserts_games_before_plays():
    conn = FakeConn()
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.plays", "401", PLAY)
    sink.produce("raw.scoreboard", "401", GAME)
    await sink.flush()
    assert [c[0] for c in conn.calls] == [UPSERT_GAME_SQL, INSERT_PLAY_SQL]
    game_row = conn.calls[0][1][0]
    assert game_row[0] == "401" and game_row[8] == datetime(2026, 10, 20, 23, 30, tzinfo=timezone.utc)
    play_row = conn.calls[1][1][0]
    assert play_row == ("401", 7, 1, "5:00", "jump_shot", "X makes jumper", "BOS", "X", 10, 8)
    assert sink.pending == 0


async def test_upsert_game_sql_updates_live_fields_and_timestamp():
    assert "ON CONFLICT (id) DO UPDATE" in UPSERT_GAME_SQL
    for col in ("status", "home_score", "away_score", "quarter", "clock", "venue", "updated_at"):
        assert col in UPSERT_GAME_SQL


async def test_insert_play_sql_ignores_duplicates():
    # Review Focus #5: restarts resend all plays; duplicates must be ignored
    assert "ON CONFLICT (game_id, sequence_number) DO NOTHING" in INSERT_PLAY_SQL


async def test_long_event_type_is_passed_through_untruncated():
    # Review Focus #1: 45-char event types must reach the DB (migration 012 widens the column)
    conn = FakeConn()
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.plays", "401", {**PLAY, "event_type": "x" * 45})
    await sink.flush()
    assert conn.calls[0][1][0][4] == "x" * 45


async def test_fk_violation_skips_only_the_bad_game():
    # Review Focus #2: unknown team abbrev fails one row, not the batch
    conn = FakeConn(fk_rows={"999"})
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.scoreboard", "401", GAME)
    sink.produce("raw.scoreboard", "999", {**GAME, "game_id": "999", "home_team": "ASW"})
    await sink.flush()
    written = [args[0] for _sql, args in conn.single]
    assert written == ["401"]
    assert sink.pending == 0


async def test_transient_db_error_keeps_buffer_for_next_flush():
    # Review Focus #3: nothing is lost on a transient failure
    conn = FakeConn(fail_on={"games"})
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.scoreboard", "401", GAME)
    sink.produce("raw.plays", "401", PLAY)
    await sink.flush()
    assert sink.pending == 2
    conn.fail_on.clear()
    await sink.flush()
    assert sink.pending == 0 and len(conn.calls) == 2


async def test_unknown_topic_rejected():
    sink = PostgresSink("postgresql://x", pool=FakePool(FakeConn()))
    with pytest.raises(ValueError, match="unknown topic"):
        sink.produce("user.reactions", "k", {})


async def test_flush_with_nothing_pending_does_not_touch_db():
    conn = FakeConn()
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    await sink.flush()
    assert conn.calls == [] and conn.single == []


async def test_start_time_epoch_millis_and_missing_are_handled():
    conn = FakeConn()
    sink = PostgresSink("postgresql://x", pool=FakePool(conn))
    sink.produce("raw.scoreboard", "401", {**GAME, "start_time": 1792539000000})
    await sink.flush()
    assert conn.calls[0][1][0][8] == datetime.fromtimestamp(1792539000, tz=timezone.utc)
    sink.produce("raw.scoreboard", "401", {**GAME, "start_time": None})
    await sink.flush()
    assert conn.calls[1][1][0][8].tzinfo is not None


async def test_connect_creates_pool_and_close_closes_it(monkeypatch):
    created = {}

    async def fake_create_pool(dsn, min_size, max_size):
        created["args"] = (dsn, min_size, max_size)
        return FakePool(FakeConn())

    monkeypatch.setattr(asyncpg, "create_pool", fake_create_pool)
    sink = PostgresSink("postgresql://u@h:5500/lunara")
    await sink.connect()
    assert created["args"] == ("postgresql://u@h:5500/lunara", 1, 4)
    await sink.close()
    assert sink._pool.closed


async def test_flush_before_connect_raises():
    sink = PostgresSink("postgresql://x")
    sink.produce("raw.plays", "401", PLAY)
    with pytest.raises(RuntimeError, match="not connected"):
        await sink.flush()
```

- [ ] **Step 2: Run.** `cd ingestion && pytest tests/test_postgres_sink.py -q`
  Expected: `11 xfailed`. They fail with an import error until Task 8.
- [ ] **Step 3: Commit.** `git commit -am "test(ingestion): PostgresSink behavior (xfail until Task 8)"`

---

### Task 3: `EspnHttp` proxy-fallback tests (strict xfail)

**Files:**
- Create: `ingestion/tests/test_espn_http.py`

**Interfaces (implemented in Task 9):**
- `src.http.espn.EspnHttp(proxy_url: str = "", *, trigger_failures: int = 3, cooldown_seconds: float = 300.0, timeout: float = 10.0, clock: Callable[[], float] = time.monotonic)`
- `async get(url: str, params: dict | None = None) -> httpx.Response`
- `async aclose() -> None`
- `via_proxy: bool` (property)
- `BLOCK_STATUSES = frozenset({403, 429})`

- [ ] **Step 1: Write the tests.** They use `respx`. Proxy traffic is observable because EspnHttp keeps two `httpx.AsyncClient`s: `_direct` and `_proxied`. respx mocks both, and the tests tell which was used by patching the client objects.

```python
"""EspnHttp — direct ESPN with IPRoyal fallback (Task 9)."""

from __future__ import annotations

import httpx
import pytest
import respx

from src.http.espn import BLOCK_STATUSES, EspnHttp

pytestmark = pytest.mark.xfail(strict=True, reason="pending Task 9")
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
```

- [ ] **Step 2: Run.** `cd ingestion && pytest tests/test_espn_http.py -q`
  Expected: all xfailed.
- [ ] **Step 3: Commit.** `git commit -am "test(ingestion): ESPN proxy fallback behavior (xfail until Task 9)"`

---

### Task 4: Orchestrator and settings tests (strict xfail)

**Files:**
- Create: `ingestion/tests/test_main_sink_wiring.py`

**Interfaces (implemented in Task 10):**
- `src.config.Settings` fields:

  | Field | Type / default |
  |---|---|
  | `database_url` | `str` — **required, no default** |
  | `espn_base_url` | unchanged |
  | `espn_date` | unchanged |
  | `espn_proxy_url` | `str = ""` |
  | `proxy_trigger_failures` | `int = 3` |
  | `proxy_cooldown_seconds` | `float = 300.0` |

  Removed: `kafka_bootstrap_servers`, `schema_registry_url`, all `pubsub_*`.
- `src.__main__.build_io(settings) -> tuple[PostgresSink, EspnHttp]`
- `ScoreboardCollector(settings, sink, http)` and `PlayByPlayCollector(settings, sink, game_id, http)`

- [ ] **Step 1: Write the tests.**

```python
"""Ingestion wiring: one PostgresSink + one EspnHttp, no Kafka/PubSub (Task 10)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

pytestmark = pytest.mark.xfail(strict=True, reason="pending Task 10")


def test_settings_require_database_url(monkeypatch):
    from src.config import Settings

    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_have_no_kafka_or_pubsub(monkeypatch):
    from src.config import Settings

    s = Settings(_env_file=None, database_url="postgresql://x")
    for gone in ("kafka_bootstrap_servers", "schema_registry_url", "pubsub_project"):
        assert not hasattr(s, gone)
    assert s.espn_proxy_url == "" and s.proxy_trigger_failures == 3
    assert s.proxy_cooldown_seconds == 300.0


async def test_build_io_creates_connected_sink_and_shared_http():
    from src.__main__ import build_io
    from src.config import Settings

    s = Settings(_env_file=None, database_url="postgresql://x", espn_proxy_url="http://p",
                 proxy_trigger_failures=4, proxy_cooldown_seconds=60)
    with patch("src.__main__.PostgresSink") as sink_cls, patch("src.__main__.EspnHttp") as http_cls:
        sink_cls.return_value.connect = AsyncMock()
        sink, http = await build_io(s)
    sink_cls.assert_called_once_with("postgresql://x")
    sink.connect.assert_awaited_once()
    http_cls.assert_called_once_with("http://p", trigger_failures=4, cooldown_seconds=60)


async def test_collectors_share_one_http_and_flush_sink_async():
    from src.collectors.scoreboard import ScoreboardCollector
    from src.config import Settings

    s = Settings(_env_file=None, database_url="postgresql://x")
    sink, http = AsyncMock(), AsyncMock()
    sink.produce = lambda **kw: None
    http.get.return_value.json = lambda: {"events": []}
    http.get.return_value.raise_for_status = lambda: None
    c = ScoreboardCollector(s, sink, http)
    await c.poll()
    http.get.assert_awaited()
    sink.flush.assert_awaited()
```

- [ ] **Step 2: Run.** Expected: all xfailed.
- [ ] **Step 3: Commit.** `git commit -am "test(ingestion): sink/http wiring (xfail until Task 10)"`

---

### Task 5: API tests for Kafka removal and local OLAP export (strict xfail)

**Files:**
- Create: `api/tests/test_no_kafka.py`
- Create: `api/tests/test_olap_local.py`

**Interfaces (implemented in Tasks 11–12):**
- Reactions: `POST /plays/{id}/reactions` and `DELETE …` broadcast `{"type":"reaction","data":{play_id, game_id, user_id, emoji?, action}}` to the play's game room through `ws.live_feed.manager`.
- The package `src.kafka` no longer exists.
- `Settings.olap_export_dir: str = ""`; `gcs_olap_bucket` and `kafka_bootstrap_servers` are removed.
- `export_picks_for_date(session, export_date, export_dir: Path) -> int` writes `{export_dir}/model_picks/game_date=YYYY-MM-DD/picks.parquet`.

- [ ] **Step 1: Write `api/tests/test_no_kafka.py`.**

```python
"""Kafka is retired: reactions broadcast directly; nothing imports src.kafka (Task 11)."""

from __future__ import annotations

import importlib
from unittest.mock import AsyncMock, patch

import pytest

pytestmark = pytest.mark.xfail(strict=True, reason="pending Task 11")


def test_kafka_package_is_gone():
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("src.kafka")


def test_settings_have_no_kafka_or_gcs():
    from src.config import Settings

    s = Settings(_env_file=None)
    assert not hasattr(s, "kafka_bootstrap_servers")
    assert not hasattr(s, "gcs_olap_bucket")
    assert s.olap_export_dir == ""


async def test_add_reaction_broadcasts_to_game_room(client, seeded_session):
    play_id, game_id = 1, "401"
    with patch("src.routers.reactions.manager.broadcast", new_callable=AsyncMock) as bc:
        r = await client.post(f"/plays/{play_id}/reactions", json={"emoji": "🔥"},
                              headers={"X-User-Id": "u1"})
    assert r.status_code in (200, 201)
    bc.assert_awaited_once()
    room, msg = bc.await_args.args
    assert room == game_id and msg["type"] == "reaction"
    assert msg["data"] | {} == {"play_id": play_id, "game_id": game_id, "user_id": "u1",
                                "emoji": "🔥", "action": "add"}


async def test_remove_reaction_broadcasts_remove(client, seeded_session):
    await client.post("/plays/1/reactions", json={"emoji": "🔥"}, headers={"X-User-Id": "u1"})
    with patch("src.routers.reactions.manager.broadcast", new_callable=AsyncMock) as bc:
        r = await client.delete("/plays/1/reactions", headers={"X-User-Id": "u1"})
    assert r.status_code == 204
    assert bc.await_args.args[1]["data"]["action"] == "remove"


async def test_prediction_create_does_not_need_a_broker(client, seeded_session):
    r = await client.post("/predictions/", json={"game_id": "401", "prediction_type": "winner",
                                                 "prediction_value": "BOS"},
                          headers={"X-User-Id": "u1"})
    assert r.status_code in (200, 201)
```

  The executor must first confirm the seeded ids in `api/tests/conftest.py::seeded_session`: game id, play id, and whether user `u1` is valid. Adjust the literals `1`/`"401"`/`"u1"` to match the fixture, not the reverse.

- [ ] **Step 2: Write `api/tests/test_olap_local.py`.**

```python
"""OLAP export to a local directory instead of GCS (Task 12)."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pyarrow.parquet as pq
import pytest

pytestmark = pytest.mark.xfail(strict=True, reason="pending Task 12")


async def test_export_writes_partitioned_parquet(session, tmp_path: Path, monkeypatch):
    from src.services import olap_exporter

    rows = [{f.name: None for f in olap_exporter._SCHEMA}]

    async def fake_rows(_session, _date):
        return rows

    monkeypatch.setattr(olap_exporter, "_fetch_rows", fake_rows)
    n = await olap_exporter.export_picks_for_date(session, date(2026, 10, 21), tmp_path)
    out = tmp_path / "model_picks" / "game_date=2026-10-21" / "picks.parquet"
    assert n == 1 and out.exists() and pq.read_table(out).num_rows == 1


async def test_poller_disabled_without_export_dir():
    from src.config import Settings
    from src.services.olap_poller import run_olap_poller

    await run_olap_poller(Settings(_env_file=None, olap_export_dir=""))  # returns immediately
```

  The executor must confirm the helper that loads rows in `olap_exporter.py`. If it isn't named `_fetch_rows`, the refactor in Task 12 introduces `_fetch_rows(session, export_date) -> list[dict]`, extracted from the current function body.

- [ ] **Step 3: Run and commit.**
  - Run `cd api && pytest tests/test_no_kafka.py tests/test_olap_local.py -q`. Expected: xfailed.
  - `git commit -am "test(api): no-Kafka and local OLAP export (xfail until Tasks 11-12)"`

---

### Task 6: Lumen tests: URL override (xfail) and characterization to 99.1%

**Files:**
- Create: `lumen-bot/tests/conftest.py`
- Create: `lumen-bot/tests/test_settings.py`, `test_formatter.py`, `test_game_log.py`, `test_brain.py`, `test_lumen_tools.py`, `test_ws_listener.py`, `test_bot.py`

**Interfaces:**
- New, implemented in Task 13: `settings.resolve_lunara_urls(config: dict, environ: Mapping[str, str]) -> tuple[str, str]`. Environment values win over `config["lunara"]`.
- Existing modules, characterized as-is: `formatter.PickFormatter`, `game_log.GameLogRecorder`, `brain.{ConversationHistory,RateLimiter,CephalonBrain}`, `lumen_tools.{init_tools,handle_tool}`, `ws_listener.WSListener`, `bot.{Lumen,_split_message,main}`.

**Characterization rule.** Each test asserts what the code does **today**. Read the function, then assert its actual output. If a test shows a real bug, keep the test asserting the correct behavior, mark it `xfail(strict=True, reason="bug: …")`, and list the bug in the task report. Do not fix bugs inside this task.

- [ ] **Step 1: Shared builders in `tests/conftest.py`.**

```python
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from game_context import GameState, PickContext  # noqa: E402


@pytest.fixture
def game() -> GameState:
    g = GameState(game_id="401", home_team="BOS", away_team="NYK")
    g.home_score, g.away_score, g.quarter, g.clock, g.status = 55, 50, 3, "6:00", "live"
    return g


@pytest.fixture
def pick() -> PickContext:
    return PickContext(pick_id=1, player_name="Jayson Tatum", team="BOS", market="POINTS",
                       line=26.5, prediction="OVER", tier="X", game_id="401")
```

  First check the real constructor signatures of `GameState` / `PickContext` in `game_context.py` and use them. The fields above are the ones the other modules read.

- [ ] **Step 2: `tests/test_settings.py`** (strict xfail, pending Task 13).

```python
import pytest

pytestmark = pytest.mark.xfail(strict=True, reason="pending Task 13")
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
```

- [ ] **Step 3: Characterization suites.** Each needs at least the cases listed. Stop when `pytest --cov` shows that file at 100% line+branch, or document the uncovered lines as a known bug.

  **`test_formatter.py`**
  - `_v` with a present key, a missing key, and a `None` value.
  - `_comfort_bar` and `_comfort_emoji` for every comfort level they handle, plus an unknown level.
  - `_quarter_label` for 1–4 and for 5 (OT).
  - Every `PickFormatter` method:
    - `summary_embed` with 0 picks and with picks in every tier.
    - `approaching_embed`, `mid_game_hit_embed`, and `result_embed` for a hit and a miss.
    - `daily_recap_embed` with 0 picks and with mixed results.
    - `copilot_embed` for each `AlertType`.
    - `halftime_report_embed`.
    - `daily_copilot_recap`.
  - Assert on the embed's title, colour and fields, not whole-object equality.

  **`test_game_log.py`** (use `tmp_path`)
  - `_eastern_today` is the ET date (freeze time with `time-machine`).
  - `record_game_snapshot` and `record_pick_update` write one JSON line each with the expected keys.
  - The file rotates when the ET date changes: the old handle is closed and a new file is created.
  - `close()` is idempotent.

  **`test_brain.py`**
  - `ConversationHistory`: max-turns trim, TTL expiry (freeze time), `clear`.
  - `RateLimiter`: cooldown message, daily-limit message, reset on a new day.
  - `CephalonBrain`: `available` is false without `ANTHROPIC_API_KEY`.
  - `respond` against a stubbed Anthropic client:
    - a plain text reply;
    - a tool-use turn that calls `handle_tool`, then returns text;
    - `MAX_TOOL_TURNS` exhausted;
    - an API exception returns a fallback message.
  - `_extract_text` with mixed content blocks.
  - `_build_system` includes the identity and the engine context.

  **`test_lumen_tools.py`**
  - Every `handle_tool` branch (active picks, game status, pick detail, daily recap, player box score), and an unknown tool name.
  - The error path returns a `"Tool error: …"` string.
  - Behavior before `init_tools` was called.
  - `_find_pick_by_name` with a match, a partial match and no match.

  **`test_ws_listener.py`**
  - HTTP through `respx`; stub the WS connect with an async-iterator fake.
  - `_fetch_picks`: success, a non-200 status, an exception.
  - `_poll_and_subscribe` starts one listener per new game and none for known games.
  - `_listen_game`: routes `history`, `play`, `game_update` and `pick_update` messages; reconnects after `WS_RETRY_DELAY` (patch `asyncio.sleep`).
  - `_listen_scoreboard`.
  - `_handle_pick_updates`: approaching, mid-game hit, final hit, final miss, and a duplicate suppressed by `PickState`.
  - `_poll_box_scores`: success and failure (the blind-except path logs a warning).
  - `_fetch_season_stats_for_picks`: success and failure.
  - `_send_copilot_alert`.
  - `_check_daily_recap`: sends once per day.
  - `_queue_dm` / `_dm_worker` respect `DM_COOLDOWN` (patch sleep).
  - `run` / `stop` cancel their tasks.

  **`test_bot.py`**
  - `_split_message`: under the limit, exactly at the limit, and long text split on newlines.
  - `Lumen.on_message`:
    - ignores its own messages and non-DM messages;
    - replies to the owner's `status`, `picks` and `recap` commands;
    - routes free text to `brain.respond`, including the unavailable-brain path.
  - `_health_server` answers `/health` 200 (bind to port 0).
  - `_atlas_heartbeat` posts to the URL with the secret, and survives errors.
  - `close()` stops the listener.
  - `main()` exits with an error when `DISCORD_TOKEN` is unset.

- [ ] **Step 4: Run.** `cd lumen-bot && pytest tests/ -q --cov --cov-report=term-missing`
  Expected: `TOTAL ≥ 99.1%` except `bot.py`'s env-override lines, which are pending Task 13 (xfail).
- [ ] **Step 5: Commit.** `git commit -am "test(lumen): characterize all modules; URL override pending"`

---

### Task 7: Ingestion and API characterization to 99.1%

**Files:**
- Create: `ingestion/tests/test_main_health.py`, `ingestion/tests/test_scoreboard_cli.py`
- Create: `api/tests/test_gap_coverage.py`
- Modify: `api/tests/test_team_service.py`, `test_prediction_service.py`, `test_reaction_service.py`, `test_comment_service.py`

**Interfaces:** none new. Existing lines only. The exact missing lines are listed here, measured 2026-09-24 with `--cov-branch`.

- [ ] **Step 1: Ingestion.** Cover the code that survives Task 15; skip the retired `producers/*` and `importers/sport_suite_games.py`.

  | Location | Cover |
  |---|---|
  | `__main__.py:144-154` | `health_server` (answers HTTP 200 on a free port) |
  | `__main__.py:159-162` | `main()` |
  | `__main__.py:97-98, 113-122` | scoreboard/pbp loop exception paths |
  | `__main__.py:127, 138` | shutdown path |
  | `collectors/scoreboard.py:80-81, 151-156, 180-211` | the standalone `main` loop (replaced in Task 10 by a sink-based CLI) |
  | `collectors/playbyplay.py:154-155, 200, 229-232, 255-275` | parse edge cases, `poll` error branches |
  | `backfill.py:51` | the line at 51 |

  Write these tests **against the post-Task-10 constructor signatures**, marked `xfail(strict=True, reason="pending Task 10")` where they depend on them.

- [ ] **Step 2: API.** One test per listed gap. Assert behavior, not implementation.

  | File | Lines | Case |
  |---|---|---|
  | `db/session.py` | 51-101 | `seed_teams` inserts 30 teams, then is a no-op on the second call |
  | `db/sport_suite.py` | 39, 53, 67, 76 | Retired in Task 15 (legacy 5536-5538 pools). Add no tests. |
  | `routers/comments.py` | 21-28 | create a comment for a missing game → 404 |
  | `routers/games.py` | 31-33 | game not found → 404 |
  | `routers/picks.py` | 105, 123, 163-173, 186, 202-204 | tail twice → 409, untail a missing tail → 404, `/picks/sync` errors |
  | `services/comment_service.py` | 24-35 | list with limit / empty |
  | `services/prediction_service.py` | 70-77, 101-104, 137 | resolve correct/incorrect/already resolved |
  | `services/reaction_service.py` | 23-33, 48-50, 75-76 | counts, duplicate, delete a missing reaction |
  | `services/team_service.py` | 45-55, 78, 89-102, 176-179 | roster / schedule / stats error paths |
  | `services/espn_client.py` | 83, 119, 128, 137 | non-200 → `None` |
  | `services/stats_service.py` | 104, 110, 223, 233, 516-519 | missing-data branches |
  | `services/standings_service.py` | 70-76 | ties / missing records |
  | `services/scoreboard_poller.py` | 50, 94-96, 129 | error paths |
  | `services/pick_sync_poller.py` | 47-48, 62 | disabled / error |
  | `services/olap_poller.py` | 65-66 | rewritten in Task 12 |
  | `ws/live_feed.py` | 40-44, 62-63, 70 | broadcast to a dead socket removes it |
  | `ws/play_poller.py` | 88 | the line at 88 |
  | `models/schemas.py` | 101, 135 | validators' reject paths |
  | `routers/auth.py` | 55 | the line at 55 |
  | `services/auth_service.py` | 24, 45-46 | the listed lines |
  | `services/auth_deps.py` | 36 | the line at 36 |
  | `services/play_service.py` | 35-38 | the listed lines |
  | `services/player_service.py` | 122-123 | the listed lines |

  Remaining partial branches (`X->Y`) get one test each exercising the untaken side.

- [ ] **Step 3: Run.** `cd api && pytest tests/ -q --cov | tail -1` and the same for ingestion.
  Expected: api ≥ 99.1%, apart from the Kafka/GCS/sport_suite files retired in Task 15. Ingestion likewise.
- [ ] **Step 4: Commit.** `git commit -am "test: characterize ingestion and api gaps toward 99.1%"`

---

# Phase 2 — Make the tests pass

### Task 8: `EventSink` + `PostgresSink`, plus migration 012

**Files:**
- Create: `ingestion/src/sinks/__init__.py`, `ingestion/src/sinks/base.py`, `ingestion/src/sinks/postgres.py`
- Create: `storage/postgres/migrations/012_widen_play_event_type.sql`
- Modify: `ingestion/pyproject.toml` (runtime dep `asyncpg>=0.30`)
- Test: `ingestion/tests/test_postgres_sink.py` (remove the module-level `pytestmark`)

**Interfaces:** as in Task 2.

- [ ] **Step 1: Write the migration.**

```sql
-- 012: ESPN event types exceed 30 chars; match the ORM (String(50)).
ALTER TABLE plays ALTER COLUMN event_type TYPE VARCHAR(50);
```

- [ ] **Step 2: Write `sinks/base.py`.**

```python
"""Event sink protocol — where collectors hand off parsed ESPN events."""

from __future__ import annotations

from typing import Protocol


class EventSink(Protocol):
    def produce(self, topic: str, key: str, value: dict) -> None: ...

    async def flush(self) -> None: ...

    async def close(self) -> None: ...
```

- [ ] **Step 3: Write `sinks/postgres.py`.**

```python
"""PostgresSink — write games and plays straight to the Lunara database."""

from __future__ import annotations

from datetime import datetime, timezone

import asyncpg
import structlog

logger = structlog.get_logger(__name__)

TOPIC_SCOREBOARD = "raw.scoreboard"
TOPIC_PLAYS = "raw.plays"

UPSERT_GAME_SQL = """
INSERT INTO games (id, home_team, away_team, status, home_score, away_score,
                   quarter, clock, start_time, venue)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status, home_score = EXCLUDED.home_score,
    away_score = EXCLUDED.away_score, quarter = EXCLUDED.quarter,
    clock = EXCLUDED.clock, venue = EXCLUDED.venue, updated_at = now()
""".strip()

INSERT_PLAY_SQL = """
INSERT INTO plays (game_id, sequence_number, quarter, clock, event_type, description,
                   team, player_name, home_score, away_score)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (game_id, sequence_number) DO NOTHING
""".strip()


def _start_time(raw) -> datetime:
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            pass
    elif isinstance(raw, int | float):
        return datetime.fromtimestamp(raw / 1000, tz=timezone.utc)
    return datetime.now(timezone.utc)


def _game_row(v: dict) -> tuple:
    return (v["game_id"], v["home_team"], v["away_team"], v["status"],
            v.get("home_score", 0), v.get("away_score", 0), v.get("quarter"),
            v.get("clock"), _start_time(v.get("start_time")), v.get("venue"))


def _play_row(v: dict) -> tuple:
    return (v["game_id"], v["sequence_number"], v["quarter"], v.get("clock"),
            v.get("event_type"), v.get("description"), v.get("team"),
            v.get("player_name"), v.get("home_score"), v.get("away_score"))


class PostgresSink:
    """Buffers events; flush() writes games then plays in one transaction.

    Transient DB errors keep the buffer for the next flush (no lost plays). A
    foreign-key failure (unknown team / game) falls back to row-by-row so only
    the offending row is skipped.
    """

    def __init__(self, dsn: str, pool: asyncpg.Pool | None = None) -> None:
        self._dsn = dsn
        self._pool = pool
        self._games: dict[str, tuple] = {}
        self._plays: list[tuple] = []

    async def connect(self) -> None:
        self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=4)

    @property
    def pending(self) -> int:
        return len(self._games) + len(self._plays)

    def produce(self, topic: str, key: str, value: dict) -> None:
        if topic == TOPIC_SCOREBOARD:
            self._games[value["game_id"]] = _game_row(value)  # latest state wins
        elif topic == TOPIC_PLAYS:
            self._plays.append(_play_row(value))
        else:
            raise ValueError(f"unknown topic: {topic}")

    async def flush(self) -> None:
        if not self.pending:
            return
        if self._pool is None:
            raise RuntimeError("PostgresSink not connected")
        games, plays = list(self._games.values()), list(self._plays)
        try:
            async with self._pool.acquire() as conn:
                async with conn.transaction():
                    await self._write(conn, UPSERT_GAME_SQL, games)
                    await self._write(conn, INSERT_PLAY_SQL, plays)
        except (asyncpg.PostgresConnectionError, OSError) as exc:
            logger.warning("sink.flush_deferred", error=str(exc), pending=self.pending)
            return
        self._games.clear()
        self._plays.clear()

    @staticmethod
    async def _write(conn, sql: str, rows: list[tuple]) -> None:
        if not rows:
            return
        try:
            await conn.executemany(sql, rows)
        except asyncpg.ForeignKeyViolationError:
            for row in rows:
                try:
                    await conn.execute(sql, *row)
                except asyncpg.ForeignKeyViolationError:
                    logger.warning("sink.fk_skipped", key=row[0])

    async def close(self) -> None:
        await self.flush()
        if self._pool is not None:
            await self._pool.close()
```

  A foreign-key violation inside a transaction aborts it in real Postgres. So the row-by-row fallback wraps each `execute` in `async with conn.transaction():`, a savepoint. Add that wrapping, and let `FakeConn.transaction` in the tests support nesting, which it already does.

- [ ] **Step 4: Run.** Remove `pytestmark` from `test_postgres_sink.py`, then `cd ingestion && pytest tests/test_postgres_sink.py -q --cov=src/sinks --cov-branch`.
  Expected: 11 passed, 100%.
- [ ] **Step 5: Commit.** `git commit -am "feat(ingestion): PostgresSink writes games/plays directly; widen plays.event_type"`

---

### Task 9: `EspnHttp` with IPRoyal fallback

**Files:**
- Create: `ingestion/src/http/__init__.py`, `ingestion/src/http/espn.py`
- Test: `ingestion/tests/test_espn_http.py` (remove `pytestmark`)

- [ ] **Step 1: Implement.**

```python
"""ESPN HTTP: direct first, IPRoyal proxy as fallback (never a browser UA)."""

from __future__ import annotations

import time
from collections.abc import Callable

import httpx
import structlog

logger = structlog.get_logger(__name__)

BLOCK_STATUSES = frozenset({403, 429})


class EspnHttp:
    def __init__(
        self,
        proxy_url: str = "",
        *,
        trigger_failures: int = 3,
        cooldown_seconds: float = 300.0,
        timeout: float = 10.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._direct = httpx.AsyncClient(timeout=timeout)
        self._proxied = httpx.AsyncClient(timeout=timeout, proxy=proxy_url) if proxy_url else None
        self._trigger = trigger_failures
        self._cooldown = cooldown_seconds
        self._clock = clock
        self._blocks = 0
        self._proxy_until = 0.0

    @property
    def via_proxy(self) -> bool:
        return self._proxied is not None and self._clock() < self._proxy_until

    async def get(self, url: str, params: dict | None = None) -> httpx.Response:
        if self.via_proxy:
            return await self._proxied.get(url, params=params)
        try:
            resp = await self._direct.get(url, params=params)
        except httpx.TransportError:
            if self._proxied is None:
                raise
            self._note_block("transport_error")
            return await self._proxied.get(url, params=params)
        if resp.status_code in BLOCK_STATUSES and self._proxied is not None:
            self._note_block(str(resp.status_code))
            return await self._proxied.get(url, params=params)
        if resp.status_code not in BLOCK_STATUSES:
            self._blocks = 0
        return resp

    def _note_block(self, reason: str) -> None:
        self._blocks += 1
        logger.warning("espn.direct_blocked", reason=reason, consecutive=self._blocks)
        if self._blocks >= self._trigger:
            self._proxy_until = self._clock() + self._cooldown
            self._blocks = 0
            logger.warning("espn.proxy_engaged", cooldown_s=self._cooldown)

    async def aclose(self) -> None:
        await self._direct.aclose()
        if self._proxied is not None:
            await self._proxied.aclose()
```

- [ ] **Step 2: Run.** `pytest tests/test_espn_http.py -q --cov=src/http --cov-branch`
  Expected: all pass, 100%.
- [ ] **Step 3: Commit.** `git commit -am "feat(ingestion): direct ESPN with IPRoyal fallback and cooldown"`

---

### Task 10: Rewire collectors and orchestrator; drop Kafka/PubSub settings

**Files:**
- Modify: `ingestion/src/config.py`, `ingestion/src/__main__.py`
- Modify: `ingestion/src/collectors/{scoreboard,playbyplay,historical,base}.py`, `ingestion/src/backfill.py`
- Modify: existing tests that construct collectors (`test_scoreboard.py`, `test_playbyplay.py`, `test_collectors_ext.py`, `test_historical.py`, `test_backfill.py`, `test_main_orchestrator.py`): pass `(settings, sink, http)` fakes.
- Test: remove `pytestmark` from `test_main_sink_wiring.py`, and from the Task 7 ingestion tests that were pending Task 10.

**Changes:**
- **`config.py`:** the new fields per Task 4; `database_url: str` has no default.
- **`__main__.py`:**

  ```python
  from src.http.espn import EspnHttp
  from src.sinks.postgres import PostgresSink


  async def build_io(settings: Settings) -> tuple[PostgresSink, EspnHttp]:
      sink = PostgresSink(settings.database_url)
      await sink.connect()
      http = EspnHttp(
          settings.espn_proxy_url,
          trigger_failures=settings.proxy_trigger_failures,
          cooldown_seconds=settings.proxy_cooldown_seconds,
      )
      return sink, http
  ```

  `run()` calls `sink, http = await build_io(settings)`, passes them to every collector, and in `finally` does `await sink.close(); await http.aclose()`. Collectors no longer close the shared `http`.
- **Collectors:**
  - `__init__(self, settings, sink: EventSink, http: EspnHttp[, game_id])`
  - `_fetch` uses `resp = await self.http.get(url, params=params)`
  - `self.producer.produce(...)` becomes `self.sink.produce(...)`
  - `self.producer.flush()` becomes `await self.sink.flush()`
  - `close()` only flushes (`await self.sink.flush()`).
- **`scoreboard.py` standalone `main()`:** builds `build_io(Settings())` instead of a `KafkaProducer`.
- **`historical.py` / `backfill.py`:** take `sink` and `http`, and `await sink.flush()`.

- [ ] **Step 1:** Make the changes above.
- [ ] **Step 2:** `cd ingestion && pytest tests/ -q --cov`
  Expected: everything passes (retired producer tests are still present until Task 15).
- [ ] **Step 3:** `git commit -am "refactor(ingestion): collectors use EventSink + shared EspnHttp; no Kafka/PubSub"`

---

### Task 11: API without Kafka

**Files:**
- Modify: `api/src/main.py`, `api/src/config.py`, `api/src/metrics.py`
- Modify: `api/src/routers/reactions.py`, `api/src/routers/predictions.py`
- Test: remove `pytestmark` from `api/tests/test_no_kafka.py`

**Changes:**
- **`main.py`:** remove the Kafka imports, `init_producer`, `KafkaConsumerLoop` and its task, and `close_producer`.
- **`config.py`:** remove `kafka_bootstrap_servers` and `schema_registry_url`.
- **`metrics.py`:** remove the `kafka_messages_consumed_total` counter and any other `kafka_*` / `dlq_*` metric.
- **`reactions.py`:** replace both producer blocks. `from ..ws.live_feed import manager` at the top, then:

  ```python
      game_id = await get_play_game_id(session, play_id)
      if game_id:
          await manager.broadcast(
              game_id,
              {"type": "reaction", "data": {"play_id": play_id, "game_id": game_id,
                                            "user_id": x_user_id, "emoji": body.emoji,
                                            "action": "add"}},
          )
  ```

  The remove path uses `"action": "remove"` and no `emoji`.
- **`predictions.py`:** delete the producer block and the `get_producer` import.
- **`api/Dockerfile`:** `--workers 1`.

- [ ] **Step 1:** Make the changes. **Step 2:** `cd api && pytest tests/ -q --cov`. Expected: pass, except the old Kafka tests, which Task 15 deletes.
- [ ] **Step 3:** `git commit -am "refactor(api): broadcast reactions directly; no Kafka"`

---

### Task 12: Local OLAP export

**Files:**
- Modify: `api/src/services/olap_exporter.py`, `api/src/services/olap_poller.py`, `api/src/config.py`, `api/pyproject.toml`
- Test: remove `pytestmark` from `api/tests/test_olap_local.py`, and update `api/tests/test_olap.py`

**Changes:**
- Extract `_fetch_rows(session, export_date) -> list[dict]` from `export_picks_for_date`.
- Replace the GCS block with:

  ```python
      out = Path(export_dir) / "model_picks" / f"game_date={export_date.isoformat()}" / "picks.parquet"
      out.parent.mkdir(parents=True, exist_ok=True)
      pq.write_table(table, out, compression="snappy")
      logger.info("olap_exporter.written", date=export_date.isoformat(), rows=len(rows), path=str(out))
      return len(rows)
  ```

- `olap_poller` reads `settings.olap_export_dir` and returns immediately when it is empty.
- `config.py` gets `olap_export_dir: str = ""` and loses `gcs_olap_bucket`.
- `api/pyproject.toml` drops `google-cloud-storage`.

- [ ] **Step 1:** Change. **Step 2:** `pytest tests/test_olap_local.py tests/test_olap.py -q`. Expected: pass. **Step 3:** `git commit -am "feat(api): OLAP Parquet export to a local directory (no GCS)"`

---

### Task 13: Lumen reads URLs from the environment

**Files:**
- Create: `lumen-bot/settings.py`
- Modify: `lumen-bot/bot.py:95-96`
- Test: remove `pytestmark` from `tests/test_settings.py`

- [ ] **Step 1: Implement.**

```python
"""Lumen runtime settings — environment overrides config.yaml."""

from __future__ import annotations

from collections.abc import Mapping


def resolve_lunara_urls(config: dict, environ: Mapping[str, str]) -> tuple[str, str]:
    lun = config.get("lunara", {})
    api = (environ.get("LUNARA_API_URL") or "").strip() or lun["api_url"]
    ws = (environ.get("LUNARA_WS_URL") or "").strip() or lun["ws_url"]
    return api, ws
```

  `bot.py`: `self.api_url, self.ws_url = resolve_lunara_urls(config, os.environ)`.

- [ ] **Step 2:** `pytest tests/ -q --cov`. Expected: pass, ≥ 99.1%. **Step 3:** `git commit -am "feat(lumen): LUNARA_API_URL/LUNARA_WS_URL override config.yaml"`

---

### Task 14: Integration test: sink → Postgres → API poller → WebSocket

**Files:**
- Create: `tests/integration/test_sink_to_api.py`, `tests/integration/conftest.py` (replaced; the old one is Kafka-based)
- Modify: `.github/workflows/ci.yml`: add a `postgres:16` service to `python-lint-test` and run `pytest tests/integration -q` with `DATABASE_URL`.

- [ ] **Step 1: Write the test.**

```python
"""End to end on a real Postgres: ingestion sink writes a play; API poller broadcasts it."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import asyncpg
import pytest

DSN = os.environ.get("TEST_DATABASE_URL", "")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set")
MIGRATIONS = sorted((Path(__file__).parents[2] / "storage/postgres/migrations").glob("*.sql"))


@pytest.fixture
async def db():
    conn = await asyncpg.connect(DSN)
    await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    for m in MIGRATIONS:
        await conn.execute(m.read_text())
    await conn.execute("INSERT INTO teams (abbrev, name) VALUES ('BOS','Boston'),('NYK','New York')"
                       " ON CONFLICT DO NOTHING")
    yield conn
    await conn.close()


async def test_play_flows_to_websocket(db, monkeypatch):
    from ingestion_src.sinks.postgres import PostgresSink  # see conftest namespace mapping
    from api_src.ws import play_poller
    from api_src.ws.live_feed import manager

    sink = PostgresSink(DSN)
    await sink.connect()
    sink.produce("raw.scoreboard", "401", {"game_id": "401", "home_team": "BOS", "away_team": "NYK",
                 "status": "live", "home_score": 2, "away_score": 0, "quarter": 1, "clock": "11:40",
                 "start_time": "2026-10-20T23:30:00Z", "venue": "TD Garden"})
    sink.produce("raw.plays", "401", {"game_id": "401", "sequence_number": 1, "quarter": 1,
                 "clock": "11:40", "event_type": "x" * 45, "description": "make",
                 "team": "BOS", "player_name": "Tatum", "home_score": 2, "away_score": 0})
    await sink.close()
    got = await db.fetchval("SELECT count(*) FROM plays WHERE game_id='401'")
    assert got == 1
    # the API poller broadcasts new plays for subscribed games within one cycle
    sent = []
    monkeypatch.setattr(manager, "connection_count", lambda gid=None: 1)

    async def capture(gid, msg):
        sent.append((gid, msg))

    monkeypatch.setattr(manager, "broadcast", capture)
    await play_poller.poll_once(dsn_override=DSN)  # see Task 14 note
    assert sent and sent[0][1]["type"] == "play" and sent[0][1]["data"]["sequence_number"] == 1
```

  Two notes for this test:
  - The existing root `tests/conftest.py` merges both `src` packages. Replace that with explicit aliases `ingestion_src` / `api_src`, set up via `importlib`, and keep the old behavior for unit tests.
  - If `play_poller` has no single-cycle entry point, extract `poll_once(session_factory)` from its loop body. It is a refactor with unchanged behavior, covered by the existing `test_play_poller.py`. Then call it with a factory bound to `DSN`.

- [ ] **Step 2:** `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres pytest tests/integration -q` against `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`.
  Expected: pass.
- [ ] **Step 3:** `git commit -am "test(integration): sink to Postgres to WebSocket on a real database"`

---

### Task 15: Retire the dead plumbing (owner-approved deletion list)

**Delete exactly these paths:**
- `stream-processor/`, `stream-processor-pubsub/`, `kafka/`, `schemas/`
- `ingestion/src/producers/`, `ingestion/src/importers/sport_suite_games.py`
- `ingestion/tests/test_kafka_producer.py`, `test_pubsub_producer.py`, `test_sport_suite_games.py`
- `api/src/kafka/`, `api/src/db/sport_suite.py` (legacy 5536-5538 pools, not configured anywhere)
- `api/tests/test_kafka_consumer.py`, `test_kafka_api.py`, and any other test that imports `src.kafka` or `src.db.sport_suite`
- `tests/integration/test_pipeline_e2e.py`, `test_dlq.py`, `test_retry_integration.py`, `mock_espn.py` (Kafka-based)
- `scripts/gcp-setup.sh`, `render.yaml`

**Edit:**
- `docker-compose.yml` / `docker-compose.test.yml`: remove the `zookeeper`, `kafka`, `schema-registry`, `kafka-init`, `kafka-exporter` and `minio` services. `ingestion` gets `DATABASE_URL`; `api` loses the `KAFKA_*` variables.
- `api/src/services/stats_service.py` and `team_service.py`: remove the `sport_suite` pool branches, and their tests.
- `monitoring/prometheus/prometheus.yml`: drop the `kafka-exporter` job.
- `.github/workflows/ci.yml`: delete `java-test`, `deploy`, `manual-deploy` and `restart`, plus the `needs: [java-test]` references.
- `Makefile`: remove the Kafka, Java, npm and checkstyle targets that reference removed things.
- `ingestion/pyproject.toml` and `api/pyproject.toml`: drop `confluent-kafka[avro]`, the `gcp` extra and `apscheduler`.
- `CLAUDE.md`, `README.md`: rewrite the architecture and deployment sections to match the spec.

- [ ] **Step 1:** Run `git rm` on the list. Make the edits.
- [ ] **Step 2:** `grep -rnE "kafka|pubsub|confluent|schema_registry|google.cloud|gcr.io|run\.app|16\.58\.146\.197|553[6-9]" --exclude-dir=.git --exclude-dir=docs .`
  Expected: no hits outside `docs/`.
- [ ] **Step 3:** Run all three suites with `--cov`. Expected: pass.
- [ ] **Step 4:** `git commit -m "chore: retire Kafka, Pub/Sub, stream processors and GCP deploy (owner-approved)"`

---

### Task 16: Enforce 99.1%

- [ ] **Step 1:** Set `fail_under = 99.1` in all three `pyproject.toml` files.
- [ ] **Step 2:** Confirm each is ≥ 99.1: `for d in api ingestion lumen-bot; do (cd $d && pytest tests/ -q --cov | grep TOTAL); done`. Close any remaining gap with a test (line numbers from `--cov-report=term-missing`).
- [ ] **Step 3:** Commit, and confirm CI is green on the branch.

---

# Phase 3 — Oracle infrastructure (sport-suite-main)

### Task 17: Deploy artifacts with config tests

**Files:**
- Create: `deploy/oci/lunara-api.service`, `lunara-ingestion.service`, `cephalon-lumen.service`, `nginx-api.lunara-app.com.conf`, `docker-compose.redis.yml`
- Create: `deploy/tests/test_artifacts.py`

- [ ] **Step 1: Test first.**

```python
"""Deploy artifacts encode the spec's placement decisions."""

import configparser
from pathlib import Path

import yaml

D = Path(__file__).parents[1] / "oci"


def unit(name):
    cp = configparser.ConfigParser(strict=False, interpolation=None)
    cp.optionxform = str
    cp.read(D / name)
    return cp


def test_api_unit():
    u = unit("lunara-api.service")["Service"]
    assert u["User"] == "lunara" and u["WorkingDirectory"] == "/opt/lunara/api"
    assert u["EnvironmentFile"] == "/etc/lunara/api.env" and u["CPUWeight"] == "400"
    assert "--host 127.0.0.1 --port 8010 --workers 1" in u["ExecStart"]
    assert u["Restart"] == "always"


def test_ingestion_unit():
    u = unit("lunara-ingestion.service")["Service"]
    assert u["User"] == "lunara" and u["CPUWeight"] == "400"
    assert u["EnvironmentFile"] == "/etc/lunara/ingestion.env" and u["Restart"] == "always"
    assert u["ExecStart"].endswith("python -m src")


def test_lumen_unit_uses_local_api():
    u = unit("cephalon-lumen.service")["Service"]
    assert u["User"] == "lunara" and u["WorkingDirectory"] == "/opt/lunara/lumen-bot"
    assert u["EnvironmentFile"] == "/etc/lunara/lumen.env"


def test_nginx_websocket_and_blocks():
    conf = (D / "nginx-api.lunara-app.com.conf").read_text()
    assert "server_name api.lunara-app.com;" in conf
    assert "proxy_pass http://127.0.0.1:8010" in conf
    assert 'proxy_set_header Connection "upgrade";' in conf and "proxy_read_timeout 3600s;" in conf
    assert "location = /metrics { return 404; }" in conf       # not public
    assert "location /ws/publish { return 404; }" in conf      # unauthenticated push endpoint


def test_redis_bound_to_localhost_6380():
    svc = yaml.safe_load((D / "docker-compose.redis.yml").read_text())["services"]["lunara_redis"]
    assert svc["ports"] == ["127.0.0.1:6380:6379"]
    assert "--maxmemory 256mb" in svc["command"] and "--save ''" in svc["command"]
```

- [ ] **Step 2: Write the artifacts.**

`deploy/oci/lunara-api.service`:
```ini
[Unit]
Description=Lunara API (FastAPI)
After=network-online.target docker.service
Wants=network-online.target

[Service]
User=lunara
Group=lunara
WorkingDirectory=/opt/lunara/api
EnvironmentFile=/etc/lunara/api.env
ExecStart=/opt/lunara/api/.venv/bin/uvicorn src.main:app --host 127.0.0.1 --port 8010 --workers 1
Restart=always
RestartSec=5
CPUWeight=400

[Install]
WantedBy=multi-user.target
```

`deploy/oci/lunara-ingestion.service`: same shape, with `WorkingDirectory=/opt/lunara/ingestion`, `EnvironmentFile=/etc/lunara/ingestion.env` and `ExecStart=/opt/lunara/ingestion/.venv/bin/python -m src`.

`deploy/oci/cephalon-lumen.service`: same shape, with `WorkingDirectory=/opt/lunara/lumen-bot`, `EnvironmentFile=/etc/lunara/lumen.env` and `ExecStart=/opt/lunara/lumen-bot/.venv/bin/python bot.py`. No `CPUWeight`.

`deploy/oci/nginx-api.lunara-app.com.conf`:
```nginx
server {
    listen 80;
    server_name api.lunara-app.com;

    location = /metrics { return 404; }
    location /ws/publish { return 404; }

    location /ws/ {
        proxy_pass http://127.0.0.1:8010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:8010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    }
}
```

`deploy/oci/docker-compose.redis.yml`:
```yaml
services:
  lunara_redis:
    image: redis:7-alpine
    container_name: lunara_redis
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --save '' --appendonly no
    ports:
      - "127.0.0.1:6380:6379"
```

- [ ] **Step 3:** `pytest deploy/tests -q`. Expected: pass. **Step 4:** Commit: `feat(deploy): OCI systemd units, nginx site and Redis for Lunara`.

---

### Task 18: `provision.sh` and `deploy.sh`

**Files:** Create `deploy/oci/provision.sh`, `deploy/oci/deploy.sh`, `deploy/oci/README.md`.

Both run from the laptop using SSH alias `ss-admin` (ubuntu, sudo). Both are idempotent and `set -euo pipefail`. SQL is sent **as a file on ssh stdin**; never quote SQL inside `ssh '…'`.

**`provision.sh`** (once):
1. Create the `lunara` system user if it's missing.
2. Create `/opt/lunara` (lunara:lunara 0755) and `/etc/lunara` (root:lunara 0750).
3. Generate the `lunara_app` DB password on the server into `/etc/lunara/db.secret` (0640). Never print it.
4. Create role `lunara_app` (LOGIN, NOSUPERUSER) and database `lunara` OWNER `lunara_app` on `sportsuite_db`.
5. Apply `storage/postgres/migrations/*.sql` in order as `lunara_app`.
6. Write `/etc/lunara/{api,ingestion,lumen}.env` from templates:
   - `DATABASE_URL`: the API uses `postgresql+asyncpg://…@127.0.0.1:5500/lunara`; ingestion uses `postgresql://…`.
   - `REDIS_URL=redis://127.0.0.1:6380/0`
   - `SPORT_SUITE_API_URL=http://127.0.0.1:8000`
   - `SPORT_SUITE_API_KEY` = the value of `LUNARA_API_KEY` from the Sport-suite API unit, read server-side.
   - `ESPN_PROXY_URL` = the value of `SPORTSBOOK_PROXY_URL` from `/home/sportsuite/sport-suite/.env`, read server-side.
   - `JWT_SECRET`: freshly generated.
   - `OLAP_EXPORT_DIR=/opt/lunara/olap`
   - Lumen: `LUNARA_API_URL=http://127.0.0.1:8010`, `LUNARA_WS_URL=ws://127.0.0.1:8010/ws`. `DISCORD_TOKEN` and `ANTHROPIC_API_KEY` are prompted on the laptop with hidden input and sent over stdin.
7. `docker compose -p lunara -f docker-compose.redis.yml up -d`.

**`deploy.sh`** (each release):
1. Stage `api/`, `ingestion/`, `lumen-bot/` and `storage/postgres/migrations/` without tests, via `rsync --delete` into `/opt/lunara/<svc>`. Destination is **only** `/opt/lunara`.
2. Create or update the venvs: `python3.12 -m venv .venv && .venv/bin/pip install .`
3. Apply any new migrations.
4. Install the units and the nginx site, run `nginx -t`, then reload.
5. `systemctl restart lunara-api lunara-ingestion cephalon-lumen`.
6. Health gates:
   - `curl -sf 127.0.0.1:8010/health`
   - `curl -s 127.0.0.1:8010/health/db`, expecting 6/6
   - `journalctl -u lunara-ingestion -n 20` contains `ingestion.starting`

   On failure, print the logs and exit non-zero.

- [ ] **Step 1:** Write both scripts plus the README runbook (provision, deploy, rollback = `systemctl stop` the three units and remove the nginx site).
- [ ] **Step 2:** `bash -n` both. Run `provision.sh --dry-run`, which prints the steps without executing.
- [ ] **Step 3:** Commit.

---

### Task 19: DNS

- [ ] **Step 1:** Create the Cloudflare A record `api.lunara-app.com → 129.80.171.19`, proxied (TLS terminates at Cloudflare, like `admin.lunara-app.com`). Use the zone token in `~/archive/topstep-20260923/cloudflared/cert.pem`. Script it in `deploy/oci/cloudflare_dns.sh`, which reads the token locally and never echoes it.
- [ ] **Step 2:** Verify:
  - `dig +short api.lunara-app.com @joselyn.ns.cloudflare.com` returns Cloudflare IPs.
  - `curl -s https://api.lunara-app.com/health` returns 200.
  - `wss://api.lunara-app.com/ws/scoreboard` answers `pong` to `ping`.
- [ ] **Step 3:** Commit the script.

---

### Task 20: Go-live gates

**Files:**
- Create: `deploy/oci/live_slate_check.py` (the 2026-09-24 benchmark, made reusable)
- Create: `deploy/tests/test_live_slate_check.py`

- [ ] **Step 1: Test first** (pure functions only).

```python
from deploy.oci.live_slate_check import summarize


def test_summarize_pass_and_fail():
    ok = summarize(codes={200: 900}, latencies=[0.1] * 900, rounds=[0.2] * 60,
                   cpu_seconds=20, wall_seconds=90, cores=4)
    assert ok["pass"] and ok["cpu_pct"] < 15
    bad = summarize(codes={200: 890, 403: 10}, latencies=[0.1] * 900, rounds=[1.2] + [0.2] * 59,
                    cpu_seconds=20, wall_seconds=90, cores=4)
    assert not bad["pass"] and "non-200" in bad["reasons"] and "round>1s" in bad["reasons"]
```

- [ ] **Step 2:** Implement `live_slate_check.py`:
  - Fetch today's live games from the scoreboard.
  - Poll each game's `/summary` once per second for `--seconds` (default 90), with gzip and **no browser UA**.
  - `summarize(...)` returns `{"pass": bool, "reasons": [...], "cpu_pct": float, ...}`.
  - Pass rules (spec): 0 non-200 responses (or all recovered by the proxy when `--via-ingestion` is set), max round < 1.0 s, CPU < 15%.
- [ ] **Step 3: Go-live checklist,** run on the first live preseason night before Oct 20:
  1. `live_slate_check.py` on the box reports PASS.
  2. `lunara-ingestion` logs show plays for every live game, with no `sink.flush_deferred` streaks.
  3. `SELECT count(*) FROM plays` grows during games.
  4. The frontend game page shows new plays within about 2 s of ESPN.
  5. Pick sync pulled today's picks (`model_picks` has rows); the pick tracker PATCHed results after finals, with 200s in the Sport-suite API log.
  6. Lumen DMs the owner a pick update.
  7. The Grafana Pipeline Operations dashboard shows a Sport-suite pipeline run during games with no delay to Lunara, thanks to `CPUWeight`.
- [ ] **Step 4:** Commit. Record the results in `deploy/oci/README.md` under "Go-live record".

---

## Self-review notes

- **Spec coverage:**

  | Spec decision | Task(s) |
  |---|---|
  | 1 | 2, 8, 10, 11, 15 |
  | 2 | 18 |
  | 3 | 3, 9, 10 |
  | 4 | 17, 18, 19 |
  | 5 | 11, 17 |
  | 6 | 18 |
  | 7 | 6, 13, 17 |
  | 8 | 5, 12 |
  | 9 | 1, 6, 7, 16 |
  | 10 | 20 |

- **Review Focus:** #1 is covered in Tasks 2/8/14; #2 in 2/8; #3 in 2/8; #4 in 3/9; #5 in 2/8.
- **Type consistency:**
  - `EventSink.produce(topic, key, value)` is sync; `flush`/`close` are async, and so are all collector call sites (Task 10).
  - `EspnHttp.get(url, params)` returns `httpx.Response`, used by `_fetch` in both collectors.
  - `build_io(settings)` returns `(PostgresSink, EspnHttp)`.
