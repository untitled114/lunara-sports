# shellcheck shell=bash
# Server half of deploy/oci/deploy.sh. Sent after remote/common.sh on ssh stdin and run
# as root: `sudo bash -s -- preflight | deploy <release> | rollback`.
#
#   preflight  read-only checks, run by the laptop BEFORE it rsyncs anything
#   deploy     the laptop has rsynced api/, ingestion/, lumen-bot/, deploy/oci and the
#              migrations into /opt/lunara/releases/<release>/. Build fresh venvs there,
#              apply migrations, then swap /opt/lunara/<svc> symlinks to the release,
#              install units + nginx, restart, gate. Any failure after the swap rolls back
#              to the previous release (or, on a first deploy, stops the units and
#              removes the Lunara nginx files).
#   rollback   manual emergency stop: stop + disable the Lunara units, remove the Lunara
#              nginx files, reload nginx.
#
# Everything here touches ONLY Lunara: the three Lunara units, /opt/lunara, and the two
# Lunara nginx files. Never Sport-suite services, Airflow, sportsuite_db or lunara_redis.

readonly NGINX_AVAIL=/etc/nginx/sites-available/$NGINX_SITE
readonly NGINX_ENABLED=/etc/nginx/sites-enabled/$NGINX_SITE
readonly CATCHALL=000-lunara-default-443
readonly CATCHALL_AVAIL=/etc/nginx/sites-available/$CATCHALL
readonly CATCHALL_ENABLED=/etc/nginx/sites-enabled/$CATCHALL
readonly RELEASES=$LUNARA_ROOT/releases
readonly CODE_SVCS=(api ingestion lumen-bot)
readonly GATE_TRIES=30
readonly MIN_FREE_KB=2000000

REL=""
ARMED=0
RB_FAILED=()
declare -A PREV_TARGET=() WAS_ENABLED=() WAS_ACTIVE=()
ADMIN_BASE=""
BARE_BASE=""

print_logs() {
    local u
    for u in "${SERVICES[@]}"; do
        printf '\n----- journalctl -u %s -n 50 -----\n' "$u"
        journalctl -u "$u" -n 50 --no-pager 2>&1 || true
    done
}

reload_nginx_if_valid() {
    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        info "nginx reloaded"
    else
        info "WARNING: nginx -t fails; nginx NOT reloaded (inspect: nginx -t)"
    fi
}

# Manual emergency stop (deploy.sh --rollback).
rollback_stop() {
    step "ROLLBACK: stop + disable Lunara units, remove the Lunara nginx files"
    systemctl stop "${SERVICES[@]}" 2>/dev/null || true
    systemctl disable "${SERVICES[@]}" 2>/dev/null || true
    rm -f "$NGINX_ENABLED" "$NGINX_AVAIL" "$CATCHALL_ENABLED" "$CATCHALL_AVAIL"
    reload_nginx_if_valid
}

# Automatic rollback after a failed deploy: restore exactly what was there before.
rollback_release() {
    step "ROLLBACK to the state before release $REL"
    # Best effort: every step runs even if an earlier one fails; failures are collected
    # and summarized, and the caller exits non-zero either way.
    set +e
    local svc u f
    RB_FAILED=()
    for svc in "${CODE_SVCS[@]}"; do
        if [[ -n "${PREV_TARGET[$svc]}" ]]; then
            rb ln -sfn "${PREV_TARGET[$svc]}" "$LUNARA_ROOT/.$svc.tmp" &&
                rb mv -Tf "$LUNARA_ROOT/.$svc.tmp" "$LUNARA_ROOT/$svc" &&
                info "$LUNARA_ROOT/$svc -> ${PREV_TARGET[$svc]}"
        else
            rb rm -f "$LUNARA_ROOT/$svc"
        fi
    done
    for u in "${SERVICES[@]}"; do
        if [[ -f "$REL/.rollback/$u.service" ]]; then
            rb install -m 0644 "$REL/.rollback/$u.service" "/etc/systemd/system/$u.service"
        fi
    done
    for f in "$NGINX_SITE" "$CATCHALL"; do
        if [[ -f "$REL/.rollback/nginx-$f" ]]; then
            rb install -m 0644 "$REL/.rollback/nginx-$f" "/etc/nginx/sites-available/$f"
            rb ln -sfn "/etc/nginx/sites-available/$f" "/etc/nginx/sites-enabled/$f"
        else
            rb rm -f "/etc/nginx/sites-enabled/$f" "/etc/nginx/sites-available/$f"
        fi
    done
    rb systemctl daemon-reload
    for u in "${SERVICES[@]}"; do
        if [[ "${WAS_ACTIVE[$u]}" == active ]]; then
            rb systemctl restart "$u"
        else
            rb systemctl stop "$u"
        fi
        if [[ "${WAS_ENABLED[$u]}" != enabled ]]; then
            rb systemctl disable "$u"
        fi
    done
    if nginx -t 2>/dev/null; then
        rb systemctl reload nginx
    else
        RB_FAILED+=("nginx -t (nginx NOT reloaded)")
    fi
    if ((${#RB_FAILED[@]})); then
        printf '\nROLLBACK INCOMPLETE: %d step(s) failed:\n' "${#RB_FAILED[@]}" >&2
        printf '  - %s\n' "${RB_FAILED[@]}" >&2
        return 1
    fi
    info "rollback complete: every step succeeded"
    return 0
}

# Run one rollback step; record a failure instead of aborting.
rb() {
    "$@" && return 0
    RB_FAILED+=("$*")
    printf '    ROLLBACK STEP FAILED: %s\n' "$*" >&2
    return 1
}

on_error() {
    local rc=$?
    # A failing command substitution runs this trap in a subshell too; only the main
    # shell may print logs and roll back, and only once.
    if ((BASH_SUBSHELL > 0)); then exit "$rc"; fi
    trap - ERR
    printf '\nDEPLOY FAILED (exit %s)\n' "$rc" >&2
    if ((ARMED)); then
        print_logs
        rollback_release || printf 'rollback needs manual follow-up (see above)\n' >&2
    else
        info "nothing live was changed; the release dir $REL is left for inspection"
    fi
    exit "$rc"
}

gate_fail() {
    printf '\nHEALTH GATE FAILED: %s\n' "$*" >&2
    return 1
}

# Origin cert + key for the api 443 block (Cloudflare Origin CA). No silent fallback.
check_origin_tls() {
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
    info "TLS: cert + key present and matching; expires \
$(openssl x509 -in "$TLS_CERT" -noout -enddate | cut -d= -f2)"
}

# Read-only. The laptop runs this before any rsync; deploy re-runs it.
preflight() {
    step "0. preflight (read-only)"
    id lunara >/dev/null 2>&1 || die "no lunara user. Next step: deploy/oci/provision.sh"
    local f
    for f in api.env ingestion.env lumen.env db.secret; do
        [[ -s "$LUNARA_ETC/$f" ]] || die "missing $LUNARA_ETC/$f. Next step: provision.sh"
    done
    if ! "$PY312" -c 'import sys; assert sys.version_info[:2] == (3, 12)' 2>/dev/null; then
        die "$PY312 is not a working Python 3.12. Next step: provision.sh"
    fi
    info "python: $("$PY312" --version)"
    check_origin_tls
    local svc
    for svc in "${CODE_SVCS[@]}"; do
        if [[ -e "$LUNARA_ROOT/$svc" && ! -L "$LUNARA_ROOT/$svc" ]]; then
            die "$LUNARA_ROOT/$svc is a real directory, not a release symlink; move it aside"
        fi
    done
    local free
    free="$(df -Pk "$LUNARA_ROOT" | awk 'NR == 2 {print $4}')"
    ((free >= MIN_FREE_KB)) || die "only ${free} KB free under $LUNARA_ROOT (need 2 GB)"
    nginx -t 2>/dev/null || die "nginx -t already fails before this deploy; fix nginx first"
    info "preflight OK (free: $((free / 1024)) MB; nginx -t passes)"
}

build_venvs() {
    local svc d
    for svc in "${CODE_SVCS[@]}"; do
        step "2. fresh venv for $svc in the release"
        d="$REL/$svc"
        [[ -f "$d/pyproject.toml" ]] || die "$d/pyproject.toml missing (rsync step)"
        # Pinned: the committed constraints.txt, the versions the test suites pass with.
        [[ -f "$d/constraints.txt" ]] || die "$d/constraints.txt missing (rsync step)"
        as_lunara "$PY312" -m venv "$d/.venv"
        as_lunara "$d/.venv/bin/pip" install -q -c "$d/constraints.txt" "$d"
        info "$svc: $("$d/.venv/bin/python" --version)"
    done
    # Lumen writes logs/game_context relative to its working directory: keep them across
    # releases.
    install -d -o lunara -g lunara -m 0755 "$LUNARA_ROOT/shared/lumen-bot-logs"
    ln -sfn "$LUNARA_ROOT/shared/lumen-bot-logs" "$REL/lumen-bot/logs"
}

http_code() { curl -s -m 5 -o /dev/null -w '%{http_code}' "$@" || true; }

# A real HTTP status is three digits, 1xx-5xx. curl prints 000 when it cannot connect.
is_http_code() { [[ "$1" =~ ^[1-5][0-9][0-9]$ ]]; }

capture_baseline() {
    ADMIN_BASE="$(http_code -H 'Host: admin.lunara-app.com' http://127.0.0.1/grafana/)"
    BARE_BASE="$(http_code http://127.0.0.1/)"
    # Pre-arm: an unreachable baseline fails the deploy before anything live changes;
    # two error states must never compare as "unchanged".
    is_http_code "$ADMIN_BASE" ||
        die "baseline unreachable: admin /grafana/ via 127.0.0.1:80 gave '${ADMIN_BASE}'"
    is_http_code "$BARE_BASE" ||
        die "baseline unreachable: bare-IP / via 127.0.0.1:80 gave '${BARE_BASE}'"
    info "baseline before nginx change: admin /grafana/ = $ADMIN_BASE, bare-IP / = $BARE_BASE"
}

arm_rollback() {
    local svc u f
    install -d -m 0700 "$REL/.rollback"
    for svc in "${CODE_SVCS[@]}"; do
        PREV_TARGET[$svc]="$(readlink "$LUNARA_ROOT/$svc" 2>/dev/null || true)"
    done
    for u in "${SERVICES[@]}"; do
        WAS_ENABLED[$u]="$(systemctl is-enabled "$u" 2>/dev/null || true)"
        WAS_ACTIVE[$u]="$(systemctl is-active "$u" 2>/dev/null || true)"
        if [[ -f "/etc/systemd/system/$u.service" ]]; then
            cp -p "/etc/systemd/system/$u.service" "$REL/.rollback/$u.service"
        fi
    done
    for f in "$NGINX_SITE" "$CATCHALL"; do
        if [[ -f "/etc/nginx/sites-available/$f" ]]; then
            cp -p "/etc/nginx/sites-available/$f" "$REL/.rollback/nginx-$f"
        fi
    done
    ARMED=1
    info "rollback armed (previous api release: ${PREV_TARGET[api]:-none})"
}

swap_and_install() {
    step "4. swap /opt/lunara/<svc> -> release; install units + nginx files; nginx -t; reload"
    local svc u
    for svc in "${CODE_SVCS[@]}"; do
        ln -sfn "$REL/$svc" "$LUNARA_ROOT/.$svc.tmp"
        mv -Tf "$LUNARA_ROOT/.$svc.tmp" "$LUNARA_ROOT/$svc"
    done
    for u in "${SERVICES[@]}"; do
        install -m 0644 -o root -g root "$REL/deploy/$u.service" "/etc/systemd/system/$u.service"
    done
    systemctl daemon-reload
    systemctl enable "${SERVICES[@]}" >/dev/null 2>&1
    install -m 0644 -o root -g root "$REL/deploy/nginx-api.lunara-app.com.conf" "$NGINX_AVAIL"
    install -m 0644 -o root -g root "$REL/deploy/nginx-$CATCHALL.conf" "$CATCHALL_AVAIL"
    ln -sfn "$NGINX_AVAIL" "$NGINX_ENABLED"
    ln -sfn "$CATCHALL_AVAIL" "$CATCHALL_ENABLED"
    nginx -t
    systemctl reload nginx
}

wait_for() { # wait_for <description> <command...>: retry GATE_TRIES x 2 s
    local what="$1" i
    shift
    for i in $(seq 1 "$GATE_TRIES"); do
        if "$@"; then return 0; fi
        ((i < GATE_TRIES)) || break
        sleep 2
    done
    gate_fail "$what"
}

health_ok() { [[ "$(curl -sf -m 5 "$@" 2>/dev/null || true)" == *'"status":"ok"'* ]]; }

health_gates() {
    local since="$1"
    declare -A nrestarts=()
    local u
    for u in "${SERVICES[@]}"; do
        nrestarts[$u]="$(systemctl show -p NRestarts --value "$u")"
    done

    step "6. health gates"
    wait_for "direct /health not 200 + status ok" health_ok http://127.0.0.1:8010/health
    info "gate 1 direct: 127.0.0.1:8010/health status ok"

    wait_for "https://api.lunara-app.com/health via nginx :443 not ok" \
        health_ok -k --resolve api.lunara-app.com:443:127.0.0.1 https://api.lunara-app.com/health
    wait_for "http://api.lunara-app.com/health via nginx :80 not ok" \
        health_ok -H 'Host: api.lunara-app.com' http://127.0.0.1/health
    info "gate 2 nginx: api /health ok on :443 and :80"

    local admin bare
    admin="$(http_code -H 'Host: admin.lunara-app.com' http://127.0.0.1/grafana/)"
    bare="$(http_code http://127.0.0.1/)"
    if ! is_http_code "$admin" || ! is_http_code "$bare"; then
        gate_fail "admin unreachable after the change: /grafana/ '$admin', bare-IP / '$bare'"
    fi
    [[ "$admin" == "$ADMIN_BASE" && "$bare" == "$BARE_BASE" ]] ||
        gate_fail "admin regression: /grafana/ $ADMIN_BASE -> $admin, bare-IP / $BARE_BASE -> $bare"
    info "gate 3 admin unchanged: /grafana/ = $admin, bare-IP / = $bare"

    local teams
    teams="$(psql_app -At <<'SQL'
SELECT count(*) FROM teams;
SQL
)"
    if ! [[ "$teams" =~ ^[0-9]+$ ]] || ((teams < 30)); then
        gate_fail "SELECT count(*) FROM teams as lunara_app returned '${teams}', need >= 30"
    fi
    info "gate 4 DB as lunara_app: teams = $teams"

    ingestion_started() {
        journalctl -u lunara-ingestion --since "@$since" --no-pager 2>/dev/null |
            grep -q 'ingestion.starting'
    }
    wait_for "no ingestion.starting from lunara-ingestion since the restart" ingestion_started
    info "gate 5 lunara-ingestion: ingestion.starting since @$since"

    sleep 5
    systemctl is-active --quiet cephalon-lumen || gate_fail "cephalon-lumen not active"
    for u in "${SERVICES[@]}"; do
        local now
        now="$(systemctl show -p NRestarts --value "$u")"
        [[ "$now" == "${nrestarts[$u]}" ]] ||
            gate_fail "$u restarted by systemd during the gates (NRestarts ${nrestarts[$u]} -> $now)"
    done
    info "gate 6 all units active, no crash-restarts"
}

# Runs after every gate passed and the ERR rollback is disarmed: a hiccup here is a
# warning, never a reason to roll back a healthy release.
finish_release() {
    step "7. record release $REL"
    local warn=0 n
    rsync -a --delete "$REL/deploy/" "$LUNARA_ROOT/deploy/" || {
        info "WARNING: could not refresh $LUNARA_ROOT/deploy from the release"
        warn=1
    }
    rsync -a --delete "$REL/migrations/" "$LUNARA_ROOT/migrations/" || {
        info "WARNING: could not refresh $LUNARA_ROOT/migrations from the release"
        warn=1
    }
    n="$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)" || n=0
    if ((n > 5)); then
        info "NOTE: $n releases under $RELEASES; old ones are not pruned automatically"
        info "      (README: 'Releases'). Current: $REL"
    fi
    ((warn == 0)) || info "WARNING: release is live and healthy; fix the warnings above by hand"
    return 0
}

do_deploy() {
    local release="${1:-}"
    [[ "$release" =~ ^[0-9]{8}T[0-9]{6}$ ]] || die "usage: deploy <YYYYmmddTHHMMSS>"
    REL="$RELEASES/$release"
    set -o errtrace
    trap on_error ERR

    preflight
    step "1. check the staged release $REL"
    local svc
    for svc in "${CODE_SVCS[@]}" deploy migrations; do
        [[ -d "$REL/$svc" ]] || die "$REL/$svc missing (rsync step)"
    done
    build_venvs
    step "3. apply new migrations (from the release)"
    apply_migrations "$REL/migrations"

    capture_baseline
    arm_rollback
    swap_and_install
    step "5. systemctl restart ${SERVICES[*]}"
    local since
    since="$(date +%s)"
    systemctl restart "${SERVICES[@]}"
    health_gates "$since"
    # All gates passed: disarm before any bookkeeping.
    trap - ERR
    set +o errtrace
    ARMED=0
    finish_release || info "WARNING: recording the release failed; the release stays live"
    step "deploy OK: release $release is live"
}

# Used by the laptop's --dry-run (run locally, prints only).
describe() {
    case "$1" in
        preflight)
            printf '%s\n' \
                "0. preflight, read-only, before ANY rsync: lunara user; /etc/lunara/{api,ingestion,lumen}.env" \
                "   + db.secret; $PY312 is 3.12; $TLS_KEY + $TLS_CERT present, unexpired, matching;" \
                "   /opt/lunara/{api,ingestion,lumen-bot} absent or symlinks; >= 2 GB free; nginx -t passes"
            ;;
        deploy)
            printf '%s\n' \
                "0. preflight again (same checks)" \
                "1. release dir $RELEASES/<release>/{api,ingestion,lumen-bot,deploy,migrations} complete" \
                "2. fresh venv per service IN THE RELEASE, via as_lunara (cwd/HOME /opt/lunara, env -i):" \
                "   $PY312 -m venv <svc>/.venv && <svc>/.venv/bin/pip install -c <svc>/constraints.txt <svc>" \
                "   (live /opt/lunara/<svc> untouched); lumen-bot/logs -> $LUNARA_ROOT/shared/lumen-bot-logs" \
                "3. apply migrations from the release not yet in schema_migrations (as lunara_app)" \
                "   -- a failure up to here changes nothing live (DB migrations are forward-only)" \
                "   baseline: admin /grafana/ and bare-IP / HTTP codes on 127.0.0.1:80" \
                "   arm rollback: previous symlink targets, unit enabled/active state, copies of" \
                "   unit files + nginx files into <release>/.rollback" \
                "4. swap /opt/lunara/<svc> symlinks to the release (atomic mv -T); install" \
                "   {${SERVICES[*]}}.service; daemon-reload; enable; install $NGINX_AVAIL and" \
                "   $CATCHALL_AVAIL (+ sites-enabled links); nginx -t; reload" \
                "5. systemctl restart ${SERVICES[*]}" \
                "6. gates ($GATE_TRIES x 2 s): 127.0.0.1:8010/health status ok;" \
                "   curl -skf --resolve api.lunara-app.com:443:127.0.0.1 https://api.lunara-app.com/health;" \
                "   curl -sf -H 'Host: api.lunara-app.com' http://127.0.0.1/health;" \
                "   admin /grafana/ + bare-IP / codes equal the baseline; teams >= 30 as lunara_app;" \
                "   journalctl -u lunara-ingestion --since @<restart> has ingestion.starting;" \
                "   after 5 s: cephalon-lumen active and NRestarts unchanged for all three units" \
                "   any failure after the swap: journalctl -n 50 per unit, then roll back to the" \
                "   previous release (symlinks, unit files, nginx files, enabled/active state);" \
                "   rollback is best effort: every step runs, failures are summarized, exit non-zero" \
                "   (the baseline itself must be real HTTP codes, else fail before any change;" \
                "    000 after the change always fails)" \
                "7. gates passed: disarm rollback, then refresh $LUNARA_ROOT/{deploy,migrations}" \
                "   from the release (a failure here is a warning, never a rollback)"
            ;;
        rollback)
            printf '%s\n' \
                "print journalctl -n 50 for ${SERVICES[*]}" \
                "systemctl stop + disable ${SERVICES[*]}" \
                "rm -f $NGINX_ENABLED $NGINX_AVAIL $CATCHALL_ENABLED $CATCHALL_AVAIL" \
                "nginx -t && systemctl reload nginx"
            ;;
    esac
}

main() {
    exec </dev/null
    case "${1:-}" in
        preflight) preflight ;;
        deploy) do_deploy "${2:-}" ;;
        describe) describe "${2:-}" ;;
        rollback)
            print_logs
            rollback_stop
            ;;
        *) die "usage: deploy (preflight|deploy <release>|rollback|describe <phase>)" ;;
    esac
}

main "$@"
