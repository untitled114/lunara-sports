CREATE TABLE IF NOT EXISTS teams (
    abbrev VARCHAR(5) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    conference VARCHAR(7),
    division VARCHAR(20),
    logo_url TEXT
);

CREATE TABLE IF NOT EXISTS games (
    id VARCHAR(20) PRIMARY KEY,
    home_team VARCHAR(5) REFERENCES teams(abbrev),
    away_team VARCHAR(5) REFERENCES teams(abbrev),
    status VARCHAR(20) NOT NULL,
    home_score INT DEFAULT 0,
    away_score INT DEFAULT 0,
    quarter INT,
    clock VARCHAR(10),
    start_time TIMESTAMPTZ NOT NULL,
    venue TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_date ON games(start_time);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
