# shellcheck shell=bash
# Server half of deploy/oci/provision.sh. Sent after remote/common.sh on ssh stdin and
# run as root: `sudo bash -s -- base|finish`.
#   base   - lunara user, /opt/lunara, /etc/lunara, Python 3.12 (before the bundle rsync)
#   finish - DB secret, role + database, migrations, env files, Redis (after the rsync)

readonly UV_VERSION=0.12.19
readonly SS_API_UNIT=sport-suite-api
readonly SS_ENV=/home/sportsuite/sport-suite/.env
readonly CORS_ORIGINS='["https://www.lunara-app.com","https://lunara-app.com","https://admin.lunara-app.com"]'

phase_base() {
    step "1. lunara system user"
    if id lunara >/dev/null 2>&1; then
        info "exists"
    else
        useradd --system --user-group --home-dir "$LUNARA_ROOT" --no-create-home \
            --shell /usr/sbin/nologin lunara
        info "created"
    fi

    step "2. /opt/lunara (lunara:lunara 0755) and /etc/lunara (root:lunara 0750)"
    install -d -o lunara -g lunara -m 0755 "$LUNARA_ROOT" "$LUNARA_ROOT/bin" \
        "$LUNARA_ROOT/olap"
    install -d -o root -g root -m 0755 "$LUNARA_ROOT/deploy" "$LUNARA_ROOT/migrations"
    install -d -o root -g lunara -m 0750 "$LUNARA_ETC"
    # lumen.secret (staged by the owner) stays 0600 root:root until finish merges it.

    step "2b. Python 3.12 for the venvs (uv-managed, self-contained under /opt/lunara)"
    # Ubuntu 22.04 here ships python3.10 (no ensurepip) and python3.11 3.11.0~rc1 only.
    # uv installs a standalone CPython 3.12 under /opt/lunara/python; no apt changes.
    if [[ -x "$PY312" ]] && "$PY312" -c 'import sys; assert sys.version_info[:2] == (3, 12)'; then
        info "present: $("$PY312" --version)"
    else
        local uvenv="$LUNARA_ROOT/.uv"
        sudo -u lunara -H python3.11 -m venv "$uvenv"
        sudo -u lunara -H "$uvenv/bin/pip" install --no-cache-dir -q "uv==$UV_VERSION"
        sudo -u lunara -H env UV_PYTHON_INSTALL_DIR="$LUNARA_ROOT/python" \
            UV_CACHE_DIR="$LUNARA_ROOT/.cache/uv" "$uvenv/bin/uv" python install 3.12
        local found
        found="$(sudo -u lunara -H env UV_PYTHON_INSTALL_DIR="$LUNARA_ROOT/python" \
            UV_PYTHON_PREFERENCE=only-managed "$uvenv/bin/uv" python find 3.12)"
        [[ -x "$found" ]] || die "uv did not produce a python 3.12 interpreter"
        ln -sfn "$found" "$PY312"
        info "installed: $("$PY312" --version)"
    fi
}

# Print the value of KEY from an env-style file (last assignment wins, surrounding quotes
# stripped) into the named variable. Never echoes the value.
read_env_value() {
    local __out="$1" key="$2" file="$3" v
    v="$(sed -n "s/^${key}=//p" "$file" | tail -n 1)"
    v="${v%$'\r'}"
    if [[ "$v" == \"*\" || "$v" == \'*\' ]]; then v="${v:1:${#v}-2}"; fi
    printf -v "$__out" '%s' "$v"
}

# Write an env file atomically as 0640 root:lunara from stdin.
write_env() {
    local dest="$1" tmp
    tmp="$(mktemp "$LUNARA_ETC/.$(basename "$dest").XXXXXX")"
    cat >"$tmp"
    chown root:lunara "$tmp"
    chmod 0640 "$tmp"
    mv -f "$tmp" "$dest"
    info "wrote $dest (0640 root:lunara)"
}

# Generate a hex secret into FILE once (0640 root:lunara); keep it on re-runs.
ensure_secret() {
    local file="$1" bytes="$2"
    if [[ -s "$file" ]]; then
        info "$file exists (kept)"
    else
        (umask 077 && openssl rand -hex "$bytes" >"$file")
        info "generated $file"
    fi
    chown root:lunara "$file"
    chmod 0640 "$file"
}

phase_finish() {
    [[ -d "$LUNARA_ROOT/deploy/sql" ]] || die "bundle not staged in $LUNARA_ROOT/deploy"
    chown root:lunara "$LUNARA_ETC"
    chmod 0750 "$LUNARA_ETC"

    step "3. lunara_app DB password -> /etc/lunara/db.secret (0640, never printed)"
    ensure_secret "$LUNARA_ETC/db.secret" 24
    ensure_secret "$LUNARA_ETC/jwt.secret" 32

    step "4. role lunara_app (LOGIN NOSUPERUSER) and database lunara on $DB_CONTAINER"
    {
        printf '\\set pw %s\n' "'$(cat "$LUNARA_ETC/db.secret")'"
        cat "$LUNARA_ROOT/deploy/sql/bootstrap_role_db.sql"
    } | docker exec -i "$DB_CONTAINER" \
        psql -X -q -U "$DB_SUPERUSER" -d postgres -v ON_ERROR_STOP=1
    info "role and database ready"

    step "5. migrations as lunara_app"
    apply_migrations

    step "6. /etc/lunara/{api,ingestion,lumen}.env"
    local dbpw jwt ss_key proxy
    dbpw="$(cat "$LUNARA_ETC/db.secret")"
    jwt="$(cat "$LUNARA_ETC/jwt.secret")"
    ss_key="$(systemctl show "$SS_API_UNIT" -p Environment --value | tr ' ' '\n' |
        sed -n 's/^LUNARA_API_KEY=//p' | tail -n 1)"
    [[ -n "$ss_key" ]] || die "LUNARA_API_KEY not found in $SS_API_UNIT Environment="
    info "SPORT_SUITE_API_KEY <- $SS_API_UNIT Environment LUNARA_API_KEY (${#ss_key} chars)"
    proxy=""
    [[ -f "$SS_ENV" ]] && read_env_value proxy SPORTSBOOK_PROXY_URL "$SS_ENV"
    if [[ -n "$proxy" ]]; then
        info "ESPN_PROXY_URL <- $SS_ENV SPORTSBOOK_PROXY_URL (${#proxy} chars)"
    else
        info "WARNING: SPORTSBOOK_PROXY_URL not found in $SS_ENV; ESPN_PROXY_URL left empty"
    fi

    write_env "$LUNARA_ETC/api.env" <<EOF
DATABASE_URL=postgresql+asyncpg://$DB_ROLE:$dbpw@127.0.0.1:5500/$DB_NAME
REDIS_URL=redis://127.0.0.1:6380/0
SPORT_SUITE_API_URL=http://127.0.0.1:8000
SPORT_SUITE_API_KEY=$ss_key
JWT_SECRET=$jwt
OLAP_EXPORT_DIR=$LUNARA_ROOT/olap
CORS_ORIGINS=$CORS_ORIGINS
API_HOST=127.0.0.1
API_PORT=8010
PYTHONUNBUFFERED=1
EOF
    # PORT: both health servers default to 0.0.0.0:8080, which Airflow already holds.
    write_env "$LUNARA_ETC/ingestion.env" <<EOF
DATABASE_URL=postgresql://$DB_ROLE:$dbpw@127.0.0.1:5500/$DB_NAME
ESPN_PROXY_URL=$proxy
PORT=8011
PYTHONUNBUFFERED=1
EOF

    local token="" akey="" src=""
    if [[ -f "$LUNARA_ETC/lumen.secret" ]]; then
        src="$LUNARA_ETC/lumen.secret"
    elif [[ -f "$LUNARA_ETC/lumen.env" ]]; then
        src="$LUNARA_ETC/lumen.env"
    else
        die "neither $LUNARA_ETC/lumen.secret nor lumen.env exists"
    fi
    read_env_value token DISCORD_TOKEN "$src"
    read_env_value akey ANTHROPIC_API_KEY "$src"
    [[ -n "$token" && -n "$akey" ]] || die "$src lacks DISCORD_TOKEN or ANTHROPIC_API_KEY"
    info "lumen secrets <- $src"
    write_env "$LUNARA_ETC/lumen.env" <<EOF
DISCORD_TOKEN=$token
ANTHROPIC_API_KEY=$akey
LUNARA_API_URL=http://127.0.0.1:8010
LUNARA_WS_URL=ws://127.0.0.1:8010/ws
PORT=8012
PYTHONUNBUFFERED=1
EOF
    if [[ "$src" == "$LUNARA_ETC/lumen.secret" ]]; then
        local t2="" k2=""
        read_env_value t2 DISCORD_TOKEN "$LUNARA_ETC/lumen.env"
        read_env_value k2 ANTHROPIC_API_KEY "$LUNARA_ETC/lumen.env"
        [[ "$t2" == "$token" && "$k2" == "$akey" ]] || die "lumen.env verification failed"
        shred -u "$LUNARA_ETC/lumen.secret" 2>/dev/null || rm -f "$LUNARA_ETC/lumen.secret"
        info "lumen.env verified; lumen.secret removed"
    fi
    find "$LUNARA_ETC" -maxdepth 1 -type f \( -name '*.env' -o -name '*.secret' \) \
        -exec chown root:lunara {} + -exec chmod 0640 {} +

    step "7. origin TLS key + CSR for api.lunara-app.com (key never leaves the box)"
    install -d -o root -g root -m 0750 "$TLS_DIR"
    if [[ -s "$TLS_KEY" ]]; then
        info "key exists (kept)"
    else
        (umask 077 && openssl req -new -newkey rsa:2048 -nodes -subj "/CN=$NGINX_SITE" \
            -keyout "$TLS_KEY" -out "$TLS_CSR" 2>/dev/null)
        info "generated key and CSR"
    fi
    if [[ ! -s "$TLS_CSR" ]]; then
        openssl req -new -key "$TLS_KEY" -subj "/CN=$NGINX_SITE" -out "$TLS_CSR"
        info "regenerated CSR from the existing key"
    fi
    chown root:root "$TLS_KEY" "$TLS_CSR"
    chmod 0600 "$TLS_KEY"
    chmod 0644 "$TLS_CSR"
    info "CSR (public): $TLS_CSR"
    if [[ -s "$TLS_CERT" ]]; then
        info "certificate present: $TLS_CERT"
    else
        info "certificate missing: issue a Cloudflare Origin CA cert for this CSR, then run"
        info "  deploy/oci/install_origin_cert.sh <cert.pem>   (see deploy/oci/README.md)"
    fi

    step "8. Redis: docker compose -p lunara up -d (127.0.0.1:6380)"
    docker compose -p lunara -f "$LUNARA_ROOT/deploy/docker-compose.redis.yml" up -d
    for _ in $(seq 1 15); do
        if docker exec lunara_redis redis-cli ping 2>/dev/null | grep -q PONG; then
            info "lunara_redis answers PONG"
            return 0
        fi
        sleep 1
    done
    die "lunara_redis did not answer PING within 15 s"
}

# Used by the laptop's --dry-run (run locally, prints only).
describe() {
    case "$1" in
        base)
            printf '%s\n' \
                "1. useradd --system lunara (home /opt/lunara, nologin) unless it exists" \
                "2. install -d /opt/lunara{,/bin,/olap} lunara:lunara 0755;" \
                "   /opt/lunara/{deploy,migrations} root:root 0755; /etc/lunara root:lunara 0750" \
                "2b. unless /opt/lunara/bin/python3.12 is 3.12: python3.11 -m venv /opt/lunara/.uv," \
                "   pip install uv==$UV_VERSION, uv python install 3.12 into /opt/lunara/python," \
                "   symlink /opt/lunara/bin/python3.12 (all as user lunara)"
            ;;
        finish)
            printf '%s\n' \
                "3. openssl rand -hex 24 > /etc/lunara/db.secret and -hex 32 > jwt.secret" \
                "   (only if missing; 0640 root:lunara; never printed)" \
                "4. docker exec -i sportsuite_db psql -U mlb_user -d postgres < \\set pw + sql/bootstrap_role_db.sql" \
                "   (CREATE ROLE lunara_app LOGIN NOSUPERUSER if missing; ALTER ROLE ... PASSWORD;" \
                "    CREATE DATABASE lunara OWNER lunara_app if missing; CONNECT only for lunara_app)" \
                "5. as lunara_app: CREATE TABLE IF NOT EXISTS schema_migrations; apply each" \
                "   /opt/lunara/migrations/*.sql not recorded there, in order, one transaction each" \
                "6. write /etc/lunara/api.env, ingestion.env, lumen.env (0640 root:lunara, atomic):" \
                "   SPORT_SUITE_API_KEY <- LUNARA_API_KEY from 'systemctl show $SS_API_UNIT'" \
                "   ESPN_PROXY_URL <- SPORTSBOOK_PROXY_URL from $SS_ENV" \
                "   DISCORD_TOKEN/ANTHROPIC_API_KEY <- /etc/lunara/lumen.secret (then verified + removed)" \
                "   or the existing lumen.env" \
                "7. install -d $TLS_DIR (0750 root:root); unless $TLS_KEY exists:" \
                "   openssl req -new -newkey rsa:2048 -nodes -subj /CN=$NGINX_SITE" \
                "   -> key (0600 root:root) + CSR $TLS_CSR (0644; its path is printed, nothing else)" \
                "8. docker compose -p lunara -f /opt/lunara/deploy/docker-compose.redis.yml up -d;" \
                "   wait for redis-cli PING (15 s)"
            ;;
    esac
}

main() {
    exec </dev/null
    case "${1:-}" in
        base) phase_base ;;
        finish) phase_finish ;;
        describe) describe "${2:-}" ;;
        *) die "usage: provision (base|finish|describe base|describe finish)" ;;
    esac
}

main "$@"
