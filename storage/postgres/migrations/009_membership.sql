-- Add auth + membership fields to users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(10) NOT NULL DEFAULT 'free';

ALTER TABLE users
    ADD CONSTRAINT chk_membership_tier CHECK (membership_tier IN ('free', 'premium'));

-- User tails (pick tracking)
CREATE TABLE IF NOT EXISTS user_tails (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pick_id BIGINT NOT NULL REFERENCES model_picks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, pick_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tails_user ON user_tails(user_id);
