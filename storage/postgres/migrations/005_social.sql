CREATE TABLE IF NOT EXISTS reactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    play_id BIGINT REFERENCES plays(id),
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, play_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    game_id VARCHAR(20) REFERENCES games(id),
    play_id BIGINT REFERENCES plays(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_game ON comments(game_id, created_at);
