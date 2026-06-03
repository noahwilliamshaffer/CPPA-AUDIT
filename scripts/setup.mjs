/**
 * setup.mjs — First-run setup for ShieldAudit offline mode.
 * Pushes the SQLite schema and seeds the question bank.
 * Safe to re-run (idempotent).
 *
 * Usage: node scripts/setup.mjs
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║       ShieldAudit — First-Run Setup      ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');

// 1. Push schema
console.log('[setup] Creating database schema...');
execSync('npx drizzle-kit push --force', { stdio: 'inherit', cwd: ROOT });
console.log('[setup] Schema ready.');
console.log('');

// 2. Seed questions
console.log('[setup] Seeding question bank...');
execSync('node docker/seed.mjs', { stdio: 'inherit', cwd: ROOT });
console.log('');

console.log('[setup] Setup complete. Run "npm start" to launch ShieldAudit.');
console.log('');
