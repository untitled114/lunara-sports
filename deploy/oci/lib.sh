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

# rsync a local directory into a root-owned destination on the box via sudo rsync.
# Only /opt/lunara/* destinations are allowed.
push() {
    local src="$1" dest="$2" owner="$3"
    shift 3
    case "$dest" in
        /opt/lunara/*) ;;
        *)
            printf 'refusing rsync destination outside /opt/lunara: %s\n' "$dest" >&2
            exit 1
            ;;
    esac
    run rsync -rlptz --delete --rsync-path="sudo rsync" --chown="$owner" \
        --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
        --exclude='__pycache__/' --exclude='*.pyc' --exclude='.pytest_cache/' \
        --exclude='.coverage' --exclude='htmlcov/' --exclude='.ruff_cache/' "$@" \
        "$src/" "$SSH_HOST:$dest/"
}

stage_bundle() {
    say "stage deploy bundle and migrations (rsync --delete, /opt/lunara only)"
    push "$OCI_DIR" /opt/lunara/deploy root:root --exclude='tests/' --exclude='*.md'
    push "$REPO_ROOT/storage/postgres/migrations" /opt/lunara/migrations root:root \
        --include='*.sql' --exclude='*'
}
