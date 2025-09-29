#!/bin/bash

# Entrypoint script for Lunara Django Backend
set -e

echo "🚀 Starting Lunara Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
python -c "
import os
import psycopg2
import time
import sys

max_tries = 30
tries = 0

while tries < max_tries:
    try:
        conn = psycopg2.connect(
            host=os.environ.get('DB_HOST'),
            port=os.environ.get('DB_PORT', '5432'),
            user=os.environ.get('DB_USER'),
            password=os.environ.get('DB_PASSWORD'),
            database=os.environ.get('DB_NAME')
        )
        conn.close()
        print('✅ Database is ready!')
        sys.exit(0)
    except Exception as e:
        tries += 1
        print(f'⏳ Database not ready yet ({tries}/{max_tries}): {e}')
        time.sleep(2)

print('❌ Database connection failed after 30 attempts')
sys.exit(1)
"

# Run database migrations
echo "🔄 Running migrations..."
python manage.py migrate --noinput

# Collect static files
echo "📁 Collecting static files..."
python manage.py collectstatic --noinput

# Create superuser if needed (for development)
echo "👤 Creating superuser if needed..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@lunara-app.com', 'admin123')
    print('✅ Superuser created: admin/admin123')
else:
    print('ℹ️ Superuser already exists')
" || echo "ℹ️ Superuser creation skipped"

echo "✅ Backend initialization complete!"

# Execute the main command
exec "$@"