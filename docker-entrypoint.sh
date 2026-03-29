#!/bin/sh
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Gelani Healthcare Assistant - Starting...              ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Wait for database to be ready (if using external DB)
if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "postgresql"; then
    echo "⏳ Waiting for PostgreSQL..."
    sleep 5
fi

# Run Prisma migrations if needed
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "🔄 Running database migrations..."
    npx prisma migrate deploy || npx prisma db push --skip-generate
fi

# Seed database if empty
if [ "$SEED_DATABASE" = "true" ]; then
    echo "🌱 Seeding database..."
    npx prisma db seed || true
fi

echo "✅ Gelani ready on port 3000"
exec "$@"
