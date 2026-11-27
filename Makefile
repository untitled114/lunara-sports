COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

# Local settings (copy .env.example to .env); the defaults match docker-compose.yml.
-include .env
POSTGRES_USER ?= playbyplay
POSTGRES_PASSWORD ?= dev_password
POSTGRES_DB ?= playbyplay
export POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB JWT_SECRET
PG_URL := postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:5432/$(POSTGRES_DB)
IT_DSN := postgresql://postgres:postgres@localhost:55433/lunara_it

.PHONY: infra up down logs db-migrate db-reset envs dev-ingestion dev-api dev-web test test-db lint build help

# --- Infrastructure ---

infra: ## Start PostgreSQL, Redis and monitoring; returns once PostgreSQL accepts connections
	$(COMPOSE) up -d postgres redis postgres-exporter redis-exporter prometheus grafana
	@until $(COMPOSE) exec -T postgres pg_isready -h 127.0.0.1 -U $(POSTGRES_USER) >/dev/null 2>&1; do sleep 1; done

up: ## Start everything, the two services included
	$(COMPOSE) up -d --build

down: ## Stop everything
	$(COMPOSE) down

logs: ## Tail all service logs
	$(COMPOSE) logs -f --tail=100

# --- Database ---

db-migrate: ## Apply storage/postgres/migrations in order (needs psql)
	@for f in storage/postgres/migrations/*.sql; do \
		echo "Running $$f..."; \
		psql -v ON_ERROR_STOP=1 "$(PG_URL)" -q -f "$$f" || exit 1; \
	done
	@echo "Migrations complete."

db-reset: ## Drop and recreate the database, then migrate
	psql "postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:5432/postgres" \
		-c "DROP DATABASE IF EXISTS $(POSTGRES_DB);" -c "CREATE DATABASE $(POSTGRES_DB);"
	@$(MAKE) db-migrate

# --- Local development (after `make infra db-migrate`) ---

envs: ## Build the two services' Python 3.12 environments in .ci/ (reused while unchanged)
	scripts/check.sh --stage envs

dev-ingestion: envs ## Poll ESPN and write to the local database
	cd ingestion && DATABASE_URL="$(PG_URL)" ../.ci/ingestion/bin/python -m src

dev-api: envs ## The API on 127.0.0.1:8000 (docs at /docs)
	cd api && DATABASE_URL="$(subst postgresql://,postgresql+asyncpg://,$(PG_URL))" \
		REDIS_URL=redis://localhost:6379/0 \
		../.ci/api/bin/uvicorn src.main:app --reload --host 127.0.0.1 --port 8000

dev-web: ## The website on 127.0.0.1:3000, against the local API (needs Node 22)
	cd frontend && npm ci --no-audit --no-fund && npm run dev

# --- Tests ---

test: ## Lint and every suite that needs no database (each service in its own venv), and the website
	scripts/check.sh --stage lint
	scripts/check.sh --stage api
	scripts/check.sh --stage ingestion
	scripts/check.sh --stage frontend

test-db: ## Everything, plus the real-PostgreSQL tests, on a throwaway postgres:16 container
	@docker rm -f lunara-it-pg >/dev/null 2>&1 || true
	docker run -d --rm --name lunara-it-pg -p 55433:5432 \
		-e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lunara_it postgres:16
	@trap 'docker stop lunara-it-pg >/dev/null 2>&1' EXIT; \
	until docker exec lunara-it-pg pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do sleep 1; done; \
	TEST_DATABASE_URL=$(IT_DSN) scripts/check.sh --stage all

lint: ## Linters and format checks
	scripts/check.sh --stage lint

# --- Build ---

build: ## Build the Docker images
	$(COMPOSE) build

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
