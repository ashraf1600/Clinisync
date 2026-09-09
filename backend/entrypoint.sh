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

PORT="${PORT:-8000}"
echo "Starting Uvicorn ASGI server on port ${PORT}..."

if [ "$#" -eq 0 ] || [ "$1" = "uvicorn" ]; then
    exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 2
else
    exec "$@"
fi
