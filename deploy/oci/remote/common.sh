# shellcheck shell=bash
# Shared helpers for the server-side halves of provision.sh / deploy.sh.
#
# The laptop concatenates this file with remote/provision.sh or remote/deploy.sh and
# pipes the result to `ssh ss-admin 'sudo bash -s -- <args>'`. Everything lives in
# functions and the last line of each remote script is `main "$@"`, so bash has read
# the whole script before anything runs and no child process can swallow the rest of
# it from stdin. Secrets are generated or read here, on the server, and never printed.

set -euo pipefail
umask 027

# Shared constants; each remote script uses a subset (hence SC2034).
# shellcheck disable=SC2034
{
readonly LUNARA_ROOT=/opt/lunara
readonly LUNARA_ETC=/etc/lunara
readonly DB_CONTAINER=sportsuite_db
readonly DB_SUPERUSER=mlb_user
readonly DB_NAME=lunara
readonly DB_ROLE=lunara_app
readonly PY312=/opt/lunara/bin/python3.12
readonly SERVICES=(lunara-api lunara-ingestion cephalon-lumen)
readonly NGINX_SITE=api.lunara-app.com
readonly TLS_DIR=/etc/lunara/tls
readonly TLS_KEY=/etc/lunara/tls/api.lunara-app.com.key
readonly TLS_CSR=/etc/lunara/tls/api.lunara-app.com.csr
readonly TLS_CERT=/etc/lunara/tls/api.lunara-app.com.pem
}

step() { printf '\n==> [remote] %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

# psql as the lunara_app role against the lunara database. SQL arrives on stdin only.
# The password travels through the environment (docker exec -e NAME copies it from
# this process), never through argv.
psql_app() {
    PGPASSWORD="$(cat "$LUNARA_ETC/db.secret")" \
        docker exec -i -e PGPASSWORD "$DB_CONTAINER" \
        psql -X -q -h 127.0.0.1 -U "$DB_ROLE" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}

# Apply every *.sql in DIR (default /opt/lunara/migrations) not yet recorded in schema_migrations,
# in filename order, each in one transaction together with its bookkeeping row.
apply_migrations() {
    local dir="${1:-$LUNARA_ROOT/migrations}" f name sum applied
    [[ -d "$dir" ]] || die "$dir missing (stage the bundle first)"

    psql_app <<'SQL'
SET client_min_messages = warning;
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    sha256     TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL
    applied="$(psql_app -At <<'SQL'
SELECT filename || ' ' || sha256 FROM schema_migrations;
SQL
)"

    local files=()
    mapfile -t files < <(find "$dir" -maxdepth 1 -type f -name '*.sql' | LC_ALL=C sort)
    ((${#files[@]} > 0)) || die "no migrations found in $dir"

    local n_new=0
    for f in "${files[@]}"; do
        name="$(basename "$f")"
        [[ "$name" =~ ^[A-Za-z0-9_.-]+\.sql$ ]] || die "unsafe migration filename: $name"
        sum="$(sha256sum "$f" | cut -d' ' -f1)"
        local recorded
        recorded="$(printf '%s\n' "$applied" | awk -v n="$name" '$1 == n {print $2}')"
        if [[ -n "$recorded" ]]; then
            [[ "$recorded" == "$sum" ]] ||
                info "WARNING: $name changed since it was applied (not re-applied)"
            continue
        fi
        info "applying $name"
        {
            printf 'BEGIN;\n'
            cat "$f"
            printf "\nINSERT INTO schema_migrations (filename, sha256) VALUES ('%s', '%s');\n" \
                "$name" "$sum"
            printf 'COMMIT;\n'
        } | psql_app
        n_new=$((n_new + 1))
    done
    info "migrations: ${#files[@]} on disk, $n_new newly applied"
}
