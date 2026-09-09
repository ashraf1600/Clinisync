#!/bin/sh
set -e

echo "Starting CliniSync Backend..."

# Optionally run migrations if RUN_MIGRATIONS is set or by default in production
if [ "$RUN_MIGRATIONS" != "false" ]; then
    echo "Applying Alembic database migrations..."
    alembic upgrade head || {
        echo "Alembic migrations failed. Exiting."
        exit 1
    }
fi

echo "Starting Uvicorn ASGI server..."
exec "$@"
