# lunara-sports

A live NBA data pipeline. It polls ESPN's public scoreboard and play-by-play feeds during games,
writes every game and play to PostgreSQL, serves them over a REST and WebSocket API while the
game is on, and keeps an analytics layer of SQL views over the stored plays.

## What is here

| Area | Path | What it does |
|---|---|---|
| Ingestion | `ingestion/` | Polls ESPN for the scoreboard and for each live game's plays, and writes them through one buffered PostgreSQL sink |
| Reconcile | `ingestion/src/reconcile.py` | Makes a finished game's stored plays match ESPN's final play list; a CLI does the same for stored games |
| Database | `storage/postgres/migrations/` | Numbered SQL migrations: games, teams, plays, users, predictions and social tables, and the analytics views |
| Analytics | `storage/postgres/migrations/016_analytics_views.sql` | Views for play flow, quarter scoring, player points, scoring runs and game flow |
| API | `api/` | FastAPI: REST for games, plays, box scores, standings, teams and players; WebSocket feeds for the scoreboard and each game; JWT sign-in |
| Monitoring | `monitoring/`, `docker-compose.yml` | Prometheus with PostgreSQL and Redis exporters, a Grafana dashboard, the API's request metrics |
| Tests | `api/tests/`, `ingestion/tests/`, `tests/integration/` | Unit tests per service, and tests against a real PostgreSQL for the sink, the play broadcast poller, reconcile and the views |

## Data notes

- **A play is identified by ESPN's play id, not its sequence number.** ESPN renumbers plays
  during a game: a play recorded late is inserted and the plays after it shift. When plays were
  keyed on the sequence number, one stored game (CLE @ CHA, 2026-11-09) ended up with 109 of 445
  shared numbers holding a different play than ESPN's final list, 6 stale rows and 8 missing
  plays, and points summed from the stored score changes disagreed with ESPN's box score for 12
  of the 22 players who played. Plays are now upserted on `(game_id, espn_play_id)`, a play is
  written again only when one of its fields changed, and each finished game is reconciled with
  ESPN's final list. `ingestion/tests/test_stored_game_drift.py` checks those figures from the two
  captures, and `ingestion/tests/test_reconcile_db.py` replays the stored game through reconcile.
- **Time order comes from ESPN's list, not from sequence numbers.** In ESPN's final list for that
  game the running score never goes backwards; sorted by sequence number it goes backwards four
  times (`ingestion/tests/test_stored_game_drift.py`). Each play stores its position in ESPN's
  list (`espn_order`), and the API and the views order by it.
- **Points come from ESPN's per-play score value.** Summed over a game, they equal ESPN's box
  score for every player and ESPN's line score for every quarter
  (`ingestion/tests/test_analytics_db.py`).
- **Writes are ordered and survive a database blip.** Collectors share one sink. A flush detaches
  the buffer under a lock, so writes commit in the order they were requested; a transient failure
  puts the batch back ahead of newer events; a row that violates a constraint is retried alone
  and dropped alone (`ingestion/src/sinks/postgres.py`).
- **A slow game does not stall the others.** Each game's play-by-play poll is bounded to 3
  seconds (`ingestion/src/__main__.py`) and retried once at most; scoreboard requests retry with
  exponential backoff; each collector has a circuit breaker that stops calling an endpoint that
  keeps failing (`ingestion/src/resilience/`).

## The analytics views

All in the `analytics` schema, read-only, over plays that carry ESPN's time order:

- `play_flow`: every play with its side, points and margin after it.
- `quarter_scoring`: points per team per quarter.
- `player_points`: points per player per game, with how many threes, twos and free throws made
  them.
- `scoring_runs`: consecutive points by one side with no points by the other (gaps and
  islands over the scoring plays).
- `game_flow`: lead changes, ties, each side's largest lead, the longest run and the final
  margin, one row per game.

On the stored CLE @ CHA game they give ESPN's own figures: line scores 29-40-38-17 and
28-25-27-32, the largest leads (33 and 9) and 3 lead changes.

## Run it

Requirements: Linux, Docker, Python 3.12 with its `venv` module (`python3.12-venv` on Debian and
Ubuntu), and the `psql` client.

```bash
cp .env.example .env
make infra          # PostgreSQL, Redis, Prometheus, Grafana; waits for PostgreSQL
make db-migrate     # apply storage/postgres/migrations in order
make dev-ingestion  # poll ESPN and write to PostgreSQL (runs in the foreground)
```

and in a second terminal:

```bash
make dev-api        # the API on 127.0.0.1:8000 (docs at /docs)
```

The two services each get their own environment in `.ci/` (built by `make envs`, which the dev
targets run first): both ship a top-level package named `src`, so they never share one.

## Tests

```bash
make test      # lint, and the API and ingestion suites (no database needed)
make test-db   # all of that plus the real-PostgreSQL tests, on a throwaway postgres:16 container
```

`scripts/check.sh` is what both run, and what CI runs. Recorded responses used by the tests are
listed, with when they were recorded, in `api/tests/fixtures/README.md` and
`tests/fixtures/espn/README.md`.
