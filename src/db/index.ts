/**
 * Database connection using Neon serverless PostgreSQL + Drizzle ORM.
 *
 * Multi-tenant isolation: every query touching org data MUST include
 * WHERE org_id = $orgId. See individual query files for enforcement.
 *
 * Retention: §7123 requires minimum 5-year retention for audit data.
 * Ensure your Neon/Railway plan and backup policy supports this.
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
