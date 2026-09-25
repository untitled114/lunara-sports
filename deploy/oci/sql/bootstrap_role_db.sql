-- Lunara role + database on sportsuite_db. Run as the superuser (mlb_user) against the
-- `postgres` database by remote/provision.sh, which prepends `\set verifier '...'` on
-- stdin. The verifier is a SCRAM-SHA-256 verifier computed on the server from
-- /etc/lunara/db.secret (never printed); the plaintext password never reaches Postgres,
-- so it cannot land in the server log or pg_stat_statements. Idempotent.

-- Belt and braces: keep this session's statements out of logs and pg_stat_statements.
SET log_statement = 'none';
SET log_min_duration_statement = -1;
SET log_min_error_statement = panic;
SET pg_stat_statements.track_utility = off;

SELECT 'CREATE ROLE lunara_app LOGIN NOSUPERUSER'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lunara_app') \gexec

ALTER ROLE lunara_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
    PASSWORD :'verifier';

SELECT 'CREATE DATABASE lunara OWNER lunara_app'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'lunara') \gexec

ALTER DATABASE lunara OWNER TO lunara_app;
REVOKE CONNECT ON DATABASE lunara FROM PUBLIC;
GRANT CONNECT ON DATABASE lunara TO lunara_app;
