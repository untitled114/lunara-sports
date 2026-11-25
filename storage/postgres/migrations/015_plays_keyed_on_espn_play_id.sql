-- Plays are identified by ESPN's play id. ESPN renumbers plays during a game (a play
-- recorded late is inserted and the ones after it shift), so the sequence number is the
-- play's current position, not its identity.
ALTER TABLE plays ADD COLUMN IF NOT EXISTS espn_play_id VARCHAR(32);

-- ESPN's own facts about each play: its position in ESPN's play list (the game's time
-- order; the sequence number is not), and the points it scored.
ALTER TABLE plays ADD COLUMN IF NOT EXISTS espn_order INT;
ALTER TABLE plays ADD COLUMN IF NOT EXISTS scoring_play BOOLEAN;
ALTER TABLE plays ADD COLUMN IF NOT EXISTS score_value INT;

-- Drop the unique (game_id, sequence_number) constraint, whatever its name: two plays
-- may briefly share a number while a renumbering is applied.
DO $$
DECLARE c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        WHERE con.conrelid = 'plays'::regclass
          AND con.contype = 'u'
          AND (SELECT array_agg(att.attname::text ORDER BY att.attname)
               FROM unnest(con.conkey) AS k(attnum)
               JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum)
              = ARRAY['game_id', 'sequence_number']
    LOOP
        EXECUTE format('ALTER TABLE plays DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

-- One row per ESPN play. Rows written before this column existed keep a NULL id until the
-- reconcile backfill matches them (NULLs never collide in a unique constraint).
DO $$
BEGIN
    ALTER TABLE plays ADD CONSTRAINT uq_plays_game_espn_play UNIQUE (game_id, espn_play_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
