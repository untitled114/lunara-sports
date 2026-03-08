-- Add sport_suite_id to model_picks for Phase 4 pick result feedback loop.
-- Populated during API-based pick sync; NULL for file-based (Hetzner) syncs.
ALTER TABLE model_picks
    ADD COLUMN IF NOT EXISTS sport_suite_id VARCHAR(64);
