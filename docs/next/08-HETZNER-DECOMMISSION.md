# Phase 8: Hetzner Decommission

**Trigger:** All services migrated to AWS (Sport-Suite) and GCP (Lunara). AWS has been stable for ≥ 3 days.
**Current hold:** March 9, 2026 (2-day monitoring window from March 7)
**Net cost impact:** ~$23/mo increase ($53/mo GCP vs ~$30/mo Hetzner share). The offset is managed infrastructure, auto-scaling, and no manual server ops.

---

## Services on Hetzner Today

| Service | User | Port | Status | Migrated To |
|---------|------|------|--------|-------------|
| Airflow (scheduler + webserver) | sportsuite | 8080 | ✅ Migrated to AWS | Decommission |
| PostgreSQL x6 (Docker Compose) | sportsuite | 5534-5539 | ✅ Migrated to AWS RDS | Decommission |
| Cephalon Axiom (NBA bot) | sportsuite | — | ✅ Migrated to AWS | Decommission |
| Lunara API (FastAPI) | palworld | 8000 | ⏳ GCP migration pending | Decommission after Phase 5 |
| Lunara ingestion (ESPN poller) | palworld | — | ⏳ GCP migration pending | Decommission after Phase 5 |
| Lunara DB (Docker PG) | palworld | 5432 | ⏳ GCP Cloud SQL pending | Decommission after Phase 5 |
| Lunara Redis | palworld | 6379 | ⏳ Memorystore pending | Decommission after Phase 5 |
| Cephalon Lumen (Palworld bot) | palworld | — | ⏳ GCP Cloud Run pending | Decommission after Phase 7 |
| Cephalon Solace (Trading bot) | trading | — | ⏳ Azure migration pending | Decommission after Azure |
| nginx | root | 80/443 | Reverse proxy | Decommission |
| play-by-play server files | palworld | — | Static serve | Decommission after GCP |

---

## Pre-Decommission Checklist

### AWS Stability (complete before anything)
- [ ] AWS Airflow has run successfully for ≥ 5 consecutive days without intervention
- [ ] No zombie task incidents on AWS
- [ ] Axiom bot responding correctly on AWS (not Hetzner)
- [ ] All 6 PostgreSQL DBs accessible on AWS RDS

### Data Export (do before shutdown)
- [ ] Final full backup of all 6 PostgreSQL databases on Hetzner
  ```bash
  ssh sportsuite@5.161.239.229 "cd /home/sportsuite/sport-suite && ./docker/scripts/backup.sh --all"
  ```
- [ ] Download backup archives locally
  ```bash
  rsync -avz sportsuite@5.161.239.229:/home/sportsuite/sport-suite/docker/backups/ ~/backups/hetzner-final/
  ```
- [ ] Verify backups are complete and readable
  ```bash
  gzip -t ~/backups/hetzner-final/*.sql.gz
  ```
- [ ] Export Lunara PostgreSQL (before GCP migration)
  ```bash
  ssh palworld@5.161.239.229 "pg_dump -h localhost -U lunara_user lunara_db | gzip > /tmp/lunara_final.sql.gz"
  rsync palworld@5.161.239.229:/tmp/lunara_final.sql.gz ~/backups/
  ```
- [ ] Archive Axiom conversation history DB (axiom.db)
  ```bash
  rsync sportsuite@5.161.239.229:/home/cephalons/axiom.db ~/backups/hetzner-final/
  ```

### Service Migration Verification
- [ ] `cephalon-axiom` on AWS is active: `ssh sportsuite@16.58.146.197 "systemctl is-active cephalon-axiom"`
- [ ] `cephalon-lumen` on GCP is active (Phase 5+)
- [ ] `cephalon-solace` migrated to Azure (Phase separate)
- [ ] Lunara API responding on GCP: `curl https://api.lunara-app.com/health`
- [ ] `lunara-app.com` DNS → Vercel (not Hetzner nginx)
- [ ] `api.lunara-app.com` DNS → GCP Cloud Run (not Hetzner nginx)

### DNS Cutover
- [ ] `lunara-app.com` removed from Hetzner nginx (or nginx stopped)
- [ ] `api.lunara-app.com` DNS updated (TTL ≤ 300 before cutover)
- [ ] Verify DNS propagation: `dig lunara-app.com` shows Vercel IPs
- [ ] No 502/503 errors on frontend or API post-cutover

### Cephalon Fleet Config
- [ ] Atlas fleet monitor updated with new service locations (GCP for Lumen, no Hetzner)
- [ ] Atlas no longer monitors `5.161.239.229`
- [ ] All Axiom systemd env vars use AWS URLs only

---

## Shutdown Order

When all services are migrated and DNS is updated:

```bash
ssh sportsuite@5.161.239.229

# 1. Stop Sport-Suite services
sudo systemctl stop airflow-scheduler airflow-webserver
sudo systemctl stop cephalon-axiom

# 2. Stop Lunara services (after GCP migration)
# (as palworld user)
sudo systemctl stop cephalon-lumen
cd /opt/play-by-play && docker-compose down

# 3. Stop trading services (after Azure migration)
sudo systemctl stop cephalon-solace

# 4. Stop Docker databases
cd /home/sportsuite/sport-suite/docker && docker-compose down

# 5. Final confirmation: no active connections
ss -tlnp | grep LISTEN

# 6. Update /etc/nginx/sites-enabled — remove all configs
sudo systemctl stop nginx
```

Then in Hetzner console: **Delete server**. Final monthly bill prorated.

---

## Post-Decommission

- Remove `5.161.239.229` from any firewall rules, `.env` files, or SSH configs
- Update `CLAUDE.md` production server entry: `AWS: 16.58.146.197` (remove Hetzner)
- Update `deploy.sh` default server variable
- Archive Hetzner SSH key (don't delete — keep for record)
- Close Hetzner account if no other servers

**Net cost impact: +$23/mo** ($53/mo GCP − ~$30/mo Hetzner share = net increase).
Trade-off is intentional: managed redundancy, auto-scaling, no manual server maintenance, GCP credit eligibility, and clean separation from Sport-Suite infra.
