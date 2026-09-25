"""Deploy artifacts encode the spec's placement decisions."""

import configparser
from pathlib import Path

import yaml

D = Path(__file__).parents[1] / "oci"


def unit(name):
    cp = configparser.ConfigParser(strict=False, interpolation=None)
    cp.optionxform = str
    cp.read(D / name)
    return cp


def test_api_unit():
    u = unit("lunara-api.service")["Service"]
    assert u["User"] == "lunara" and u["WorkingDirectory"] == "/opt/lunara/api"
    assert u["EnvironmentFile"] == "/etc/lunara/api.env" and u["CPUWeight"] == "400"
    assert "--host 127.0.0.1 --port 8010 --workers 1" in u["ExecStart"]
    assert u["Restart"] == "always"


def test_ingestion_unit():
    u = unit("lunara-ingestion.service")["Service"]
    assert u["User"] == "lunara" and u["CPUWeight"] == "400"
    assert (
        u["EnvironmentFile"] == "/etc/lunara/ingestion.env" and u["Restart"] == "always"
    )
    assert u["ExecStart"].endswith("python -m src")


def test_lumen_unit_uses_local_api():
    u = unit("cephalon-lumen.service")["Service"]
    assert u["User"] == "lunara" and u["WorkingDirectory"] == "/opt/lunara/lumen-bot"
    assert u["EnvironmentFile"] == "/etc/lunara/lumen.env"
    assert "CPUWeight" not in u


def test_units_install_into_multi_user_target():
    for name in (
        "lunara-api.service",
        "lunara-ingestion.service",
        "cephalon-lumen.service",
    ):
        assert unit(name)["Install"]["WantedBy"] == "multi-user.target"


def test_nginx_websocket_and_blocks():
    conf = (D / "nginx-api.lunara-app.com.conf").read_text()
    assert "server_name api.lunara-app.com;" in conf
    assert "proxy_pass http://127.0.0.1:8010" in conf
    assert (
        'proxy_set_header Connection "upgrade";' in conf
        and "proxy_read_timeout 3600s;" in conf
    )
    assert "location = /metrics { return 404; }" in conf  # not public
    # unauthenticated push endpoint
    assert "location /ws/publish { return 404; }" in conf


def _server_blocks(conf):
    """Top-level `server { ... }` blocks, split on brace depth."""
    blocks, depth, cur = [], 0, []
    for line in conf.splitlines():
        stripped = line.split("#", 1)[0]
        if depth == 0 and stripped.strip().startswith("server {"):
            cur = []
        if depth > 0 or stripped.strip().startswith("server {"):
            cur.append(line)
        depth += stripped.count("{") - stripped.count("}")
        if depth == 0 and cur:
            blocks.append("\n".join(cur))
            cur = []
    return blocks


def test_nginx_api_served_on_80_and_443_with_origin_cert():
    blocks = _server_blocks((D / "nginx-api.lunara-app.com.conf").read_text())
    api = [b for b in blocks if "server_name api.lunara-app.com;" in b]
    listens = sorted(
        line.strip() for b in api for line in b.splitlines() if "listen" in line
    )
    assert listens == ["listen 443 ssl;", "listen 80;"]
    tls = next(b for b in api if "listen 443 ssl;" in b)
    assert "ssl_certificate /etc/lunara/tls/api.lunara-app.com.pem;" in tls
    assert "ssl_certificate_key /etc/lunara/tls/api.lunara-app.com.key;" in tls
    for b in api:  # same locations on both ports
        assert "proxy_pass http://127.0.0.1:8010" in b
        assert "location = /metrics { return 404; }" in b
        assert "location /ws/publish { return 404; }" in b
        assert 'proxy_set_header Connection "upgrade";' in b
        assert "proxy_read_timeout 3600s;" in b


def test_nginx_api_blocks_never_default_and_443_has_catch_all():
    blocks = _server_blocks((D / "nginx-api.lunara-app.com.conf").read_text())
    for b in blocks:
        if "server_name api.lunara-app.com;" in b:
            assert "default_server" not in b
        else:  # the only other block: 443 catch-all that serves nothing
            assert "listen 443 ssl default_server;" in b and "return 444;" in b
            assert "proxy_pass" not in b
    assert len(blocks) == 3
    assert not any(
        "listen 80 default_server" in b for b in blocks
    )  # admin keeps port 80


def test_redis_bound_to_localhost_6380():
    svc = yaml.safe_load((D / "docker-compose.redis.yml").read_text())["services"][
        "lunara_redis"
    ]
    assert svc["ports"] == ["127.0.0.1:6380:6379"]
    assert "--maxmemory 256mb" in svc["command"] and "--save ''" in svc["command"]
