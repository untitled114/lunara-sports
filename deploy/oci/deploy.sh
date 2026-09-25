#!/usr/bin/env bash
# Deploy a Lunara release to sport-suite-main, run from the laptop (after provision.sh).
#
#   deploy/oci/deploy.sh [--dry-run]     stage, build, migrate, install, restart, gate
#   deploy/oci/deploy.sh --rollback      stop the Lunara units, remove the api nginx site
#
# Uses the SSH alias ss-admin (ubuntu, passwordless sudo); override with LUNARA_SSH_HOST.
# Code goes only to /opt/lunara. If a health gate fails the server half prints the unit
# logs and rolls back the Lunara units and nginx site only; it never touches Sport-suite
# services, Airflow or the database container. --dry-run prints every step, no ssh.

# shellcheck source=deploy/oci/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

ROLLBACK=0
args=()
for a in "$@"; do
    if [[ "$a" == --rollback ]]; then ROLLBACK=1; else args+=("$a"); fi
done
parse_common_args "${args[@]+"${args[@]}"}"
((DRY_RUN)) && say "DRY RUN: nothing is executed and no ssh connection is made"

if ((ROLLBACK)); then
    say "rollback: stop lunara-api, lunara-ingestion, cephalon-lumen; remove nginx api site"
    remote deploy rollback
    exit 0
fi

say "1. stage code without tests (rsync --delete into /opt/lunara/<svc>)"
code_excludes=(--exclude='tests/' --exclude='.venv/' --exclude='logs/' --exclude='.env'
    --exclude='build/' --exclude='*.egg-info/' --exclude='Dockerfile' --exclude='uv.lock'
    --exclude='*.service' --exclude='entrypoint.sh')
for svc in api ingestion lumen-bot; do
    push "$REPO_ROOT/$svc" "/opt/lunara/$svc" lunara:lunara "${code_excludes[@]}"
done
stage_bundle

say "2-6. venvs, migrations, units + nginx, restart, health gates (server side)"
remote deploy deploy

say "deploy complete"
