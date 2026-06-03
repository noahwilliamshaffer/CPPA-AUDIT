/**
 * provision-demo.mjs — Creates the default local org in the SQLite DB.
 * Run once after npm run setup if you want to skip the onboarding wizard.
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH ?? path.join(__dirname, '..', 'shieldaudit.db');
const db = new Database(DB_PATH);

const existing = db.prepare("SELECT COUNT(*) as n FROM user_roles WHERE clerk_user_id = 'local-user'").get();
if (existing.n > 0) {
  console.log('[provision] Already provisioned — skipping.');
  db.close();
  process.exit(0);
}

const orgName = process.argv[2] ?? 'Demo Organization';
const orgId = randomUUID();
const assessmentId = randomUUID();
const year = new Date().getFullYear();
const now = Math.floor(Date.now() / 1000); // Unix epoch seconds (Drizzle timestamp mode)

db.prepare("INSERT INTO organizations (id, name, legal_entity, contact_email, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(orgId, orgName, orgName, 'admin@local.shieldaudit', 'direct', now);
db.prepare("INSERT INTO user_roles (id, org_id, clerk_user_id, role, created_at) VALUES (?, ?, 'local-user', 'admin', ?)").run(randomUUID(), orgId, now);
db.prepare("INSERT INTO assessments (id, org_id, audit_period_start, audit_period_end, status, auditor_id, uses_admt, created_at) VALUES (?, ?, ?, ?, 'draft', 'local-user', 0, ?)").run(assessmentId, orgId, `${year}-01-01`, `${year}-12-31`, now);
db.prepare("INSERT INTO eligibility_results (id, assessment_id, org_id, covered, trigger_fired, created_at) VALUES (?, ?, ?, 1, 'revenue', ?)").run(randomUUID(), assessmentId, orgId, now);

console.log(`[provision] Created org "${orgName}" (${orgId})`);
db.close();
