-- Lunara role + database on sportsuite_db. Run as the superuser (mlb_user) against the
-- `postgres` database by remote/provision.sh, which prepends `\set pw '<hex>'` on stdin
-- from /etc/lunara/db.secret (generated on the server, never printed). Idempotent.

-- Keep the password statement out of the server log whatever the logging settings are.
SET log_statement = 'none';
SET log_min_duration_statement = -1;

SELECT 'CREATE ROLE lunara_app LOGIN NOSUPERUSER'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lunara_app') \gexec

ALTER ROLE lunara_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
    PASSWORD :'pw';

SELECT 'CREATE DATABASE lunara OWNER lunara_app'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'lunara') \gexec

ALTER DATABASE lunara OWNER TO lunara_app;
REVOKE CONNECT ON DATABASE lunara FROM PUBLIC;
GRANT CONNECT ON DATABASE lunara TO lunara_app;
