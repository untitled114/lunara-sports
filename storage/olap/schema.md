# OLAP Schema (BigQuery / Snowflake)

Future analytical layer for historical analysis, ML feature engineering, and dashboards.

## Planned Tables

### `fact_plays`
Denormalized play events with game context. Partitioned by `game_date`.

| Column | Type | Description |
|--------|------|-------------|
| play_id | INT64 | Unique play identifier |
| game_id | STRING | ESPN game ID |
| game_date | DATE | Partition key |
| sequence_number | INT64 | Play ordering |
| quarter | INT64 | Game period |
| clock | STRING | Game clock |
| event_type | STRING | shot_made, rebound, etc. |
| team | STRING | Team abbreviation |
| player_name | STRING | Player name |
| home_score | INT64 | Score at time of play |
| away_score | INT64 | Score at time of play |

### `fact_predictions`
User predictions with outcomes for leaderboard analytics.

### `dim_games`
Game dimension with team info, venue, final scores.

### `dim_users`
User dimension with engagement metrics.

## Implementation Notes

- Not yet implemented — will be added when analytics requirements solidify
- Candidates: BigQuery (GCP), Snowflake, or ClickHouse (self-hosted on Hetzner)
- ETL via dbt models reading from PostgreSQL CDC or Kafka topics
