# Monitoring

## Prometheus

Scrapes metrics from all services. Config in `prometheus/prometheus.yml`.

Access at: http://localhost:9090

## Grafana

Dashboards auto-provisioned from `grafana/provisioning/dashboards/`.

Access at: http://localhost:3001 (admin/admin)

### Starter Dashboard

`overview.json` includes panels for:
- API request rate and latency (p95)
- Active WebSocket connections
- Kafka consumer lag
- PostgreSQL active connections
- Redis memory usage
- Ingestion poll rate

## Adding Exporters

For production, add these sidecar exporters:
- **kafka-exporter** — JMX metrics from Kafka brokers
- **postgres-exporter** — PostgreSQL stats
- **redis-exporter** — Redis info metrics
