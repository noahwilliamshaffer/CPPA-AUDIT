/**
 * Database connection — dual driver.
 *
 * Neon cloud  (DATABASE_URL contains "neon.tech"):
 *   Uses @neondatabase/serverless HTTP driver — optimal for serverless/edge.
 *
 * Local PostgreSQL (Docker, dev):
 *   Uses node-postgres (pg) Pool — persistent connections, no SSL required.
 *
 * Multi-tenant isolation: every query touching org data MUST include
 * WHERE org_id = $orgId. See individual query files for enforcement.
 *
 * Retention: §7123 requires minimum 5-year retention for audit data.
 */

/**
 * Database connection — Neon serverless HTTP driver.
 *
 * Works with:
 *   - Neon cloud  (default, used in production and when running locally)
 *   - Neon local  (neon.tech/docs/guides/local-development)
 *
 * For fully-offline Docker with a bundled PostgreSQL container, the driver
 * must be switched to drizzle-orm/node-postgres. That build must run on
 * Linux (Docker/CI) to avoid the Node 20 Windows OpenSSL native crash.
 *
 * Multi-tenant isolation: every query touching org data MUST include
 * WHERE org_id = $orgId.
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
export type DB = typeof db;
