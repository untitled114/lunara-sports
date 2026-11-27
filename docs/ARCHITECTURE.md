# Architecture

```
ESPN public API (scoreboard, game summary)
        |  scoreboard every 10 s; each live game's plays every 1 s
        v
ingestion  (Python 3.12, asyncio)
  ScoreboardCollector -> games      PlayByPlayCollector (one per live game) -> plays
        \                                   /
         +-------- PostgresSink -----------+   one shared buffer, ordered flushes
                         |
                         v
PostgreSQL 16:  games, teams, plays, users, predictions, reactions, comments
                analytics.* views
                         |
                         v
api  (FastAPI)
  REST: games, plays, box scores, standings, teams, players, stats (leaders, the Players table)
  WebSocket: /ws/scoreboard, /ws/{game_id}
  pollers: scoreboard into PostgreSQL and Redis (every 2 s, ESPN read through an 8 s cache);
           new plays to WebSocket clients (every 0.25 s)
  Redis: cache of ESPN reads (scoreboard 8 s, summaries 5 min, standings 30 min, rosters 24 h)
                         |
                         v
frontend  (React 18, Vite, Tailwind v4)
  REST on page load; WebSocket for the scoreboard ticker and the open game's plays
```

## Ingestion

- `src/__main__.py` runs two loops. The scoreboard loop finds the day's games and starts a
  play-by-play collector for each live game; when a game leaves the live states its collector
  is polled once more, the game is reconciled with ESPN, and the collector is closed.
- `src/collectors/playbyplay.py` remembers each ESPN play id with the fields it last produced
  and produces a play only when it is new or changed. It flushes the sink after each poll, so a
  new play is in PostgreSQL within the second.
- `src/sinks/postgres.py` buffers games (latest state per game) and plays, and writes them in one
  transaction per flush: games are upserted on their id, plays on `(game_id, espn_play_id)`
  with an update only when a field differs. `reconcile()` adopts rows written before plays had
  ESPN ids, upserts ESPN's final list and deletes rows ESPN no longer has, keeping any row a
  reaction or comment points at.
- `src/reconcile.py` is the CLI for stored games: `python -m src.reconcile --game ID` or
  `--since YYYY-MM-DD` (every final game from that Eastern date).
- `src/backfill.py` loads past dates or a single game through the same collectors and sink.

## API

- Plays reach WebSocket clients only through the play poller: for each game with subscribers it
  reads rows whose id is above the game's watermark. The first client's history sets the
  watermark, so history is never sent twice; row ids only grow, so a renumbered play is not sent
  again. REST and history return plays in ESPN's time order.
- `GET /stats/players` builds the Players table from one ESPN request for every player's season,
  each team's roster (for jersey numbers) and the standings (for the games rule: a player
  qualifies after playing 70% of their team's games so far), all through the Redis cache. Sorting, search
  and filters run on that list, 25 rows a page.
- `GET /stats/leaders/{category}` ranks qualified players in one of nine categories, using the
  NBA's minimums for each, and `GET /stats/teams` gives every team's per-game numbers.
- Writes that belong to a user (reactions, comments, predictions) take the user from the JWT.

## Website

- One page per route (`src/pages/`), each loaded on first visit. Shared pieces in
  `src/components/`: the design-system parts in `ui/` and the basketball ones in `sport/`.
- The game page loads the game, its box score and its plays over REST, then subscribes to the
  game's WebSocket for new plays and score changes while it is live.
- A row that represents a game, team or player is one link: a click anywhere on it opens the page.
- The look lives in design tokens (`src/styles/tokens.css`); `scripts/check-design.mjs` fails CI
  on colors, effects or type outside them.
- The API's address comes from the build (`VITE_API_URL`, see `frontend/.env.example`).

## Database

Migrations in `storage/postgres/migrations/` run in name order. Migration 015 keys plays on
ESPN's play id and adds the play's position in ESPN's list and its score value; migration 016
creates the `analytics` views described in the README.
