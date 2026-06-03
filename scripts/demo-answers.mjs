/**
 * demo-answers.mjs — Submits realistic answers for all 40 questions,
 * then triggers score calculation. Simulates a mid-tier client
 * (some strengths, some gaps) so the scoring dashboard shows all three
 * traffic-light colors.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH ?? path.join(__dirname, '..', 'shieldaudit.db');
const db = new Database(DB_PATH);

// Get org + assessment
const role = db.prepare("SELECT org_id FROM user_roles WHERE clerk_user_id = 'local-user' LIMIT 1").get();
if (!role) { console.error('No org — run provision-demo.mjs first'); process.exit(1); }

const assessment = db.prepare("SELECT id FROM assessments WHERE org_id = ? ORDER BY created_at DESC LIMIT 1").run
  ? db.prepare("SELECT id FROM assessments WHERE org_id = ? ORDER BY created_at DESC LIMIT 1").get(role.org_id)
  : null;
if (!assessment) { console.error('No assessment found'); process.exit(1); }

const orgId = role.org_id;
const assessmentId = assessment.id;
const now = Math.floor(Date.now() / 1000);

console.log(`[demo] Org:        ${orgId}`);
console.log(`[demo] Assessment: ${assessmentId}`);

// Get all questions
const questions = db.prepare('SELECT id, component_number, risk_weight, display_order FROM questions ORDER BY display_order').all();
console.log(`[demo] Found ${questions.length} questions`);

// Realistic answer pattern for a mid-tier company:
// Components 1-3 (Governance, Risk, Assets): mostly good → GREEN
// Components 4-7 (Access, Data, Network, Vuln): mixed → YELLOW
// Components 8-11 (Incident, Recovery, Training, Vendor): weak → RED
// Components 12-18 (Physical, Logging, AppSec, Change, Retention, Privacy, ADMT): mixed

const ANSWER_MAP = {
  // Component 1 — Cybersecurity Governance: GREEN (well-established)
  1: ['yes', 'yes', 'yes'],
  // Component 2 — Risk Assessment: GREEN
  2: ['yes', 'yes', 'partial'],
  // Component 3 — Asset Management: YELLOW
  3: ['partial', 'partial'],
  // Component 4 — Access Controls: YELLOW
  4: ['partial', 'yes', 'no', 'partial'],
  // Component 5 — Data Security: YELLOW
  5: ['yes', 'yes', 'no'],
  // Component 6 — Network Security: YELLOW
  6: ['partial', 'partial'],
  // Component 7 — Vulnerability Management: RED (no regular scanning)
  7: ['no', 'partial'],
  // Component 8 — Incident Response: RED (no tested IRP)
  8: ['partial', 'no', 'no'],
  // Component 9 — Recovery Planning: YELLOW
  9: ['partial', 'yes'],
  // Component 10 — Security Awareness: YELLOW
  10: ['yes', 'no'],
  // Component 11 — Third-Party Risk: RED (no DPAs)
  11: ['partial', 'no'],
  // Component 12 — Physical Security: GREEN
  12: ['yes', 'yes'],
  // Component 13 — Logging & Monitoring: YELLOW
  13: ['yes', 'no'],
  // Component 14 — Application Security: YELLOW
  14: ['partial', 'partial'],
  // Component 15 — Change Management: GREEN
  15: ['yes', 'yes'],
  // Component 16 — Data Retention: YELLOW
  16: ['yes', 'no'],
  // Component 17 — Privacy Program: YELLOW
  17: ['partial'],
  // Component 18 — ADMT: not_applicable (no ADMT used)
  18: ['not_applicable'],
};

// Clear existing answers
db.prepare('DELETE FROM answers WHERE assessment_id = ?').run(assessmentId);

const insertAnswer = db.prepare(`
  INSERT INTO answers (id, assessment_id, question_id, org_id, auditor_id, response, updated_at)
  VALUES (?, ?, ?, ?, 'local-user', ?, ?)
`);

const insertAll = db.transaction(() => {
  for (const q of questions) {
    const answers = ANSWER_MAP[q.component_number];
    // Find position within component
    const compQs = questions.filter(x => x.component_number === q.component_number);
    const pos = compQs.indexOf(q);
    const response = answers?.[pos] ?? 'not_applicable';
    insertAnswer.run(randomUUID(), assessmentId, q.id, orgId, response, now);
  }
});

insertAll();
console.log(`[demo] Inserted ${questions.length} answers`);

// Calculate scores per component
// Scoring: yes=100, partial=50, no=0, not_applicable=excluded
// Weights: critical=4, high=3, medium=2, low=1
// Status: green≥80, yellow≥50, red<50

const WEIGHTS = { critical: 4, high: 3, medium: 2, low: 1 };
const SCORE_VALUES = { yes: 100, partial: 50, no: 0, not_applicable: null };

db.prepare('DELETE FROM component_scores WHERE assessment_id = ?').run(assessmentId);

const insertScore = db.prepare(`
  INSERT INTO component_scores (id, assessment_id, component_number, score, status, calculated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const componentNumbers = [...new Set(questions.map(q => q.component_number))];

for (const cn of componentNumbers) {
  const compQs = questions.filter(q => q.component_number === cn);
  const compAnswers = db.prepare(`
    SELECT q.risk_weight, a.response
    FROM answers a JOIN questions q ON a.question_id = q.id
    WHERE a.assessment_id = ? AND q.component_number = ?
  `).all(assessmentId, cn);

  let weightedSum = 0;
  let totalWeight = 0;

  for (const row of compAnswers) {
    const val = SCORE_VALUES[row.response];
    if (val === null) continue; // not_applicable excluded
    const w = WEIGHTS[row.risk_weight] ?? 1;
    weightedSum += val * w;
    totalWeight += w;
  }

  const score = totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight);
  const status = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';

  insertScore.run(randomUUID(), assessmentId, cn, score, status, now);
  console.log(`  Component ${String(cn).padStart(2)}: score=${String(score).padStart(3)}  ${status.toUpperCase()}`);
}

// Advance assessment to 'scoring' status
db.prepare("UPDATE assessments SET status = 'scoring' WHERE id = ?").run(assessmentId);
console.log(`\n[demo] Assessment status → scoring`);
console.log('[demo] Done. Restart the server and open localhost:3000');
db.close();
