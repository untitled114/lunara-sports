-- 013: ESPN abbreviates Utah as "UTAH" (seeded in teams by 007); VARCHAR(3) turned
-- every Jazz play into a DataError the sink skips. Match games/teams (VARCHAR(5)).
ALTER TABLE plays ALTER COLUMN team TYPE VARCHAR(5);
