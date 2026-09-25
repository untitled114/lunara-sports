COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

.PHONY: infra up down logs db-migrate db-reset \
       dev-ingestion dev-api dev-frontend test lint build deploy \
       test-infra test-infra-down test-integration

# --- Infrastructure ---

infra: ## Start infrastructure only (pg, redis, monitoring)
	$(COMPOSE) up -d postgres redis postgres-exporter redis-exporter prometheus grafana

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

test-infra: ## Start test infrastructure (postgres, redis)
	$(COMPOSE) up -d postgres redis
	@echo "Test infrastructure ready."

test-infra-down: ## Tear down test infrastructure
	$(COMPOSE) down -v

test-integration: test-infra ## Run integration tests (starts infra, runs tests, tears down)
	@echo "Running integration tests..."
	cd tests && python3 -m pytest integration/ -v --timeout=60 || ($(MAKE) test-infra-down && exit 1)
	@$(MAKE) test-infra-down

lint: ## Run linters
	cd ingestion && ruff check src/ tests/
	cd api && ruff check src/ tests/

# --- Build ---

build: ## Build all Docker images
	$(COMPOSE) build

# --- Deployment ---

deploy: ## Deploy to production server
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
