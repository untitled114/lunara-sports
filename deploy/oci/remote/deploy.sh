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
    local i body
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

    # Gate 2: /health/db. The plan expects "6/6"; the endpoint does not exist in the API
    # at the time of writing, so a 404 is reported and gate 1's postgres=true stands in.
    local code
    code="$(curl -s -m 5 -o /tmp/lunara_health_db.$$ -w '%{http_code}' \
        http://127.0.0.1:8010/health/db || true)"
    body="$(cat /tmp/lunara_health_db.$$ 2>/dev/null || true)"
    rm -f /tmp/lunara_health_db.$$
    if [[ "$code" == 404 ]]; then
        info "gate 2 /health/db: 404 (endpoint not implemented; gate 1 covers postgres)"
    elif [[ "$code" == 200 && "$body" =~ ([0-9]+)/([0-9]+) &&
        "${BASH_REMATCH[1]}" == "${BASH_REMATCH[2]}" && "${BASH_REMATCH[2]}" == 6 ]]; then
        info "gate 2 /health/db: $body"
    else
        gate_fail "/health/db expected 6/6, got HTTP $code: $body"
    fi

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
                "2. per service (api, ingestion, lumen-bot), as lunara: $PY312 -m venv .venv" \
                "   (if missing) && .venv/bin/pip install ." \
                "3. apply migrations not yet in schema_migrations (as lunara_app)" \
                "4. install {${SERVICES[*]}}.service -> /etc/systemd/system; daemon-reload; enable" \
                "   install nginx-api.lunara-app.com.conf -> $NGINX_AVAIL; symlink $NGINX_ENABLED;" \
                "   nginx -t; systemctl reload nginx" \
                "5. systemctl restart ${SERVICES[*]}" \
                "6. gates ($GATE_TRIES x 2 s): curl -sf 127.0.0.1:8010/health status ok;" \
                "   curl -s 127.0.0.1:8010/health/db 6/6 (404 = not implemented, reported);" \
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
