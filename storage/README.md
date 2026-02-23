# Storage

## PostgreSQL (OLTP)

Migrations in `postgres/migrations/` are numbered and run sequentially.

```bash
# Run all migrations
make db-migrate

# Reset database (drop + recreate + migrate)
make db-reset
```

### Tables
- `users` — User accounts and preferences
- `teams` — NBA team reference data
- `games` — Game schedule and live scores
- `plays` — Play-by-play events
- `predictions` — User predictions
- `leaderboard` — Aggregated prediction scores
- `reactions` — Emoji reactions on plays
- `comments` — User comments on games/plays

## OLAP (Future)

See `olap/schema.md` for planned analytical schema.
