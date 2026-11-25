-- Add sign-in fields and an account tier to users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(10) NOT NULL DEFAULT 'free';
