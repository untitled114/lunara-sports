CREATE TABLE IF NOT EXISTS plays (
    id BIGSERIAL PRIMARY KEY,
    game_id VARCHAR(20) REFERENCES games(id),
    sequence_number INT NOT NULL,
    quarter INT NOT NULL,
    clock VARCHAR(10),
    event_type VARCHAR(30),
    description TEXT,
    team VARCHAR(3),
    player_name VARCHAR(100),
    home_score INT,
    away_score INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(game_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_plays_game ON plays(game_id, sequence_number);
