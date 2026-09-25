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
| Code | `/opt/lunara/{api,ingestion,lumen-bot}`, each with its own `.venv` |
| Python | uv-managed CPython 3.12 at `/opt/lunara/python`, linked as `/opt/lunara/bin/python3.12` |
| Deploy bundle | `/opt/lunara/deploy` (this directory, minus tests) and `/opt/lunara/migrations` |
| Secrets | `/etc/lunara/{api,ingestion,lumen}.env`, `db.secret`, `jwt.secret` (0640 root:lunara, dir 0750 root:lunara) |
| nginx | `/etc/nginx/sites-available/api.lunara-app.com`, linked from `sites-enabled` (ports 80 and 443) |
| Origin TLS | `/etc/lunara/tls/api.lunara-app.com.{key,csr,pem}` (Cloudflare Origin CA) |
| OLAP export | `/opt/lunara/olap` |

Nothing goes under `/home/sportsuite/sport-suite`, because Sport-suite's deploy runs
`rsync --delete` on that tree. The scripts refuse any rsync destination outside
`/opt/lunara`.

The old GCP Lumen is gone: the GCP project is suspended. Only the OCI
`cephalon-lumen` holds the Discord token, so the owner won't get duplicate DMs.

The Sport-suite API (0.0.0.0:8000), Airflow (0.0.0.0:8080 and 8793), Grafana (3001),
Metabase (3000) and MLflow (5001) are not touched. Both Lunara health servers default to
port 8080, which Airflow already holds, so the env files set `PORT` explicitly.

## DNS

The controller creates the record once through the Cloudflare API (ruling R18); no
script does this:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `api.lunara-app.com` | `129.80.171.19` | proxied |

## TLS between Cloudflare and the origin

The zone's SSL mode is **Full**. `admin.lunara-app.com` works over plain HTTP to the origin
only because of a Page Rule (`admin.lunara-app.com/*` sets SSL to Flexible). The api
carries JWT-authenticated traffic, so it does **not** get that rule. Cloudflare reaches it
on **443** with a Cloudflare **Origin CA** certificate.

| File | Mode |
|---|---|
| `/etc/lunara/tls/` | dir 0750 root:root |
| `api.lunara-app.com.key` | 0600 root:root. Generated on the box by provision.sh; never leaves it. |
| `api.lunara-app.com.csr` | 0644. Public; provision.sh prints only its path. |
| `api.lunara-app.com.pem` | 0644 root:root. The Origin CA certificate. |

The nginx site has three server blocks:
- `listen 80;` for `api.lunara-app.com`. It still proxies, because Cloudflare may send
  `http://` visitors on 80. It sorts after `admin.lunara-app.com`, so admin stays the
  implicit port-80 default.
- `listen 443 ssl;` for `api.lunara-app.com`, with the same locations.
- A `listen 443 ssl default_server; server_name _; return 444;` catch-all. It stops the api
  block from becoming the implicit 443 default and from answering for other hosts. nginx
  1.18 on the box has no `ssl_reject_handshake`, so the catch-all presents the same
  certificate during the handshake and then closes the connection without content.

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
7. Applies the migrations as `lunara_app` (see below).
8. Writes `/etc/lunara/{api,ingestion,lumen}.env` on the server:
   - `SPORT_SUITE_API_KEY` is `LUNARA_API_KEY` from `systemctl show sport-suite-api`.
   - `ESPN_PROXY_URL` is `SPORTSBOOK_PROXY_URL` from `/home/sportsuite/sport-suite/.env`.
   - The Lumen secrets come from `/etc/lunara/lumen.secret`, which the owner staged. That
     file is deleted once `lumen.env` has been written and verified. On re-runs they come
     from the existing `lumen.env`. If neither file exists, the laptop prompts for the
     values with hidden input and sends them over ssh stdin.
9. Generates the origin TLS key and CSR in `/etc/lunara/tls/` if the key is missing, and
   prints only the CSR path (see "Origin certificate").
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

1. Checks before changing anything on the box: the origin cert and key must exist, the
   cert must be unexpired, and the two must match. Otherwise the script fails with the
   next step.
2. Runs `rsync --delete` from `api/`, `ingestion/` and `lumen-bot/` into `/opt/lunara/<svc>`.
   It excludes tests, `.venv`, `logs/` and `.env`, so the excluded paths on the box survive.
   It also restages the bundle and the migrations. (The laptop runs the rsync first; the TLS
   check is the first server-side step.)
3. Creates or updates each venv as `lunara`: `python3.12 -m venv .venv && .venv/bin/pip install .`.
4. Applies any new migrations.
5. Installs the three units (daemon-reload, enable) and the nginx site, runs `nginx -t`,
   then reloads nginx.
6. Runs `systemctl restart lunara-api lunara-ingestion cephalon-lumen`.
7. Runs the health gates, retrying 30 times at 2 s intervals:
   - `curl -sf 127.0.0.1:8010/health` must return `"status":"ok"`, which means Postgres
     and Redis are both up.
   - `SELECT count(*) FROM teams` as `lunara_app` must return at least 30 (the teams
     seeded by migration 007).
   - `journalctl -u lunara-ingestion -n 20` must contain `ingestion.starting`.
   - `cephalon-lumen` must be active.

If anything fails after the units and site are installed (step 5), the script prints `journalctl -n 50` for each unit, rolls
back and exits non-zero.

## Rollback

```bash
deploy/oci/deploy.sh --rollback
```

Rollback stops `lunara-api`, `lunara-ingestion` and `cephalon-lumen`, removes the api
nginx site, and reloads nginx only if `nginx -t` passes. It never touches Sport-suite
services, Airflow, `sportsuite_db` or `lunara_redis`. The database and `/etc/lunara` are
kept.

## Live-slate check (go/no-go, spec decision 10)

`deploy.sh` stages this script with the bundle. Run it on the box during live games:

```bash
ssh ss-admin 'sudo -u lunara /opt/lunara/ingestion/.venv/bin/python /opt/lunara/deploy/live_slate_check.py'
# through ingestion's EspnHttp with the proxy fallback:
ssh ss-admin 'sudo -u lunara sh -c "set -a; . /etc/lunara/ingestion.env; exec /opt/lunara/ingestion/.venv/bin/python /opt/lunara/deploy/live_slate_check.py --via-ingestion"'
```

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
