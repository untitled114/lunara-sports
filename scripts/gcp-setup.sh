#!/usr/bin/env bash
# GCP Infrastructure Setup — Lunara Sports
# Run once to provision all cloud resources before deploying services.
#
# Prerequisites:
#   gcloud auth login
#   gcloud auth configure-docker
#
# Usage:
#   ./scripts/gcp-setup.sh              # full setup
#   ./scripts/gcp-setup.sh sql          # Cloud SQL only
#   ./scripts/gcp-setup.sh redis        # Memorystore only
#   ./scripts/gcp-setup.sh pubsub       # Pub/Sub topics only
#   ./scripts/gcp-setup.sh run          # Cloud Run deploy only

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT:-lunara-sports}"
REGION="${GCP_REGION:-us-central1}"
IMAGE_REGISTRY="gcr.io/${PROJECT_ID}"

# Cloud SQL
SQL_INSTANCE="lunara-postgres"
SQL_DB="lunara_db"
SQL_USER="lunara_user"

# Memorystore
REDIS_INSTANCE="lunara-cache"

# Cloud Run services
API_SERVICE="lunara-api"
INGESTION_SERVICE="lunara-ingestion"
PROCESSOR_SERVICE="lunara-stream-processor"
LUMEN_SERVICE="cephalon-lumen"

# ─── Helpers ──────────────────────────────────────────────────────────────────
step() { echo; echo "▶ $*"; }
ok()   { echo "  ✓ $*"; }

require_project() {
    gcloud config set project "${PROJECT_ID}"
    gcloud services enable \
        run.googleapis.com \
        sqladmin.googleapis.com \
        redis.googleapis.com \
        pubsub.googleapis.com \
        secretmanager.googleapis.com \
        vpcaccess.googleapis.com \
        containerregistry.googleapis.com \
        --quiet
    ok "APIs enabled for ${PROJECT_ID}"
}

# ─── Cloud SQL ────────────────────────────────────────────────────────────────
setup_sql() {
    step "Cloud SQL — PostgreSQL 16"

    if gcloud sql instances describe "${SQL_INSTANCE}" --quiet 2>/dev/null; then
        ok "Instance ${SQL_INSTANCE} already exists"
    else
        gcloud sql instances create "${SQL_INSTANCE}" \
            --database-version=POSTGRES_16 \
            --tier=db-g1-small \
            --region="${REGION}" \
            --storage-type=SSD \
            --storage-size=10GB \
            --storage-auto-increase \
            --backup \
            --backup-start-time=05:00 \
            --quiet
        ok "Created ${SQL_INSTANCE}"
    fi

    gcloud sql databases create "${SQL_DB}" \
        --instance="${SQL_INSTANCE}" --quiet 2>/dev/null || ok "DB ${SQL_DB} already exists"

    gcloud sql users create "${SQL_USER}" \
        --instance="${SQL_INSTANCE}" \
        --password="${SQL_PASSWORD:?SQL_PASSWORD env var required}" \
        --quiet 2>/dev/null || ok "User ${SQL_USER} already exists"

    ok "Cloud SQL ready — connect via: /cloudsql/${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
}

import_sql() {
    step "Import Lunara DB from backup"
    # Export from Hetzner first:
    #   ssh palworld@5.161.239.229 "pg_dump -h localhost -U lunara_user lunara_db | gzip > /tmp/lunara_final.sql.gz"
    #   rsync palworld@5.161.239.229:/tmp/lunara_final.sql.gz ./lunara_final.sql.gz
    BACKUP="${1:-lunara_final.sql.gz}"
    if [[ ! -f "${BACKUP}" ]]; then
        echo "  ⚠ No backup file at ${BACKUP} — skipping import"
        echo "    Export from Hetzner and re-run: ./scripts/gcp-setup.sh import"
        return
    fi
    gsutil cp "${BACKUP}" "gs://${PROJECT_ID}-sql-imports/"
    gcloud sql import sql "${SQL_INSTANCE}" \
        "gs://${PROJECT_ID}-sql-imports/$(basename ${BACKUP})" \
        --database="${SQL_DB}" --quiet
    ok "DB imported"
}

# ─── Memorystore (Redis) ──────────────────────────────────────────────────────
setup_redis() {
    step "Memorystore — Redis 7"

    if gcloud redis instances describe "${REDIS_INSTANCE}" --region="${REGION}" --quiet 2>/dev/null; then
        ok "Redis instance ${REDIS_INSTANCE} already exists"
    else
        gcloud redis instances create "${REDIS_INSTANCE}" \
            --size=1 \
            --region="${REGION}" \
            --redis-version=redis_7_0 \
            --quiet
        ok "Created ${REDIS_INSTANCE}"
    fi

    REDIS_IP=$(gcloud redis instances describe "${REDIS_INSTANCE}" \
        --region="${REGION}" --format="value(host)")
    ok "Redis host: ${REDIS_IP}:6379 (VPC only — accessible from Cloud Run via connector)"
}

# ─── VPC Connector (Cloud Run ↔ Memorystore) ─────────────────────────────────
setup_vpc_connector() {
    step "VPC Connector (for Cloud Run → Memorystore)"

    if gcloud compute networks vpc-access connectors describe lunara-connector \
        --region="${REGION}" --quiet 2>/dev/null; then
        ok "VPC connector already exists"
    else
        gcloud compute networks vpc-access connectors create lunara-connector \
            --network=default \
            --region="${REGION}" \
            --range=10.8.0.0/28 \
            --quiet
        ok "Created VPC connector"
    fi
}

# ─── Pub/Sub Topics ───────────────────────────────────────────────────────────
setup_pubsub() {
    step "Pub/Sub Topics"

    TOPICS=(
        "raw-plays"
        "raw-scoreboard"
        "enriched-plays"
        "game-state"
        "raw-plays-dlq"
        "enriched-plays-dlq"
    )

    for topic in "${TOPICS[@]}"; do
        gcloud pubsub topics create "${topic}" --quiet 2>/dev/null && ok "Created topic: ${topic}" \
            || ok "Topic already exists: ${topic}"
    done

    # Subscriptions for stream processor
    gcloud pubsub subscriptions create raw-plays-sub \
        --topic=raw-plays \
        --ack-deadline=60 \
        --dead-letter-topic=raw-plays-dlq \
        --max-delivery-attempts=5 \
        --quiet 2>/dev/null || ok "Subscription raw-plays-sub already exists"

    gcloud pubsub subscriptions create raw-scoreboard-sub \
        --topic=raw-scoreboard \
        --ack-deadline=60 \
        --quiet 2>/dev/null || ok "Subscription raw-scoreboard-sub already exists"

    # Subscription for API consumer
    gcloud pubsub subscriptions create enriched-plays-api-sub \
        --topic=enriched-plays \
        --ack-deadline=30 \
        --quiet 2>/dev/null || ok "Subscription enriched-plays-api-sub already exists"

    ok "Pub/Sub ready"
}

# ─── Secret Manager ───────────────────────────────────────────────────────────
setup_secrets() {
    step "Secret Manager — store env vars"

    secrets=(
        "lunara-db-url"
        "lunara-redis-url"
        "lunara-jwt-secret"
        "lunara-sport-suite-api-key"
    )

    for secret in "${secrets[@]}"; do
        gcloud secrets create "${secret}" --quiet 2>/dev/null || ok "Secret ${secret} already exists"
    done

    echo "  ⚠ Set secret values manually:"
    echo "    echo -n 'VALUE' | gcloud secrets versions add lunara-db-url --data-file=-"
    echo "    echo -n 'VALUE' | gcloud secrets versions add lunara-redis-url --data-file=-"
    echo "    echo -n 'VALUE' | gcloud secrets versions add lunara-jwt-secret --data-file=-"
    echo "    echo -n 'VALUE' | gcloud secrets versions add lunara-sport-suite-api-key --data-file=-"
}

# ─── Build & Push Docker Images ───────────────────────────────────────────────
build_images() {
    step "Build and push Docker images"

    SERVICES=("api" "ingestion" "stream-processor-pubsub")

    for svc in "${SERVICES[@]}"; do
        if [[ ! -d "${svc}" ]]; then
            echo "  ⚠ Directory ${svc}/ not found — skipping"
            continue
        fi
        IMAGE="${IMAGE_REGISTRY}/${svc}:latest"
        docker build -t "${IMAGE}" "${svc}/"
        docker push "${IMAGE}"
        ok "Pushed ${IMAGE}"
    done
}

# ─── Cloud Run Deploy ─────────────────────────────────────────────────────────
deploy_run() {
    step "Deploy to Cloud Run"

    REDIS_IP=$(gcloud redis instances describe "${REDIS_INSTANCE}" \
        --region="${REGION}" --format="value(host)" 2>/dev/null || echo "REDIS_IP_HERE")

    SQL_CONN="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
    DB_URL="postgresql+asyncpg://${SQL_USER}:\${DB_PASS}@/${SQL_DB}?host=/cloudsql/${SQL_CONN}"

    # API
    gcloud run deploy "${API_SERVICE}" \
        --image="${IMAGE_REGISTRY}/api:latest" \
        --platform=managed \
        --region="${REGION}" \
        --port=8000 \
        --memory=512Mi \
        --cpu=1 \
        --min-instances=1 \
        --max-instances=10 \
        --allow-unauthenticated \
        --add-cloudsql-instances="${SQL_CONN}" \
        --vpc-connector=lunara-connector \
        --set-secrets="DATABASE_URL=lunara-db-url:latest,JWT_SECRET=lunara-jwt-secret:latest,SPORT_SUITE_API_KEY=lunara-sport-suite-api-key:latest" \
        --set-env-vars="REDIS_URL=redis://${REDIS_IP}:6379/0,SPORT_SUITE_API_URL=http://16.58.146.197:8000,GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
        --quiet
    ok "Deployed ${API_SERVICE}"

    # Ingestion
    gcloud run deploy "${INGESTION_SERVICE}" \
        --image="${IMAGE_REGISTRY}/ingestion:latest" \
        --platform=managed \
        --region="${REGION}" \
        --memory=256Mi \
        --cpu=1 \
        --min-instances=1 \
        --max-instances=1 \
        --no-allow-unauthenticated \
        --set-env-vars="PUBSUB_PROJECT=${PROJECT_ID},PUBSUB_TOPIC_PLAYS=raw-plays,PUBSUB_TOPIC_SCOREBOARD=raw-scoreboard" \
        --quiet
    ok "Deployed ${INGESTION_SERVICE}"

    # Stream processor
    gcloud run deploy "${PROCESSOR_SERVICE}" \
        --image="${IMAGE_REGISTRY}/stream-processor-pubsub:latest" \
        --platform=managed \
        --region="${REGION}" \
        --memory=256Mi \
        --cpu=1 \
        --min-instances=1 \
        --max-instances=1 \
        --no-allow-unauthenticated \
        --vpc-connector=lunara-connector \
        --add-cloudsql-instances="${SQL_CONN}" \
        --set-secrets="DATABASE_URL=lunara-db-url:latest" \
        --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},PUBSUB_SUB_PLAYS=raw-plays-sub,PUBSUB_SUB_SCOREBOARD=raw-scoreboard-sub,PUBSUB_TOPIC_ENRICHED=enriched-plays,PUBSUB_TOPIC_STATE=game-state" \
        --quiet
    ok "Deployed ${PROCESSOR_SERVICE}"

    API_URL=$(gcloud run services describe "${API_SERVICE}" \
        --region="${REGION}" --format="value(status.url)")
    ok "API live at: ${API_URL}"
}

# ─── DNS Instructions ─────────────────────────────────────────────────────────
print_dns_steps() {
    step "DNS Cutover (manual — do after 48h monitoring)"
    API_URL=$(gcloud run services describe "${API_SERVICE}" \
        --region="${REGION}" --format="value(status.url)" 2>/dev/null || echo "<cloud-run-url>")
    echo "  1. api.lunara-app.com → CNAME → ${API_URL#https://}"
    echo "     (or update A record via Cloudflare/registrar)"
    echo "  2. lunara-app.com → already on Vercel"
    echo "  3. Update Vercel env: VITE_API_URL=https://api.lunara-app.com"
    echo "  4. Test WebSocket: wscat -c wss://api.lunara-app.com/ws/test"
    echo "  5. After 48h stable → run: ./scripts/gcp-setup.sh stop-hetzner"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
CMD="${1:-all}"

case "${CMD}" in
    all)
        require_project
        setup_sql
        setup_redis
        setup_vpc_connector
        setup_pubsub
        setup_secrets
        echo
        echo "✅ Infrastructure ready. Next steps:"
        echo "   1. Set secret values (see above)"
        echo "   2. Export Lunara DB from Hetzner and run: ./scripts/gcp-setup.sh import"
        echo "   3. Build images: ./scripts/gcp-setup.sh build"
        echo "   4. Deploy: ./scripts/gcp-setup.sh run"
        ;;
    sql)    require_project; setup_sql ;;
    import) require_project; import_sql "${2:-lunara_final.sql.gz}" ;;
    redis)  require_project; setup_redis; setup_vpc_connector ;;
    pubsub) require_project; setup_pubsub ;;
    secrets) require_project; setup_secrets ;;
    build)  build_images ;;
    run)    deploy_run; print_dns_steps ;;
    dns)    print_dns_steps ;;
    *)
        echo "Usage: $0 [all|sql|import|redis|pubsub|secrets|build|run|dns]"
        exit 1
        ;;
esac
