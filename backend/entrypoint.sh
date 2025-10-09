#!/bin/bash
# Lunara Backend Entrypoint Script
# Handles database migrations and initialization before starting the application

set -e

echo "🚀 Starting Lunara Backend..."

# Wait for database to be ready with SSL support
echo "⏳ Waiting for database connection..."

MAX_TRIES=30
COUNTER=0

# Build PostgreSQL connection string with SSL mode
export PGPASSWORD="$DB_PASSWORD"
DB_CONNECTION="host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME sslmode=require"

while [ $COUNTER -lt $MAX_TRIES ]; do
    # Test database connection with SSL mode
    if psql "$DB_CONNECTION" -c '\q' 2>/dev/null; then
        echo "✅ Database connection successful!"
        break
    fi

    COUNTER=$((COUNTER+1))
    if [ $COUNTER -lt $MAX_TRIES ]; then
        echo "⏳ Database not ready yet ($COUNTER/$MAX_TRIES): Retrying in 2 seconds..."
        sleep 2
    fi
done

if [ $COUNTER -eq $MAX_TRIES ]; then
    echo "❌ Database connection failed after $MAX_TRIES attempts"
    echo "   Check database credentials and SSL configuration"
    exit 1
fi

# Unset PGPASSWORD for security
unset PGPASSWORD

# Run database migrations
echo "📊 Running database migrations..."
python manage.py migrate --noinput || {
    echo "⚠️  Migration failed, but continuing..."
}

# Collect static files
echo "📦 Collecting static files..."
python manage.py collectstatic --noinput --clear || {
    echo "⚠️  Collectstatic failed, but continuing..."
}

echo "✅ Initialization complete!"
echo "🌐 Starting Gunicorn server..."

# Execute the main command (gunicorn)
exec "$@"
