-- 012: ESPN event types exceed 30 chars; match the ORM (String(50)).
ALTER TABLE plays ALTER COLUMN event_type TYPE VARCHAR(50);
