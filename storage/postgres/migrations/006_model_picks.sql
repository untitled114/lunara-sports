-- Sport-suite model picks (imported from betting_xl predictions)
CREATE TABLE IF NOT EXISTS model_picks (
    id BIGSERIAL PRIMARY KEY,
    game_id VARCHAR(30) REFERENCES games(id),
    player_name VARCHAR(100) NOT NULL,
    team VARCHAR(10) NOT NULL,
    market VARCHAR(20) NOT NULL,             -- 'POINTS', 'REBOUNDS'
    line NUMERIC(5,1) NOT NULL,              -- e.g. 16.5
    prediction VARCHAR(10) NOT NULL,         -- 'OVER' or 'UNDER'
    p_over NUMERIC(4,3),                     -- probability e.g. 0.823
    edge NUMERIC(5,2),                       -- edge percentage e.g. 4.5
    book VARCHAR(30),                        -- 'DraftKings', 'FanDuel', etc.
    model_version VARCHAR(10),               -- 'xl' or 'v3'
    tier VARCHAR(10),                        -- 'X', 'Z', 'META', 'A'
    actual_value NUMERIC(5,1),               -- actual stat result (null if pending)
    is_hit BOOLEAN,                          -- null=pending, true=hit, false=miss
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_picks_game ON model_picks(game_id);
CREATE INDEX IF NOT EXISTS idx_model_picks_team ON model_picks(team);
