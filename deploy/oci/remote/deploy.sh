# shellcheck shell=bash
# Server half of deploy/oci/deploy.sh. Sent after remote/common.sh on ssh stdin and run
# as root: `sudo bash -s -- deploy|rollback`. The laptop has already rsynced the code
# into /opt/lunara/{api,ingestion,lumen-bot}, the migrations into /opt/lunara/migrations
# and deploy/oci into /opt/lunara/deploy.
#
# Rollback touches ONLY Lunara: the three Lunara units and the api nginx site. It never
# stops Sport-suite services, Airflow, the sportsuite_db container or lunara_redis.

readonly NGINX_AVAIL=/etc/nginx/sites-available/$NGINX_SITE
readonly NGINX_ENABLED=/etc/nginx/sites-enabled/$NGINX_SITE
readonly GATE_TRIES=30
LIVE_CHANGED=0

print_logs() {
    local u
    for u in "${SERVICES[@]}"; do
        printf '\n----- journalctl -u %s -n 50 -----\n' "$u"
        journalctl -u "$u" -n 50 --no-pager 2>&1 || true
    done
}

rollback() {
    step "ROLLBACK: stop Lunara units, remove the api nginx site"
    systemctl stop "${SERVICES[@]}" 2>/dev/null || true
    rm -f "$NGINX_ENABLED" "$NGINX_AVAIL"
    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        info "nginx reloaded without $NGINX_SITE"
    else
        info "WARNING: nginx -t fails even without $NGINX_SITE; nginx NOT reloaded"
    fi
}

on_error() {
    local rc=$?
    trap - ERR
    printf '\nDEPLOY FAILED (exit %s)\n' "$rc" >&2
    if ((LIVE_CHANGED)); then
        print_logs
        rollback
    fi
    exit "$rc"
}

gate_fail() {
    printf '\nHEALTH GATE FAILED: %s\n' "$*" >&2
    return 1
}

# The nginx site needs the Cloudflare Origin CA cert + key. Checked before anything on
# the box changes; there is no silent fallback to port 80 only.
check_origin_tls() {
    step "1b. origin TLS for $NGINX_SITE"
    [[ -s "$TLS_KEY" ]] ||
        die "missing $TLS_KEY. Next step: run deploy/oci/provision.sh (generates key + CSR)."
    [[ -s "$TLS_CERT" ]] || die "missing $TLS_CERT. Next step: issue a Cloudflare Origin CA \
certificate for $TLS_CSR, then run deploy/oci/install_origin_cert.sh <cert.pem> \
(README: 'Origin certificate')."
    openssl x509 -in "$TLS_CERT" -noout -checkend 0 >/dev/null ||
        die "$TLS_CERT is unreadable or expired. Next step: re-issue and install_origin_cert.sh."
    local kpub cpub
    kpub="$(openssl pkey -in "$TLS_KEY" -pubout 2>/dev/null | sha256sum)"
    cpub="$(openssl x509 -in "$TLS_CERT" -noout -pubkey | sha256sum)"
    [[ "$kpub" == "$cpub" ]] ||
        die "$TLS_CERT does not match $TLS_KEY. Next step: issue the cert from $TLS_CSR."
    info "cert + key present and matching; expires $(openssl x509 -in "$TLS_CERT" -noout -enddate | cut -d= -f2)"
}

build_venvs() {
    [[ -x "$PY312" ]] || die "$PY312 missing (run provision.sh first)"
    local svc
    for svc in api ingestion lumen-bot; do
        step "2. venv for $svc"
        local d="$LUNARA_ROOT/$svc"
        [[ -f "$d/pyproject.toml" ]] || die "$d/pyproject.toml missing (rsync step)"
        if [[ ! -x "$d/.venv/bin/python" ]]; then
            sudo -u lunara -H "$PY312" -m venv "$d/.venv"
        fi
        (cd "$d" && sudo -u lunara -H "$d/.venv/bin/pip" install --no-cache-dir -q .)
        info "$svc: $("$d/.venv/bin/python" --version)"
    done
}

install_units_and_site() {
    step "4. install systemd units + nginx site, nginx -t, reload"
    local u
    for u in "${SERVICES[@]}"; do
        install -m 0644 -o root -g root "$LUNARA_ROOT/deploy/$u.service" \
            "/etc/systemd/system/$u.service"
    done
    systemctl daemon-reload
    systemctl enable "${SERVICES[@]}" >/dev/null
    LIVE_CHANGED=1
    install -m 0644 -o root -g root "$LUNARA_ROOT/deploy/nginx-api.lunara-app.com.conf" \
        "$NGINX_AVAIL"
    ln -sfn "$NGINX_AVAIL" "$NGINX_ENABLED"
    nginx -t
    systemctl reload nginx
}

health_gates() {
    step "6. health gates"
    local i body=""
    # Gate 1: /health answers 200 and reports postgres + redis up.
    for i in $(seq 1 "$GATE_TRIES"); do
        if body="$(curl -sf -m 5 http://127.0.0.1:8010/health)" &&
            [[ "$body" == *'"status":"ok"'* ]]; then
            info "gate 1 /health: $body"
            break
        fi
        ((i == GATE_TRIES)) && gate_fail "/health not 200 + status ok: ${body:-no response}"
        sleep 2
    done

    # Gate 2: a real DB read as lunara_app: the seeded teams table (migration 007).
    local teams
    teams="$(psql_app -At <<'SQL'
SELECT count(*) FROM teams;
SQL
)"
    if ! [[ "$teams" =~ ^[0-9]+$ ]] || ((teams < 30)); then
        gate_fail "SELECT count(*) FROM teams as lunara_app returned '${teams}', need >= 30"
    fi
    info "gate 2 DB: teams = $teams"

    # Gate 3: ingestion logged its start line.
    for i in $(seq 1 "$GATE_TRIES"); do
        if journalctl -u lunara-ingestion -n 20 --no-pager 2>/dev/null |
            grep -q 'ingestion.starting'; then
            info "gate 3 lunara-ingestion: ingestion.starting seen"
            break
        fi
        ((i == GATE_TRIES)) && gate_fail "no ingestion.starting in journalctl -u lunara-ingestion"
        sleep 2
    done

    # Lumen has no HTTP gate in the plan; require the unit to be running.
    systemctl is-active --quiet cephalon-lumen || gate_fail "cephalon-lumen not active"
    info "cephalon-lumen active"
}

do_deploy() {
    set -o errtrace
    trap on_error ERR
    [[ -f "$LUNARA_ETC/api.env" && -f "$LUNARA_ETC/db.secret" ]] ||
        die "/etc/lunara not provisioned (run provision.sh first)"
    check_origin_tls
    build_venvs
    step "3. apply new migrations"
    apply_migrations
    install_units_and_site
    step "5. systemctl restart ${SERVICES[*]}"
    systemctl restart "${SERVICES[@]}"
    health_gates
    trap - ERR
    step "deploy OK"
}

# Used by the laptop's --dry-run (run locally, prints only).
describe() {
    case "$1" in
        deploy)
            printf '%s\n' \
                "1b. preflight: $TLS_KEY and $TLS_CERT exist, cert not expired, cert matches key" \
                "   (else fail with the next step; nothing on the box has changed yet)" \
                "2. per service (api, ingestion, lumen-bot), as lunara: $PY312 -m venv .venv" \
                "   (if missing) && .venv/bin/pip install ." \
                "3. apply migrations not yet in schema_migrations (as lunara_app)" \
                "4. install {${SERVICES[*]}}.service -> /etc/systemd/system; daemon-reload; enable" \
                "   install nginx-api.lunara-app.com.conf -> $NGINX_AVAIL; symlink $NGINX_ENABLED;" \
                "   nginx -t; systemctl reload nginx" \
                "5. systemctl restart ${SERVICES[*]}" \
                "6. gates ($GATE_TRIES x 2 s): curl -sf 127.0.0.1:8010/health status ok;" \
                "   as lunara_app: SELECT count(*) FROM teams >= 30;" \
                "   journalctl -u lunara-ingestion -n 20 has ingestion.starting; cephalon-lumen active" \
                "   on any failure after step 4: print journalctl -n 50 per unit, then rollback"
            ;;
        rollback)
            printf '%s\n' \
                "print journalctl -n 50 for ${SERVICES[*]}" \
                "systemctl stop ${SERVICES[*]}" \
                "rm -f $NGINX_ENABLED $NGINX_AVAIL; nginx -t && systemctl reload nginx"
            ;;
    esac
}

main() {
    exec </dev/null
    case "${1:-}" in
        deploy) do_deploy ;;
        describe) describe "${2:-}" ;;
        rollback)
            print_logs
            rollback
            ;;
        *) die "usage: deploy (deploy|rollback|describe deploy|describe rollback)" ;;
    esac
}

main "$@"
