# Lunara Backend → Oracle Cloud (sport-suite-main) — Design

**Status:** approved by owner 2026-09-24 · **Plan:** `docs/superpowers/plans/2026-09-24-lunara-oci-migration.md`

## Why

- The GCP project `professional-portafolio` is suspended (both billing accounts closed). `api.lunara-app.com` has no DNS record, so Lunara's API, ingestion, stream processor, Lumen bot and Cloud SQL are all down. The Vercel frontend and the Grafana/Metabase admin iframes still work.
- GCP was too expensive for this workload. Ingestion polls ESPN every second, which on Cloud Run means an always-busy CPU. With `min-instances=1` on four services plus Cloud SQL, the estimate is $100–150/month.
- On GCP, live play-by-play **never worked**. Ingestion published to Pub/Sub and the Python stream processor republished, but no service consumed the output. The only writer of `plays` was a Kafka consumer that existed only in local dev. The live scoreboard worked only because the API polls ESPN itself.

## Evidence (measured 2026-09-24 on sport-suite-main: OCI A1.Flex, 4 OCPU / 24 GB, Ashburn)

**Box headroom**
- Baseline CPU averages 8.6%. The MLB pipeline peaks at about 39%.
- 17 GB RAM available, 18 GB disk free.

**ESPN `/summary` responses**
- 445 KB raw, 44 KB gzip. `httpx` sends `Accept-Encoding: gzip`.
- The CDN returns `cache-control: max-age` between 1 and 10 s for finished games. The value for live games is unknown.

**Sustained load test:** 90 s, 13 real games polled at 1 request/s each, with the `python-httpx` User-Agent.
- 1170 of 1170 requests returned 200.
- Latency: p50 102 ms, p99 220 ms.
- A full polling round took 0.16 s at the median and 0.89 s at worst.
- CPU used: 5.4% of the box.
- Bandwidth: about 6 GB per 3-hour game night.
- No throttling and no drift over the 90 s.

**ESPN rejects browser User-Agents.** It returns 403 for `Mozilla/…` and for a full Chrome UA string, from both the OCI box and the laptop. It accepts `python-httpx`, urllib and curl.

## Decisions

1. **One event path:** ESPN → ingestion → Postgres → API → WebSocket.
   - Ingestion writes `games` (upsert) and `plays` (insert, dedup on `game_id, sequence_number`) directly through an `EventSink`.
   - The API's existing 0.25 s `play_poller` broadcasts new plays.
   - Kafka, ZooKeeper, schema registry, Avro, Pub/Sub, both stream processors, and the API's Kafka consumer/producer/DLQ are **retired**. The owner approved this deletion on 2026-09-24; the code stays in git history.
   - Reactions are broadcast directly by the reactions router, using the same `{"type":"reaction","data":…}` message. Predictions no longer publish anywhere, since nothing ever consumed them.
2. **Fresh database** (owner-approved). Create a `lunara` database with role `lunara_app` on the existing Postgres 16 instance (`sportsuite_db`, 127.0.0.1:5500). Schema comes from `storage/postgres/migrations/*.sql`. Model picks re-sync from Sport-suite automatically. Previous users re-register.
3. **ESPN access:**
   - Direct requests are primary.
   - IPRoyal residential proxy is a per-request fallback on 403, 429 or transport error. After `proxy_trigger_failures` consecutive blocks, all traffic goes through the proxy for `proxy_cooldown_seconds`, then direct is retried.
   - Never set a browser User-Agent.
4. **Placement on sport-suite-main:**
   - OS user `lunara`; code in `/opt/lunara/{api,ingestion,lumen-bot}`, which is outside any Sport-suite `rsync --delete` target.
   - Environment files `/etc/lunara/*.env` (0640 root:lunara).
   - Redis in its own container on 127.0.0.1:6380.
   - API on 127.0.0.1:8010. Port 8000 belongs to the Sport-suite API.
   - nginx site `api.lunara-app.com` with WebSocket upgrade.
   - Cloudflare-proxied A record → 129.80.171.19.
   - The Lunara systemd units get `CPUWeight=400`, so live traffic beats the Airflow batch pipeline for CPU.
5. **API runs a single uvicorn worker.** With `--workers 2`, every poller runs twice and each process has its own WebSocket room map.
6. **Sport-suite integration is over localhost:** `SPORT_SUITE_API_URL=http://127.0.0.1:8000`, and `SPORT_SUITE_API_KEY` equals Sport-suite's `LUNARA_API_KEY`.
7. **Lumen** reads `LUNARA_API_URL` / `LUNARA_WS_URL` from the environment, overriding `config.yaml`. It runs as systemd `cephalon-lumen` on the same box against the local API.
8. **OLAP export** writes Parquet to a local directory (`OLAP_EXPORT_DIR`) instead of GCS.
9. **Quality bar:** 99.1% line+branch coverage per Python service (api, ingestion, lumen-bot), enforced in pre-commit and CI. Tests are written first.
10. **Go/no-go:** before the Oct 20 opener, rerun the sustained load test against a **live** preseason slate from the box. It must show 0 non-200 responses from direct requests (or proxy fallback engaging correctly), a round max under 1.0 s, and CPU under 15%.
