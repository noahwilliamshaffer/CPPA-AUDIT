/**
 * Database connection — postgres.js driver (pure JavaScript, no native modules).
 *
 * Works with:
 *   - Local PostgreSQL in Docker  (docker-compose.yml client deployment)
 *   - Neon cloud                  (standard PostgreSQL wire protocol + SSL)
 *   - Any other standard PostgreSQL instance
 *
 * Why postgres.js instead of @neondatabase/serverless:
 *   The Neon HTTP driver only works with the Neon cloud service and cannot
 *   connect to a local PostgreSQL container (used for client deployments).
 *   postgres.js is pure JavaScript (no native modules) so it never triggers
 *   the Windows Node.js 20 OpenSSL assertion crash.
 *
 * Connection pooling:
 *   A singleton pool is shared across all server-side requests. The pool is
 *   bounded to 5 connections — safe for both Neon's free tier and local dev.
 *   Increase max via the PG_MAX_CONNECTIONS env var if needed.
 *
 * Multi-tenant isolation: every query touching org data MUST include
 * WHERE org_id = $orgId. See individual query files for enforcement.
 *
 * Retention: §7123 requires minimum 5-year retention for audit data.
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is required. ' +
      'Copy .env.example to .env.local and fill in your PostgreSQL connection string.'
  );
}

// ---------------------------------------------------------------------------
// Singleton connection pool
// ---------------------------------------------------------------------------
// Using a module-level singleton prevents creating a new pool on every hot
// reload in development and on every server component invocation.
// In Docker / Node.js server mode this is always safe.
// In Vercel edge functions, TCP is not available — switch to Neon HTTP adapter.

declare global {
  // eslint-disable-next-line no-var
  var __postgresClient: ReturnType<typeof postgres> | undefined;
}

const client =
  global.__postgresClient ??
  (global.__postgresClient = postgres(process.env.DATABASE_URL, {
    // Connection pool size — 5 is safe for Neon free tier (max 5 connections).
    // For self-hosted PostgreSQL in Docker, increase as needed.
    max: Number(process.env.PG_MAX_CONNECTIONS ?? 5),
    // Close idle connections after 20 s to avoid hitting Neon's connection limit.
    idle_timeout: 20,
    // Fail fast if the DB is unreachable — surface errors early.
    connect_timeout: 10,
    // ssl is parsed automatically from sslmode=require in the DATABASE_URL.
    // For local Docker PostgreSQL (no SSL), omit sslmode from the URL.
  }));

export const db = drizzle(client, { schema });
export type DB = typeof db;
