"""Stubbed end-to-end runs of remote/deploy.sh: release swap, gates and rollback.

The real script runs as root on the box. Here every path is redirected into tmp_path and
systemctl, nginx, curl, journalctl, sudo, rsync and psql are shell stubs driven by flag
files, so the control flow (arm, swap, gates, rollback, disarm) runs for real.
"""

import re
import shutil
import subprocess
from pathlib import Path

import pytest

OCI = Path(__file__).parents[1] / "oci"

pytestmark = pytest.mark.skipif(
    not (shutil.which("bash") and shutil.which("openssl")),
    reason="needs bash + openssl",
)

STUBS = r"""
id() { return 0; }
sudo() {
    echo "sudo cwd=$PWD $*" >> "$ST/sudo_log"
    shift 2; [[ "$1" == -H ]] && shift
    [[ "$1" == env ]] && shift; [[ "$1" == -i ]] && shift
    while [[ "$1" == *=* ]]; do shift; done
    if [[ "$*" == *"-m venv"* ]]; then
        mkdir -p "${@: -1}/bin"; ln -sf "$(command -v python3)" "${@: -1}/bin/python"
    fi
    return 0
}
nginx() { return 0; }
install() {
    if [[ "$1" == -d ]]; then mkdir -p "${@: -1}"; else cp "${@: -2:1}" "${@: -1}"; fi
}
systemctl() {
    echo "systemctl $*" >> "$ST/log"
    case "$1" in
        show) echo 0 ;;
        is-enabled) cat "$ST/enabled" 2>/dev/null || echo disabled ;;
        is-active) [[ "$2" == --quiet ]] && return 0; cat "$ST/active" 2>/dev/null || echo inactive ;;
        restart)
            if [[ -f "$ST/fail_rollback_restart" && -f "$ST/deploy_restarted" && "$2" == lunara-api ]]; then
                return 1
            fi
            touch "$ST/deploy_restarted" ;;
    esac
    return 0
}
journalctl() { echo "ingestion.starting"; }
apply_migrations() { :; }
psql_app() { cat >/dev/null; [[ -f "$ST/fail_teams" ]] && return 7; echo 30; }
curl() {
    local a="$*"
    if [[ "$a" == *"%{http_code}"* ]]; then
        if [[ "$a" == *grafana* ]]; then
            local n; n=$(cat "$ST/gc" 2>/dev/null || echo 0); echo $((n + 1)) > "$ST/gc"
            [[ -f "$ST/base000" ]] && { echo 000; return 7; }
            if ((n >= 1)); then
                [[ -f "$ST/post000" ]] && { echo 000; return 7; }
                [[ -f "$ST/post502" ]] && { echo 502; return 0; }
            fi
            echo 302
        else
            echo 404
        fi
    else
        echo '{"status":"ok"}'
    fi
}
rsync() { [[ -f "$ST/fail_rsync" ]] && return 23; return 0; }
sleep() { :; }
"""


@pytest.fixture
def box(tmp_path):
    root = tmp_path
    for d in (
        "opt/releases",
        "etc/lunara/tls",
        "sd",
        "ngx/sites-available",
        "ngx/sites-enabled",
        "state",
    ):
        (root / d).mkdir(parents=True)
    for f in ("api.env", "ingestion.env", "lumen.env", "db.secret"):
        (root / "etc/lunara" / f).write_text("x\n")
    tls = root / "etc/lunara/tls"
    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-days",
            "2",
            "-subj",
            "/CN=api.lunara-app.com",
            "-keyout",
            str(tls / "api.lunara-app.com.key"),
            "-out",
            str(tls / "api.lunara-app.com.pem"),
        ],
        check=True,
        capture_output=True,
    )
    script = (OCI / "remote/common.sh").read_text() + (
        OCI / "remote/deploy.sh"
    ).read_text()
    script = (
        script.rstrip("\n").rsplit("\n", 1)[0] + "\n"
    )  # drop the trailing `main "$@"`
    subs = {
        "readonly LUNARA_ROOT=/opt/lunara": f"readonly LUNARA_ROOT={root}/opt",
        "readonly LUNARA_ETC=/etc/lunara": f"readonly LUNARA_ETC={root}/etc/lunara",
        "/etc/lunara/tls": f"{root}/etc/lunara/tls",
        "/etc/systemd/system": f"{root}/sd",
        "/etc/nginx": f"{root}/ngx",
        "sys.version_info[:2] == (3, 12)": "True",
    }
    for old, new in subs.items():
        script = script.replace(old, new)
    script = re.sub(r"readonly PY312=.*", "readonly PY312=python3", script)
    script = re.sub(r"readonly MIN_FREE_KB=.*", "readonly MIN_FREE_KB=1", script)
    (root / "run.sh").write_text(script + f"ST={root}/state\n" + STUBS + 'main "$@"\n')
    return root


def make_release(box, ts, constraints=True):
    rel = box / "opt/releases" / ts
    for svc in ("api", "ingestion", "lumen-bot"):
        (rel / svc).mkdir(parents=True)
        (rel / svc / "pyproject.toml").write_text("")
        if constraints:
            (rel / svc / "constraints.txt").write_text("")
    (rel / "deploy").mkdir()
    (rel / "migrations").mkdir()
    for f in list(OCI.glob("*.service")) + list(OCI.glob("nginx-*.conf")):
        shutil.copy(f, rel / "deploy" / f.name)
    with open(rel / "deploy/nginx-api.lunara-app.com.conf", "a") as fh:
        fh.write(f"# release {ts}\n")
    return rel


def deploy(box, ts, *flags, constraints=True):
    state = box / "state"
    for name in ("gc", "deploy_restarted", "log", "sudo_log"):
        (state / name).unlink(missing_ok=True)
    for flag in flags:
        (state / flag).touch()
    make_release(box, ts, constraints=constraints)
    proc = subprocess.run(
        ["bash", str(box / "run.sh"), "deploy", ts],
        capture_output=True,
        text=True,
        timeout=60,
    )
    for flag in flags:
        (state / flag).unlink()
    return proc.returncode, proc.stdout + proc.stderr


def live(box):
    return Path((box / "opt/api").resolve()).parent.name


def second_deploy_setup(box):
    assert deploy(box, "20260101T000000")[0] == 0
    (box / "state/enabled").write_text("enabled\n")
    (box / "state/active").write_text("active\n")


def test_first_deploy_goes_live(box):
    rc, out = deploy(box, "20260101T000000")
    assert rc == 0, out
    assert live(box) == "20260101T000000" and "deploy OK" in out
    assert (box / "ngx/sites-enabled/000-lunara-default-443").is_symlink()


def test_unreachable_baseline_fails_before_any_live_change(box):
    second_deploy_setup(box)
    rc, out = deploy(box, "20260102T000000", "base000")
    assert rc != 0 and "baseline unreachable" in out
    assert "armed" not in out and "swap" not in out and "ROLLBACK" not in out
    assert live(box) == "20260101T000000"


@pytest.mark.parametrize(
    "flag,msg", [("post000", "admin unreachable"), ("post502", "admin regression")]
)
def test_admin_change_after_nginx_rolls_back_to_previous_release(box, flag, msg):
    second_deploy_setup(box)
    rc, out = deploy(box, "20260103T000000", flag)
    assert rc != 0 and msg in out and out.count("ROLLBACK to the state") == 1
    assert live(box) == "20260101T000000"
    site = (box / "ngx/sites-available/api.lunara-app.com").read_text()
    assert site.endswith("# release 20260101T000000\n")


def test_failure_in_command_substitution_rolls_back_once(box):
    second_deploy_setup(box)
    rc, out = deploy(box, "20260104T000000", "fail_teams")
    assert rc == 7
    assert out.count("DEPLOY FAILED") == 1 and out.count("ROLLBACK to the state") == 1
    assert live(box) == "20260101T000000"


def test_rollback_is_best_effort_and_reports_failed_steps(box):
    second_deploy_setup(box)
    rc, out = deploy(box, "20260105T000000", "fail_teams", "fail_rollback_restart")
    assert rc != 0
    assert "ROLLBACK INCOMPLETE: 1 step(s) failed" in out
    assert "  - systemctl restart lunara-api" in out
    log = (box / "state/log").read_text()
    after = log.split("systemctl restart lunara-api\n", 2)[
        -1
    ]  # the rollback's restarts on
    assert "systemctl restart lunara-ingestion" in after
    assert (
        "systemctl restart cephalon-lumen" in after
        and "systemctl reload nginx" in after
    )
    assert live(box) == "20260101T000000"


def test_post_gate_bookkeeping_failure_keeps_healthy_release(box):
    second_deploy_setup(box)
    rc, out = deploy(box, "20260106T000000", "fail_rsync")
    assert rc == 0, out
    assert "WARNING: could not refresh" in out and "ROLLBACK" not in out
    assert live(box) == "20260106T000000"


def test_first_deploy_failure_disables_units_it_enabled_and_removes_sites(box):
    rc, out = deploy(box, "20260101T000000", "fail_teams")
    assert rc != 0
    log = (box / "state/log").read_text()
    for u in ("lunara-api", "lunara-ingestion", "cephalon-lumen"):
        assert f"systemctl disable {u}" in log
    assert not (box / "ngx/sites-enabled/api.lunara-app.com").exists()
    assert not (box / "ngx/sites-enabled/000-lunara-default-443").exists()
    assert not (box / "opt/api").exists()


def test_venv_builds_run_as_lunara_with_its_own_home_and_cwd(box):
    rc, out = deploy(box, "20260101T000000")
    assert rc == 0, out
    calls = (box / "state/sudo_log").read_text().splitlines()
    assert len(calls) == 6  # venv + pip install, for each of the three services
    for call in calls:
        assert call.startswith(f"sudo cwd={box}/opt -u lunara -H env -i ")
        assert f" HOME={box}/opt " in call and " UV_NO_CONFIG=1 " in call
        assert f" PIP_CACHE_DIR={box}/opt/.cache/pip " in call
    rel = f"{box}/opt/releases/20260101T000000"
    for svc in ("api", "ingestion", "lumen-bot"):
        # pinned: every service installs against its committed constraints file
        assert any(
            c.endswith(f"pip install -q -c {rel}/{svc}/constraints.txt {rel}/{svc}")
            for c in calls
        ), calls


def test_missing_constraints_file_fails_before_any_live_change(box):
    second_deploy_setup(box)
    rc, out = deploy(box, "20260107T000000", constraints=False)
    assert rc != 0 and "constraints.txt missing" in out
    assert "armed" not in out and "ROLLBACK" not in out
    assert live(box) == "20260101T000000"


def test_laptop_rsync_ships_the_constraints_files():
    text = (OCI / "deploy.sh").read_text()
    excludes = re.findall(r"--exclude='([^']+)'", text)
    for pattern in excludes:
        assert not Path("constraints.txt").match(pattern), pattern
    assert "uv.lock" in excludes  # still excluded: pip installs from constraints.txt


def test_every_lunara_user_command_goes_through_as_lunara():
    for name in ("common.sh", "provision.sh", "deploy.sh"):
        text = (OCI / "remote" / name).read_text()
        raw = [ln for ln in text.splitlines() if "sudo -u lunara" in ln]
        if name == "common.sh":
            assert (
                len(raw) == 1 and "env -i" in raw[0]
            )  # the as_lunara definition itself
        else:
            assert raw == [], f"{name} runs sudo -u lunara outside as_lunara: {raw}"


def test_as_lunara_sets_cwd_home_and_uv_isolation(tmp_path):
    common = (
        (OCI / "remote/common.sh")
        .read_text()
        .replace("readonly LUNARA_ROOT=/opt/lunara", f"readonly LUNARA_ROOT={tmp_path}")
    )
    script = (
        common
        + 'sudo() { echo "cwd=$PWD"; printf "%s\\n" "$@"; }\nas_lunara uv --version\n'
    )
    proc = subprocess.run(
        ["bash", "-c", script],
        capture_output=True,
        text=True,
        cwd="/",
        timeout=10,
        check=True,
    )
    lines = proc.stdout.splitlines()
    assert lines[0] == f"cwd={tmp_path}"
    assert lines[1:6] == ["-u", "lunara", "-H", "env", "-i"]
    for want in (
        f"HOME={tmp_path}",
        "UV_NO_CONFIG=1",
        f"UV_CACHE_DIR={tmp_path}/.cache/uv",
        f"XDG_CONFIG_HOME={tmp_path}/.config",
        "PIP_CONFIG_FILE=/dev/null",
    ):
        assert want in lines
    assert lines[-2:] == ["uv", "--version"]
