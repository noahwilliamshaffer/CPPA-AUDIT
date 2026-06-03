/**
 * Database connection — better-sqlite3 (offline, no server required).
 *
 * The database is a single file: shieldaudit.db in the project root.
 * Set DATABASE_PATH env var to use a custom location.
 *
 * WAL mode is enabled for safe concurrent reads during report generation.
 * Foreign keys are enforced at the SQLite level.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DB_PATH =
  process.env.DATABASE_PATH ??
  path.join(process.cwd(), 'shieldaudit.db');

// Singleton — one connection shared across all server-side requests.
declare global {
  // eslint-disable-next-line no-var
  var __sqliteDb: Database.Database | undefined;
}

const sqlite =
  global.__sqliteDb ??
  (global.__sqliteDb = new Database(DB_PATH));

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
