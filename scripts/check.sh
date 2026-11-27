#!/usr/bin/env bash
# The definition of passing for this repository: lint and tests, each service in its own
# Python 3.12 virtual environment built from its pinned constraints.
#
#   scripts/check.sh --stage all|envs|lint|api|ingestion|integration|frontend
#
# `envs` only builds the environments (what the Makefile's dev targets need).
#
# Environments live in .ci/ (gitignored) and are reused when their inputs did not change.
# Set TEST_DATABASE_URL to a throwaway local Postgres to also run the real-database tests
# (tests/integration and the ingestion DB tests); without it they skip.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PY="${CHECK_PYTHON:-python3.12}"
STAGE="all"
while [ $# -gt 0 ]; do
    case "$1" in
        --stage) STAGE="${2:?--stage needs a value}"; shift 2 ;;
        -h | --help) sed -n '2,10p' "$0"; exit 0 ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

# venv NAME DIR: a venv with DIR's package and dev extras under DIR's constraints.
venv() {
    local name="$1" dir="$2" env=".ci/$1"
    local stamp
    stamp="$(cat "$dir/pyproject.toml" "$dir/constraints.txt" | sha256sum | cut -c1-16)"
    if [ ! -f "$env/.stamp" ] || [ "$(cat "$env/.stamp")" != "$stamp" ]; then
        rm -rf "$env"
        "$PY" -m venv "$env"
        "$env/bin/pip" install -q --upgrade pip
        (cd "$dir" && "$ROOT/$env/bin/pip" install -q -c constraints.txt -e ".[dev]")
        echo "$stamp" > "$env/.stamp"
    fi
}

# The cross-service tests load api/src and ingestion/src by path, so this venv has both
# services' dependencies and neither `src` package.
shared_venv() {
    local env=".ci/shared" stamp
    stamp="$(cat api/pyproject.toml api/constraints.txt ingestion/pyproject.toml \
        ingestion/constraints.txt | sha256sum | cut -c1-16)"
    if [ ! -f "$env/.stamp" ] || [ "$(cat "$env/.stamp")" != "$stamp" ]; then
        rm -rf "$env"
        "$PY" -m venv "$env"
        "$env/bin/pip" install -q --upgrade pip
        "$env/bin/python3" - <<'PY'
import subprocess, sys, tomllib
deps = []
for path in ("ingestion/pyproject.toml", "api/pyproject.toml"):
    with open(path, "rb") as f:
        project = tomllib.load(f)["project"]
    deps += project.get("dependencies", []) + project.get("optional-dependencies", {}).get("dev", [])
pins = ["-c", "ingestion/constraints.txt", "-c", "api/constraints.txt"]
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", *pins, *deps])
PY
        echo "$stamp" > "$env/.stamp"
    fi
}

run_lint() {
    venv api api && venv ingestion ingestion
    (cd api && ../.ci/api/bin/ruff check src tests && ../.ci/api/bin/ruff format --check src tests)
    (cd ingestion && ../.ci/ingestion/bin/ruff check src tests &&
        ../.ci/ingestion/bin/ruff format --check src tests)
    # tests/ (the cross-service tests) has no ruff config of its own: ruff's defaults
    .ci/api/bin/ruff check tests
    .ci/api/bin/ruff format --check tests
}
run_envs() { venv api api && venv ingestion ingestion; }
run_api() { venv api api && (cd api && ../.ci/api/bin/pytest tests -q --cov); }
run_ingestion() { venv ingestion ingestion && (cd ingestion && ../.ci/ingestion/bin/pytest tests -q --cov); }
run_integration() { shared_venv && .ci/shared/bin/pytest tests/integration -q; }

# The website: install, unit tests, the design check, then a production build.
run_frontend() { (cd frontend && npm ci --no-audit --no-fund && npx vitest run && npm run -s design:check && npx vite build); }

case "$STAGE" in
    all)
        for s in lint api ingestion integration frontend; do
            echo "== $s"
            "run_$s"
        done
        echo "ALL PASSED: lint api ingestion integration frontend"
        ;;
    envs | lint | api | ingestion | integration | frontend) "run_$STAGE" ;;
    *) echo "unknown stage: $STAGE" >&2; exit 2 ;;
esac
