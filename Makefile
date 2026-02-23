COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

.PHONY: infra up down logs db-migrate db-reset topics topics-list \
       dev-ingestion dev-api dev-frontend test lint build deploy

# --- Infrastructure ---

infra: ## Start infrastructure only (kafka, pg, redis, minio, monitoring)
	$(COMPOSE) up -d zookeeper kafka schema-registry kafka-init \
		postgres redis minio prometheus grafana

up: ## Start all services
	$(COMPOSE) up -d

down: ## Stop everything
	$(COMPOSE) down

logs: ## Tail all service logs
	$(COMPOSE) logs -f --tail=100

# --- Database ---

db-migrate: ## Run SQL migrations against postgres
	@for f in storage/postgres/migrations/*.sql; do \
		echo "Running $$f..."; \
		PGPASSWORD=$${POSTGRES_PASSWORD:-dev_password} psql \
			-h localhost -p 5432 \
			-U $${POSTGRES_USER:-playbyplay} \
			-d $${POSTGRES_DB:-playbyplay} \
			-f "$$f"; \
	done
	@echo "Migrations complete."

db-reset: ## Drop and recreate database
	PGPASSWORD=$${POSTGRES_PASSWORD:-dev_password} psql \
		-h localhost -p 5432 \
		-U $${POSTGRES_USER:-playbyplay} \
		-d postgres \
		-c "DROP DATABASE IF EXISTS $${POSTGRES_DB:-playbyplay};" \
		-c "CREATE DATABASE $${POSTGRES_DB:-playbyplay};"
	@$(MAKE) db-migrate

# --- Kafka ---

topics: ## Create Kafka topics
	$(COMPOSE) exec kafka bash /create-topics.sh || \
		$(COMPOSE) run --rm kafka-init

topics-list: ## List existing topics
	$(COMPOSE) exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# --- Local Development ---

dev-ingestion: ## Run ingestion locally (outside Docker)
	cd ingestion && python3 -m src

dev-api: ## Run FastAPI with uvicorn reload
	cd api && uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Run frontend dev server
	cd frontend && npm run dev

# --- Testing ---

test: ## Run all tests
	cd ingestion && pytest tests/ -v
	cd api && pytest tests/ -v
	cd frontend && npm test
	cd stream-processor && ./gradlew test

lint: ## Run linters
	cd ingestion && ruff check src/ tests/
	cd api && ruff check src/ tests/
	cd frontend && npm run lint
	cd stream-processor && ./gradlew checkstyleMain

# --- Build ---

build: ## Build all Docker images
	$(COMPOSE) build

# --- Deployment ---

deploy: ## Deploy to Hetzner server
	@echo "Deploying to production server..."
	rsync -avz --exclude='.git' --exclude='node_modules' --exclude='__pycache__' \
		--exclude='.gradle' --exclude='build' --exclude='.next' \
		. $${DEPLOY_HOST}:$${DEPLOY_PATH:-/opt/play-by-play}/
	ssh $${DEPLOY_HOST} "cd $${DEPLOY_PATH:-/opt/play-by-play} && docker-compose up -d --build"

deploy-logs: ## Tail production logs
	ssh $${DEPLOY_HOST} "cd $${DEPLOY_PATH:-/opt/play-by-play} && docker-compose logs -f --tail=100"

# --- Help ---

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
