#!/bin/sh
# =============================================================================
# ShieldAudit — Docker entrypoint
#
# Runs automatically before the Next.js server starts.
# Handles schema migration and question bank seeding on first boot.
# Safe to re-run on every container restart (all steps are idempotent).
#
# Steps:
#   1. Wait for PostgreSQL to accept connections
#   2. Push the Drizzle schema (creates / updates tables, idempotent)
#   3. Seed the question bank if empty
#   4. Hand off to the main process (Next.js)
# =============================================================================
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         ShieldAudit — Starting up        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Wait for PostgreSQL ───────────────────────────────────────────────────
echo "[startup] Waiting for PostgreSQL..."
MAX_RETRIES=60
RETRY=0

until node -e "
  const p = require('postgres');
  const s = p(process.env.DATABASE_URL, { max: 1, connect_timeout: 3 });
  s\`SELECT 1\`.then(() => { s.end(); process.exit(0); }).catch(() => { s.end(); process.exit(1); });
" 2>/dev/null; do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    echo "[startup] ERROR: PostgreSQL not ready after ${MAX_RETRIES} attempts. Check DATABASE_URL."
    exit 1
  fi
  echo "[startup]   Attempt ${RETRY}/${MAX_RETRIES} — retrying in 2s..."
  sleep 2
done

echo "[startup] PostgreSQL is ready."
echo ""

# ── 2. Push schema ───────────────────────────────────────────────────────────
# drizzle-kit push creates/updates all 14 tables idempotently.
# --force skips the interactive confirmation prompt.
echo "[startup] Applying database schema..."
node_modules/.bin/drizzle-kit push --force 2>&1 | grep -v "^$" | sed 's/^/[drizzle] /' || true
echo "[startup] Schema ready."
echo ""

# ── 3. Seed questions ────────────────────────────────────────────────────────
# Inserts 40 audit questions only if the questions table is empty.
echo "[startup] Checking question bank..."
node /app/docker/seed.mjs
echo ""

# ── 4. Start Next.js ─────────────────────────────────────────────────────────
echo "[startup] Starting ShieldAudit..."
echo ""
exec "$@"
