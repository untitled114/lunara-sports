# Lunara on OCI `sport-suite-main`

Runbook for the Lunara backend (API, ingestion, Lumen bot) on the Oracle box
`sport-suite-main` (129.80.171.19). Everything runs from the laptop through the SSH alias
`ss-admin` (user `ubuntu`, passwordless sudo). Override it with `LUNARA_SSH_HOST`.

## Layout on the box

| Thing | Where |
|---|---|
| Lunara API | `lunara-api.service`, uvicorn on 127.0.0.1:**8010**, `CPUWeight=400` |
| Ingestion | `lunara-ingestion.service`, health server on `PORT=8011`, `CPUWeight=400` |
| Lumen bot | `cephalon-lumen.service`, health server on `PORT=8012` |
| Redis | container `lunara_redis` (compose project `lunara`), 127.0.0.1:**6380**, 256 MB LRU, no persistence |
| Postgres | `sportsuite_db` container, 127.0.0.1:5500, database `lunara`, role `lunara_app` |
| Code | `/opt/lunara/{api,ingestion,lumen-bot}`: symlinks to the live release `/opt/lunara/releases/<YYYYmmddTHHMMSS>/<svc>`, each release with its own `.venv` |
| Lumen logs | `/opt/lunara/shared/lumen-bot-logs`, linked as `logs/` in every release |
| Python | uv-managed CPython 3.12 at `/opt/lunara/python`, linked as `/opt/lunara/bin/python3.12` |
| Deploy bundle | `/opt/lunara/deploy` (this directory, minus tests) and `/opt/lunara/migrations` |
| Secrets | `/etc/lunara/{api,ingestion,lumen}.env`, `db.secret`, `jwt.secret` (0640 root:lunara, dir 0750 root:lunara) |
| nginx | `/etc/nginx/sites-available/api.lunara-app.com` (ports 80 and 443) and `000-lunara-default-443` (443 catch-all), both linked from `sites-enabled` |
| Origin TLS | `/etc/lunara/tls/api.lunara-app.com.{key,csr,pem}` (Cloudflare Origin CA) |
| OLAP export | `/opt/lunara/olap` |

Nothing goes under `/home/sportsuite/sport-suite`, because Sport-suite's deploy runs
`rsync --delete` on that tree. The scripts accept only these rsync destinations:
`/opt/lunara/<name>` and `/opt/lunara/releases/<YYYYmmddTHHMMSS>/<name>`.

The old GCP Lumen is gone: the GCP project is suspended. Only the OCI
`cephalon-lumen` holds the Discord token, so the owner won't get duplicate DMs.

The Sport-suite API (0.0.0.0:8000), Airflow (0.0.0.0:8080 and 8793), Grafana (3001),
Metabase (3000) and MLflow (5001) are not touched. Both Lunara health servers default to
port 8080, which Airflow already holds, so the env files set `PORT` explicitly. They also
set `HEALTH_HOST=127.0.0.1`, so the servers listen only on loopback.

## DNS

The controller creates the record once through the Cloudflare API (ruling R18); no
script does this:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `api.lunara-app.com` | `129.80.171.19` | proxied |

## Prerequisites already in place

- Port 443 on the box is open **only to Cloudflare's IPv4 ranges**, in both the OCI NSG
  `nsg-sportsuite` and host iptables. The controller did this with
  `~/ops/open_https_cloudflare.sh`. Nothing in `deploy/oci` touches firewalls.
- The DNS record above exists.

## TLS between Cloudflare and the origin

The zone's SSL mode is **Full**. `admin.lunara-app.com` works over plain HTTP to the origin
only because of a Page Rule (`admin.lunara-app.com/*` sets SSL to Flexible). The api
carries JWT-authenticated traffic, so it does **not** get that rule. Cloudflare reaches it
on **443** with a Cloudflare **Origin CA** certificate.

| File | Mode |
|---|---|
| `/etc/lunara/tls/` | dir 0750 root:root |
| `api.lunara-app.com.key` | 0600 root:root. Never leaves the box. The controller created it already; it is the same key as admin's `/etc/nginx/tls/admin.lunara-app.com.key`. provision.sh generates one only if it is missing and never regenerates an existing key. |
| `api.lunara-app.com.csr` | 0644. Public; provision.sh prints only its path. |
| `api.lunara-app.com.pem` | 0644 root:root. The Origin CA certificate, which covers admin and api. The controller installs it. |

There are two nginx files:
- `api.lunara-app.com` has two blocks, and both have `server_name api.lunara-app.com` and
  no `default_server`:
  - `listen 80;` still proxies, because Cloudflare may send `http://` visitors on 80. The
    file sorts after `admin.lunara-app.com`, so admin stays the implicit port-80 default
    (bare-IP traffic).
  - `listen 443 ssl;` has the same locations, `ssl_protocols TLSv1.2 TLSv1.3` and the
    origin cert.
- `000-lunara-default-443` is the only 443 `default_server`:
  `server_name _; return 444;`, with `ssl_protocols TLSv1.2 TLSv1.3`. It sorts first, so
  neither the api block nor admin's own `listen 443 ssl` block (explicit
  `server_name admin.lunara-app.com`, added by the controller) can become the implicit 443
  default. Unknown hosts get the connection closed without content.
  - nginx 1.18 has no `ssl_reject_handshake`, so the handshake still presents the origin
    certificate.
  - Checked in `nginx:1.18-alpine` with an admin 443 block alongside: `nginx -t` passes;
    api and admin are each served on 443; unknown SNI is closed; bare-IP port 80 still
    reaches admin.

### Origin certificate: issue, install, renew

1. `deploy/oci/provision.sh` creates the key and CSR. It is idempotent and never
   overwrites an existing key.
2. The controller fetches the CSR, a public file:
   `ssh ss-admin 'sudo cat /etc/lunara/tls/api.lunara-app.com.csr'`.
3. The controller issues the certificate through the Cloudflare API (Origin CA,
   `POST /certificates`), with the CSR, hostnames `api.lunara-app.com`, `request_type`
   `origin-rsa` and `requested_validity` **5475 days (15 years)**. The response's
   `certificate` is saved locally as a PEM file.
4. Run `deploy/oci/install_origin_cert.sh <cert.pem>`. It checks that the PEM parses,
   names the host and has not expired. It confirms that the cert's public key matches the
   key on the box, comparing public-key hashes only. It then installs the PEM with mode
   0644, and runs `nginx -t` and a reload if the site is already enabled.
5. `deploy.sh` refuses to run until the cert and key both exist, the cert is unexpired,
   and the two match. It fails with the exact next step and never falls back to port 80.

**Renewal.** The certificate is valid for 15 years (it expires around 2041). Only
Cloudflare's edge trusts Origin CA certs, so there is no public-CA renewal cycle. To
rotate it, or if the key is ever exposed:
1. Delete the key and CSR on the box.
2. Re-run `provision.sh`.
3. Issue a new certificate from the new CSR.
4. Run `install_origin_cert.sh`.
5. Revoke the old certificate in Cloudflare.

`deploy.sh` prints the expiry date on every run.

## Provision (once; safe to re-run)

```bash
deploy/oci/provision.sh --dry-run   # prints every step; makes no ssh connection
deploy/oci/provision.sh
```

What it does:
1. Creates the `lunara` system user if it is missing.
2. Creates `/opt/lunara` (lunara:lunara 0755) and `/etc/lunara` (root:lunara 0750).
3. Installs Python 3.12 (see below).
4. Stages `deploy/oci` and the migrations.
5. Generates the `lunara_app` password into `/etc/lunara/db.secret` and a JWT secret
   into `jwt.secret`, on the server. Neither is printed, and neither is regenerated on a
   re-run.
6. Creates the role `lunara_app` (LOGIN NOSUPERUSER) and the database `lunara` (OWNER
   `lunara_app`, CONNECT revoked from PUBLIC) as `mlb_user`. The SQL is
   `sql/bootstrap_role_db.sql`, sent on stdin.
   - The password is set as a SCRAM-SHA-256 verifier computed on the server with python3
     hashlib, so the plaintext never reaches Postgres.
   - The session also sets `log_statement=none`, `log_min_duration_statement=-1`,
     `log_min_error_statement=panic` and `pg_stat_statements.track_utility=off`.
7. Applies the migrations as `lunara_app` (see below).
8. Writes `/etc/lunara/{api,ingestion,lumen}.env` on the server:
   - `SPORT_SUITE_API_KEY` is `LUNARA_API_KEY` from `systemctl show sport-suite-api`.
   - `ESPN_PROXY_URL` is `SPORTSBOOK_PROXY_URL` from `/home/sportsuite/sport-suite/.env`.
   - The Lumen secrets come from `/etc/lunara/lumen.secret`, which the owner staged. That
     file is deleted once `lumen.env` has been written and verified. On re-runs they come
     from the existing `lumen.env`. If neither file exists, the laptop prompts for the
     values with hidden input and sends them over ssh stdin.
9. Generates the origin TLS key and CSR in `/etc/lunara/tls/` only if the key is missing.
   An existing key, such as the one the controller already created, is authoritative and
   never regenerated. It prints only the CSR path (see "Origin certificate").
10. Runs `docker compose -p lunara -f docker-compose.redis.yml up -d` and waits for PING.

**Python 3.12.** Ubuntu 22.04 on the box ships python3.10 (without ensurepip) and a
3.11.0 release candidate. There is no python3.12. Provision bootstraps `uv==0.12.19` in
`/opt/lunara/.uv` from python3.11, then runs `uv python install 3.12` into
`/opt/lunara/python`. It makes no apt changes.

**Migrations.** Every `storage/postgres/migrations/*.sql` runs in filename order, each in
one transaction together with its row in `schema_migrations` (filename, sha256). A failed
migration leaves no trace, and later runs apply only files that are not yet recorded. If a
file changes after it was applied, you get a warning and it is not re-run. None of the
migrations needs superuser: `gen_random_uuid()` is built into PG 16.

## Deploy (each release)

```bash
deploy/oci/deploy.sh --dry-run
deploy/oci/deploy.sh
```

**Never deploy between tip-off and final.** A deploy restarts `lunara-api`, and a restart
drops every WebSocket client on every live game at once. Deploy before the first tip-off
or after the last game of the night is final.

1. **Preflight, read-only, before anything is copied.** It checks:
   - the `lunara` user exists;
   - `/etc/lunara/{api,ingestion,lumen}.env` and `db.secret` exist;
   - `/opt/lunara/bin/python3.12` is 3.12;
   - the origin cert and key exist, the cert is unexpired, and the two match;
   - `/opt/lunara/<svc>` is absent or a symlink;
   - at least 2 GB is free;
   - `nginx -t` already passes.

   Any failure prints the exact next step.
2. **Stage a release.** The laptop runs `rsync --delete --mkpath` of `api/`,
   `ingestion/`, `lumen-bot/`, `deploy/oci` and the migrations into
   `/opt/lunara/releases/<YYYYmmddTHHMMSS>` (America/New_York). Tests, `.venv`, `logs/` and
   `.env` are excluded. Nothing live changes.
3. **Build fresh venvs in the release,** as `lunara`: `python3.12 -m venv .venv && pip install -c constraints.txt .`
   (the pip cache is `/opt/lunara/.cache/pip`). The pins are each service's committed
   `constraints.txt`, the versions its test suite passes with (CI installs the same); regenerate
   with `uv pip compile pyproject.toml --extra dev --python-version 3.12 --no-annotate -o constraints.txt`. `lumen-bot/logs` is linked to the shared
   log directory. The live venvs are untouched.
4. **Apply new migrations** from the release. Migrations are forward-only; a failure up to
   here leaves the live release running.
5. **Record a baseline and arm rollback.**
   - Baseline: the HTTP codes of `Host: admin.lunara-app.com http://127.0.0.1/grafana/`
     and bare-IP `http://127.0.0.1/`. Both must be real 3-digit codes. `000` (no
     connection) or empty fails the deploy here, before anything live changes, because two
     error states must never compare as "unchanged".
   - Rollback state: the previous symlink targets, each unit's enabled/active state, and
     copies of the unit files and both nginx files in `<release>/.rollback`.
6. **Swap and install.** Swap the `/opt/lunara/<svc>` symlinks atomically (`mv -T`),
   install the units (daemon-reload, enable) and both nginx files, run `nginx -t`, reload,
   then restart the three units.
7. **Gates,** retrying 30 times at 2 s intervals:
   - `127.0.0.1:8010/health` returns `"status":"ok"`;
   - `curl -skf --resolve api.lunara-app.com:443:127.0.0.1 https://api.lunara-app.com/health`;
   - `curl -sf -H 'Host: api.lunara-app.com' http://127.0.0.1/health`;
   - the admin `/grafana/` and bare-IP `/` codes are **unchanged** from the baseline. A
     `000` after the change always fails;
   - `SELECT count(*) FROM teams` as `lunara_app` is at least 30;
   - `journalctl -u lunara-ingestion --since @<restart>` contains `ingestion.starting`;
   - after 5 s, `cephalon-lumen` is active and `NRestarts` has not grown for any unit.
8. **Disarm rollback, then refresh `/opt/lunara/{deploy,migrations}`** from the release;
   `live_slate_check.py` runs from there. Once every gate has passed, a failure at this
   point is only a warning and never rolls back the healthy release.

**Automatic rollback** covers any failure after the swap. The script prints
`journalctl -n 50` for each unit, then:
- points the symlinks back to the previous release;
- restores the previous unit files and nginx files, or removes them on a first deploy;
- runs daemon-reload;
- restarts the units that were active before and stops the others;
- disables the units that this run enabled;
- reloads nginx if `nginx -t` passes.

Rollback is **best effort**: every step runs even if an earlier one fails, the failed
steps are listed under `ROLLBACK INCOMPLETE`, and the deploy exits non-zero either way.

Sport-suite services, Airflow, `sportsuite_db` and `lunara_redis` are never touched.

## Releases

Every deploy leaves `/opt/lunara/releases/<ts>` behind, with venvs of a few hundred MB.
Nothing prunes them automatically; deploy only prints a note when there are more than 5.
To prune by hand, keeping the live release and the one before it:
`ls -1d /opt/lunara/releases/*`, then `readlink /opt/lunara/api`, then `sudo rm -rf` the
older ones.

## Rollback (manual emergency stop)

```bash
deploy/oci/deploy.sh --rollback
```

This stops and disables `lunara-api`, `lunara-ingestion` and `cephalon-lumen`, removes both
Lunara nginx files, and reloads nginx if `nginx -t` passes. The releases, the database and
`/etc/lunara` are kept. To return to an older release instead, point the three
`/opt/lunara/<svc>` symlinks at it and restart the units.

## Live-slate check (go/no-go, spec decision 10)

`deploy.sh` stages this script with the bundle. Run it on the box during live games:

```bash
ssh ss-admin 'sudo -u lunara /opt/lunara/ingestion/.venv/bin/python /opt/lunara/deploy/live_slate_check.py'
# through ingestion's EspnHttp with the proxy fallback:
ssh ss-admin 'sudo -u lunara sh -c "set -a; . /etc/lunara/ingestion.env; exec /opt/lunara/ingestion/.venv/bin/python /opt/lunara/deploy/live_slate_check.py --via-ingestion"'
```

Keep `--seconds` short during live games (the default 90 s is the go/no-go run; do not
lengthen it or loop it). Every run doubles the ESPN load from the box IP: ingestion is
already polling each live game's `/summary` once per second from the same address, and
the check adds a second poller on top.

Run it **outside the Sport-suite pipeline windows**. Airflow's `nba_full_pipeline` runs
every 3 h at :30 from 2:30 AM to 8:30 PM ET, and `nba_daily_card` runs every 30 min;
check the Airflow UI for the night's schedule. Otherwise the whole-box CPU figure
includes the pipeline. For example, run it between 7:00 and 8:15 PM ET, or after
9:00 PM ET. The JSON also reports `lunara_units_cpu_pct`: each Lunara unit's own share of
the box over the window, from systemd `CPUUsageNSec`. It is informational, not a pass
rule; record it in the go-live record.

The script polls every live game's `/summary` once per second for 90 s, with gzip and
httpx's default User-Agent. The run passes only if all three hold:
- 0 non-200 responses. With `--via-ingestion`, a direct block that the proxy recovered
  counts as 200.
- The slowest round is under 1.0 s.
- Whole-box CPU is under 15%.

It exits 0 on PASS, 1 on FAIL and 2 when there are no live games. `--all-games --date
YYYYMMDD` exercises the script on a night with no live games; that is a smoke test only.

## Go-live checklist

Run this on the first live preseason night before Oct 20. The target is Sat 2026-10-03,
Heat vs Raptors.

1. [ ] `live_slate_check.py` on the box reports PASS.
2. [ ] `lunara-ingestion` logs show plays for every live game, with no `sink.flush_deferred`
   streaks.
3. [ ] `SELECT count(*) FROM plays` grows during games.
4. [ ] The frontend game page shows new plays within about 2 s of ESPN.
5. [ ] Pick sync pulled today's picks (`model_picks` has rows). After finals, the pick
   tracker PATCHed results, and the Sport-suite API log shows 200s.
6. [ ] Lumen DMs the owner a pick update.
7. [ ] The Grafana Pipeline Operations dashboard shows a Sport-suite pipeline run during
   games with no delay to Lunara, thanks to `CPUWeight`.

## Go-live record

_Empty until the first live night._
