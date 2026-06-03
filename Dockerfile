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

# NEXT_PUBLIC_* vars are inlined at build time by Next.js — they must be real.
# Passed in as build args from docker-compose (see build.args in docker-compose.yml).
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV CLERK_SECRET_KEY=sk_test_placeholder
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL

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

# ── pdfkit font path guard ─────────────────────────────────────────────────
# serverExternalPackages in next.config.mjs prevents Turbopack from bundling
# pdfkit (which would rewrite __dirname to /ROOT). This symlink is a fallback
# guard in case that config is ever removed or overridden.
RUN ln -sfn /app /ROOT

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start"]
