# playbyplay-ingestion

Ingestion service for the Play-by-Play app. Polls ESPN's free public API for NBA
scoreboard and play-by-play data, then produces structured events to Kafka topics.

## Topics

| Topic             | Description                          |
|-------------------|--------------------------------------|
| `raw.scoreboard`  | Periodic game state snapshots        |
| `raw.plays`       | Individual play-by-play events       |

## Running locally

```bash
pip install -e ".[dev]"
python -m src.collectors.scoreboard
```

## Docker

```bash
docker build -t playbyplay-ingestion .
docker run --env-file .env playbyplay-ingestion
```
