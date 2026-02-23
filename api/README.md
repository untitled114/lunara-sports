# Play-by-Play API

FastAPI service powering the Play-by-Play real-time sports app. Provides REST
endpoints for games, play-by-play events, user predictions, and leaderboards,
plus a WebSocket feed for live game updates.

## Quick start

```bash
# Install dependencies
pip install -e ".[dev]"

# Run locally
uvicorn src.main:app --reload --port 8000

# Run via Docker
docker build -t pbp-api .
docker run -p 8000:8000 pbp-api
```

Once running, interactive docs are available at http://localhost:8000/docs.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/games` | Today's games |
| GET | `/games/{game_id}` | Single game detail |
| GET | `/games/{game_id}/plays` | Play-by-play for a game |
| POST | `/predictions` | Submit a prediction |
| GET | `/predictions/{user_id}` | User's predictions |
| GET | `/leaderboard` | Top users by points |
| WS | `/ws/{game_id}` | Live game feed |
