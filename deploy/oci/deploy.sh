#!/usr/bin/env bash
# Deploy a Lunara release to sport-suite-main, run from the laptop (after provision.sh).
#
#   deploy/oci/deploy.sh [--dry-run]     preflight, stage a release, build, migrate,
#                                        swap, install, restart, gate
#   deploy/oci/deploy.sh --rollback      emergency stop: stop + disable the Lunara units,
#                                        remove the Lunara nginx files
#
# Uses the SSH alias ss-admin (ubuntu, passwordless sudo); override with LUNARA_SSH_HOST.
# A read-only preflight runs on the box before anything is copied. Each release is staged
# in /opt/lunara/releases/<YYYYmmddTHHMMSS> (America/New_York) with its own venvs; the
# live /opt/lunara/<svc> symlinks move only after the venvs and migrations succeed. A
# failed gate prints the unit logs and rolls back to the previous release (Lunara units,
# symlinks and nginx files only; never Sport-suite services, Airflow or the database
# container). --dry-run prints every step and makes no ssh connection.

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
    say "rollback: stop + disable the Lunara units; remove the Lunara nginx files"
    remote deploy rollback
    exit 0
fi

say "0. preflight on the box (read-only; nothing is copied before it passes)"
remote deploy preflight

release="$(TZ=America/New_York date +%Y%m%dT%H%M%S)"
rel_dir="/opt/lunara/releases/$release"
say "1. stage release $release without tests (rsync --delete into $rel_dir)"
code_excludes=(--exclude='tests/' --exclude='.venv/' --exclude='logs/' --exclude='.env'
    --exclude='build/' --exclude='*.egg-info/' --exclude='Dockerfile' --exclude='uv.lock'
    --exclude='*.service' --exclude='entrypoint.sh')
for svc in api ingestion lumen-bot; do
    push "$REPO_ROOT/$svc" "$rel_dir/$svc" lunara:lunara "${code_excludes[@]}"
done
stage_bundle "$rel_dir"

say "2-7. venvs, migrations, swap, units + nginx, restart, gates (server side)"
remote deploy deploy "$release"

say "deploy complete: release $release"
