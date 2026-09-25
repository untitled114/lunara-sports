"""Deploys and CI install pinned dependencies from each service's constraints.txt."""

import re
from pathlib import Path

import pytest
import yaml

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10 on a laptop; CI and prod are 3.12
    import tomli as tomllib

ROOT = Path(__file__).parents[2]
SERVICES = ("api", "ingestion", "lumen-bot")
PIN = re.compile(r"^([A-Za-z0-9][A-Za-z0-9._-]*)==[A-Za-z0-9.+!-]+$")


def _norm(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def _requirement_name(spec: str) -> str:
    return _norm(re.split(r"[\s\[<>=!~;]", spec, maxsplit=1)[0])


def _pins(svc: str) -> dict[str, str]:
    pins = {}
    for line in (ROOT / svc / "constraints.txt").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = PIN.match(line)
        assert m, f"{svc}/constraints.txt: not an exact pin: {line!r}"
        pins[_norm(m.group(1))] = line
    return pins


@pytest.mark.parametrize("svc", SERVICES)
def test_every_declared_dependency_is_pinned(svc):
    with open(ROOT / svc / "pyproject.toml", "rb") as fh:
        project = tomllib.load(fh)["project"]
    assert project["requires-python"] == ">=3.12"
    declared = project["dependencies"] + project["optional-dependencies"]["dev"]
    pins = _pins(svc)
    missing = sorted({_requirement_name(d) for d in declared} - pins.keys())
    assert missing == []


def test_services_agree_on_shared_pins():
    """CI's shared venv installs against all three files at once: no conflicts."""
    seen: dict[str, str] = {}
    for svc in SERVICES:
        for name, line in _pins(svc).items():
            assert seen.setdefault(name, line) == line, f"{svc}: {line} vs {seen[name]}"


def test_ci_installs_every_venv_with_the_constraints():
    ci = yaml.safe_load((ROOT / ".github/workflows/ci.yml").read_text())
    steps = ci["jobs"]["python-lint-test"]["steps"]
    runs = {s.get("name", ""): s.get("run", "") for s in steps}
    for svc, venv in (
        ("ingestion", "ingestion"),
        ("api", "api"),
        ("lumen-bot", "lumen"),
    ):
        run = runs[f"Set up {svc} venv"]
        assert re.search(
            rf"\.venv-{venv}/bin/pip install -q -c constraints\.txt ", run
        ), run
    shared = next(r for n, r in runs.items() if n.startswith("Set up shared venv"))
    for svc in SERVICES:
        assert f"{svc}/constraints.txt" in shared
    assert '"-c"' in shared
