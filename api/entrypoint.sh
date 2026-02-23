#!/bin/bash
set -e

echo "=== Play-by-Play API entrypoint ==="

# Wait for database to be ready (up to 60s)
if [ -n "$DATABASE_URL" ]; then
    echo "Waiting for database..."
    COUNTER=0
    until python -c "
import asyncio, asyncpg, os, urllib.parse
url = os.environ['DATABASE_URL'].replace('postgresql+asyncpg://', 'postgresql://')
asyncio.run(asyncpg.connect(url))
" 2>/dev/null; do
        COUNTER=$((COUNTER + 1))
        if [ $COUNTER -ge 30 ]; then
            echo "ERROR: Database not ready after 60s"
            exit 1
        fi
        sleep 2
    done
    echo "Database ready."
fi

# Run SQL migrations if present
if [ -d "/app/migrations" ]; then
    echo "Running migrations..."
    for f in /app/migrations/*.sql; do
        echo "  -> $(basename "$f")"
        # Extract connection parts from DATABASE_URL for psql
        python -c "
import os, subprocess, urllib.parse
url = os.environ['DATABASE_URL'].replace('postgresql+asyncpg://', 'postgresql://')
subprocess.run(['psql', url, '-f', '$f'], check=True)
" 2>/dev/null || echo "  (migration may already be applied)"
    done
    echo "Migrations complete."
fi

exec "$@"
