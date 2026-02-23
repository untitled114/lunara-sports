-- Enhance model_picks with additional Sport-suite fields for sync + dedup
ALTER TABLE model_picks
    ADD COLUMN IF NOT EXISTS edge_pct NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS consensus_line NUMERIC(5,1),
    ADD COLUMN IF NOT EXISTS opponent_team VARCHAR(5),
    ADD COLUMN IF NOT EXISTS reasoning TEXT,
    ADD COLUMN IF NOT EXISTS is_home BOOLEAN,
    ADD COLUMN IF NOT EXISTS confidence VARCHAR(10),
    ADD COLUMN IF NOT EXISTS line_spread NUMERIC(5,1),
    ADD COLUMN IF NOT EXISTS game_date DATE;

-- Widen tier from VARCHAR(10) to VARCHAR(20) for "Goldmine", "star_tier"
ALTER TABLE model_picks ALTER COLUMN tier TYPE VARCHAR(20);

-- Upsert dedup: one pick per (game, player, market, model_version)
CREATE UNIQUE INDEX IF NOT EXISTS uq_model_picks_dedup
    ON model_picks (game_id, player_name, market, model_version);

-- Fast lookup by game_date
CREATE INDEX IF NOT EXISTS idx_model_picks_game_date ON model_picks(game_date);
