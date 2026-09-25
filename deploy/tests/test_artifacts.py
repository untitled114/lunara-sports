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


def test_nginx_listens_on_80():
    # The Cloudflare edge reaches this origin on port 80 today (see deploy/oci/README.md,
    # "TLS between Cloudflare and the origin"); no origin certificate exists on the box.
    conf = (D / "nginx-api.lunara-app.com.conf").read_text()
    assert "listen 80;" in conf


def test_redis_bound_to_localhost_6380():
    svc = yaml.safe_load((D / "docker-compose.redis.yml").read_text())["services"][
        "lunara_redis"
    ]
    assert svc["ports"] == ["127.0.0.1:6380:6379"]
    assert "--maxmemory 256mb" in svc["command"] and "--save ''" in svc["command"]
