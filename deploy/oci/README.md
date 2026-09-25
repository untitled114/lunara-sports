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
| nginx | `/etc/nginx/sites-available/api.lunara-app.com`, linked from `sites-enabled` |
| OLAP export | `/opt/lunara/olap` |

Nothing goes under `/home/sportsuite/sport-suite`, because Sport-suite's deploy runs
`rsync --delete` on that tree. The scripts refuse any rsync destination outside
`/opt/lunara`.

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

The zone's SSL mode reads "full", but on 2026-09-24 the box had nothing listening on 443
and no certificate: no `/etc/letsencrypt`, no Cloudflare origin cert, and
`admin.lunara-app.com` is served only by `listen 80;`. From outside, the origin's 443
times out, yet `https://admin.lunara-app.com` works through Cloudflare. So the edge
reaches this origin on port 80, and the api site does the same: `listen 80;` only.

To encrypt the edge-to-origin hop later:
1. Install a Cloudflare origin certificate.
2. Add `listen 443 ssl;` with `ssl_certificate` and `ssl_certificate_key` to both vhosts.
3. Open 443 in the OCI security list and in iptables.

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
9. Runs `docker compose -p lunara -f docker-compose.redis.yml up -d` and waits for PING.

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

1. Runs `rsync --delete` from `api/`, `ingestion/` and `lumen-bot/` into `/opt/lunara/<svc>`.
   It excludes tests, `.venv`, `logs/` and `.env`, so the excluded paths on the box survive.
   It also restages the bundle and the migrations.
2. Creates or updates each venv as `lunara`: `python3.12 -m venv .venv && .venv/bin/pip install .`.
3. Applies any new migrations.
4. Installs the three units (daemon-reload, enable) and the nginx site, runs `nginx -t`,
   then reloads nginx.
5. Runs `systemctl restart lunara-api lunara-ingestion cephalon-lumen`.
6. Runs the health gates, retrying 30 times at 2 s intervals:
   - `curl -sf 127.0.0.1:8010/health` must return `"status":"ok"`, which means Postgres
     and Redis are both up.
   - `curl -s 127.0.0.1:8010/health/db` must return 6/6. A 404 is reported and tolerated
     while the endpoint does not exist.
   - `journalctl -u lunara-ingestion -n 20` must contain `ingestion.starting`.
   - `cephalon-lumen` must be active.

If anything fails after step 4, the script prints `journalctl -n 50` for each unit, rolls
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
