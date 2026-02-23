CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    game_id VARCHAR(20) REFERENCES games(id),
    prediction_type VARCHAR(20),
    prediction_value TEXT NOT NULL,
    is_correct BOOLEAN,
    points_awarded INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    UNIQUE(user_id, game_id, prediction_type)
);

CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);

CREATE TABLE IF NOT EXISTS leaderboard (
    user_id UUID REFERENCES users(id),
    season VARCHAR(10),
    total_points INT DEFAULT 0,
    correct_predictions INT DEFAULT 0,
    total_predictions INT DEFAULT 0,
    streak INT DEFAULT 0,
    rank INT,
    PRIMARY KEY (user_id, season)
);
