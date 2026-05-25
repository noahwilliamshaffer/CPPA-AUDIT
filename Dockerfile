# =============================================================================
# ShieldAudit — Multi-stage Dockerfile
#
# Stage 1 (deps):    Install all npm dependencies.
# Stage 2 (builder): Build the Next.js app.
# Stage 3 (runner):  Minimal production image.
#
# The runner includes:
#   - The compiled Next.js app (.next/)
#   - node_modules (includes drizzle-kit for schema push on startup)
#   - src/db/schema.ts + drizzle.config.ts (needed by drizzle-kit push)
#   - docker/seed.mjs (question bank seeder — runs once on first boot)
#   - docker-entrypoint.sh (waits for DB, pushes schema, seeds, starts app)
# =============================================================================

# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Dummy build-time env — Next.js validates these at build time.
# Real values are injected at runtime via docker-compose env_file / environment.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
ENV CLERK_SECRET_KEY=sk_test_placeholder

RUN npm run build

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# ── App files ──────────────────────────────────────────────────────────────
COPY --from=builder /app/public       ./public
COPY --from=builder /app/.next        ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# ── Schema files for drizzle-kit push (runs in entrypoint on every boot) ──
# drizzle-kit reads these TypeScript files to create/update tables.
RUN mkdir -p src/db
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/db/schema.ts  ./src/db/schema.ts

# ── Startup scripts ────────────────────────────────────────────────────────
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p docker
COPY --from=builder /app/docker/seed.mjs      ./docker/seed.mjs

RUN chmod +x /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start"]
