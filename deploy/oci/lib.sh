# shellcheck shell=bash
# Laptop-side helpers shared by provision.sh and deploy.sh. Sourced, not executed.

set -euo pipefail

OCI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$OCI_DIR/../.." && pwd)"
SSH_HOST="${LUNARA_SSH_HOST:-ss-admin}"
DRY_RUN=0

parse_common_args() {
    local a
    for a in "$@"; do
        case "$a" in
            --dry-run) DRY_RUN=1 ;;
            -h | --help)
                sed -n '2,/^$/s/^# \{0,1\}//p' "$0"
                exit 0
                ;;
            *)
                printf 'unknown argument: %s\n' "$a" >&2
                exit 2
                ;;
        esac
    done
}

say() { printf '\n==> %s\n' "$*"; }

# Run a laptop-side command, or only print it under --dry-run.
run() {
    printf '    + %s\n' "$*"
    ((DRY_RUN)) || "$@"
}

# Run a server-side phase: remote/common.sh + remote/<script>.sh on ssh stdin, as root.
# Under --dry-run, print the command and the remote script's step list; no ssh.
remote() {
    local script="$1"
    shift
    local src="$OCI_DIR/remote/$script.sh"
    printf "    + cat remote/common.sh remote/%s.sh | ssh %s 'sudo bash -s -- %s'\n" \
        "$script" "$SSH_HOST" "$*"
    if ((DRY_RUN)); then
        # describe only prints; it runs locally and touches nothing.
        cat "$OCI_DIR/remote/common.sh" "$src" | bash -s -- describe "$1" | sed 's/^/      [remote] /'
        return 0
    fi
    # shellcheck disable=SC2029  # the phase name is expanded locally on purpose
    cat "$OCI_DIR/remote/common.sh" "$src" | ssh "$SSH_HOST" "sudo bash -s -- $*"
}

# rsync a local directory into a destination on the box via sudo rsync. Allowed
# destinations only: /opt/lunara/<name> (bundle, migrations) and
# /opt/lunara/releases/<YYYYmmddTHHMMSS>/<name> (a release being staged).
readonly DEST_RE='^/opt/lunara/([a-z][a-z-]*|releases/[0-9]{8}T[0-9]{6}/[a-z][a-z-]*)$'
push() {
    local src="$1" dest="$2" owner="$3"
    shift 3
    if ! [[ "$dest" =~ $DEST_RE ]]; then
        printf 'refusing rsync destination: %s\n' "$dest" >&2
        exit 1
    fi
    run rsync -rlptz --delete --mkpath --rsync-path="sudo rsync" --chown="$owner" \
        --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
        --exclude='__pycache__/' --exclude='*.pyc' --exclude='.pytest_cache/' \
        --exclude='.coverage' --exclude='htmlcov/' --exclude='.ruff_cache/' "$@" \
        "$src/" "$SSH_HOST:$dest/"
}

# stage_bundle [<base>]: deploy/oci and the migrations into <base>/{deploy,migrations}
# (default /opt/lunara, used by provision; deploy.sh passes its release dir).
stage_bundle() {
    local base="${1:-/opt/lunara}"
    say "stage deploy bundle and migrations into $base (rsync --delete)"
    push "$OCI_DIR" "$base/deploy" root:root --exclude='tests/' --exclude='*.md' \
        --exclude='__init__.py'
    push "$REPO_ROOT/storage/postgres/migrations" "$base/migrations" root:root \
        --include='*.sql' --exclude='*'
}
