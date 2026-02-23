CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    favorite_teams TEXT[],
    prediction_score INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
