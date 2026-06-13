#!/usr/bin/env sh
# =============================================================================
# ShieldAudit — Docker entrypoint (offline SQLite)
#
# Runs before the Next.js server starts. Idempotent — safe on every restart.
#   1. Ensure the SQLite data directory exists (mounted volume)
#   2. Push the Drizzle schema (creates/updates tables)
#   3. Seed the §7123(c) question bank if empty
#   4. Start Next.js
# =============================================================================
set -e

DB_PATH="${DATABASE_PATH:-/data/shieldaudit.db}"
DB_DIR="$(dirname "$DB_PATH")"

echo ""
echo "==================================================="
echo "  ShieldAudit — starting up"
echo "  DB: $DB_PATH"
echo "==================================================="
echo ""

mkdir -p "$DB_DIR"

echo "[startup] Applying database schema..."
node_modules/.bin/drizzle-kit push --force
echo "[startup] Schema ready."
echo ""

echo "[startup] Seeding question bank (idempotent)..."
node docker/seed.mjs
echo ""

echo "[startup] Launching ShieldAudit on http://localhost:3000"
echo ""
exec "$@"
