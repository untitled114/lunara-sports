# Monitoring

## Prometheus

Scrapes the API's `/metrics` and the PostgreSQL and Redis exporters (all in
`docker-compose.yml`). Config in `prometheus/prometheus.yml`.

Access at: http://localhost:9090

## Grafana

The datasource and the dashboard are provisioned from `grafana/provisioning/`.

Access at: http://localhost:3001 (user `admin`, password from `GRAFANA_ADMIN_PASSWORD`).

### Starter dashboard

`overview.json` has panels for:
- API request rate and latency (p95)
- Active WebSocket connections
- Poll cycles of the API's background pollers
- PostgreSQL active connections and database size
