ALTER TABLE model_picks
    ADD COLUMN IF NOT EXISTS rolling_stats  JSON,
    ADD COLUMN IF NOT EXISTS injury_status  VARCHAR(30);
