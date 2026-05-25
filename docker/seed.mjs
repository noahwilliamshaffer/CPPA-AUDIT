/**
 * docker/seed.mjs — Question bank seeder for self-contained Docker deployment.
 *
 * Run automatically by docker-entrypoint.sh on first container start.
 * Skips seeding if questions already exist (idempotent).
 *
 * Pure ESM JavaScript — no TypeScript compilation needed in the runtime stage.
 *
 * Usage: node /app/docker/seed.mjs
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[seed] DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 10 });

// ── Check if already seeded ─────────────────────────────────────────────────
const rows = await sql`SELECT COUNT(*)::int AS count FROM questions`;
const existing = rows[0]?.count ?? 0;

if (existing > 0) {
  console.log(`[seed] Questions already seeded (${existing} questions). Skipping.`);
  await sql.end();
  process.exit(0);
}

// ── Question data ────────────────────────────────────────────────────────────
// 40 questions across 18 §7123(c) components.
// Mirrors src/db/seeds/questions.ts exactly.

const QUESTIONS = [
  // Component 1 — Cybersecurity Governance and Risk Management Program
  { componentNumber: 1, questionText: 'Does the organization have a formally documented cybersecurity policy that has been approved by executive leadership?', riskWeight: 'critical', nistCsfMapping: 'GV.PO-01', cisControlMapping: 'CIS 1.1', displayOrder: 1 },
  { componentNumber: 1, questionText: 'Is there a designated individual or team (e.g., CISO, security officer) accountable for the cybersecurity program?', riskWeight: 'high', nistCsfMapping: 'GV.RR-02', cisControlMapping: 'CIS 1.1', displayOrder: 2 },
  { componentNumber: 1, questionText: 'Are cybersecurity roles, responsibilities, and authorities clearly defined and communicated across the organization?', riskWeight: 'medium', nistCsfMapping: 'GV.RR-01', cisControlMapping: 'CIS 1.1', displayOrder: 3 },

  // Component 2 — Risk Assessment Processes
  { componentNumber: 2, questionText: 'Does the organization conduct formal cybersecurity risk assessments at least annually or upon significant change?', riskWeight: 'critical', nistCsfMapping: 'ID.RA-01', cisControlMapping: 'CIS 18.1', displayOrder: 4 },
  { componentNumber: 2, questionText: 'Are identified risks tracked in a risk register with assigned owners and remediation timelines?', riskWeight: 'high', nistCsfMapping: 'ID.RA-06', cisControlMapping: 'CIS 18.2', displayOrder: 5 },
  { componentNumber: 2, questionText: 'Does the risk assessment process consider threats to the confidentiality, integrity, and availability of consumer personal information?', riskWeight: 'critical', nistCsfMapping: 'ID.RA-02', cisControlMapping: 'CIS 18.1', displayOrder: 6 },

  // Component 3 — Asset Management
  { componentNumber: 3, questionText: 'Does the organization maintain a current inventory of all hardware and software assets that process or store personal information?', riskWeight: 'high', nistCsfMapping: 'ID.AM-01', cisControlMapping: 'CIS 1.1', displayOrder: 7 },
  { componentNumber: 3, questionText: 'Are data flows for personal information documented, including third-party transfers and storage locations?', riskWeight: 'high', nistCsfMapping: 'ID.AM-03', cisControlMapping: 'CIS 1.2', displayOrder: 8 },

  // Component 4 — Access Controls and Identity Management
  { componentNumber: 4, questionText: 'Does the organization enforce the principle of least privilege, granting access only to the minimum necessary for each role?', riskWeight: 'critical', nistCsfMapping: 'PR.AA-05', cisControlMapping: 'CIS 5.4', displayOrder: 9 },
  { componentNumber: 4, questionText: 'Is multi-factor authentication (MFA) required for all access to systems that contain personal information?', riskWeight: 'critical', nistCsfMapping: 'PR.AA-03', cisControlMapping: 'CIS 6.3', displayOrder: 10 },
  { componentNumber: 4, questionText: 'Are user access rights reviewed at least quarterly and promptly revoked upon termination or role change?', riskWeight: 'high', nistCsfMapping: 'PR.AA-05', cisControlMapping: 'CIS 5.3', displayOrder: 11 },
  { componentNumber: 4, questionText: 'Are privileged accounts (admin, root) managed separately from standard user accounts with additional controls?', riskWeight: 'critical', nistCsfMapping: 'PR.AA-05', cisControlMapping: 'CIS 5.4', displayOrder: 12 },

  // Component 5 — Data Security and Encryption
  { componentNumber: 5, questionText: 'Is personal information encrypted at rest using industry-standard algorithms (e.g., AES-256)?', riskWeight: 'critical', nistCsfMapping: 'PR.DS-01', cisControlMapping: 'CIS 3.11', displayOrder: 13 },
  { componentNumber: 5, questionText: 'Is personal information encrypted in transit using TLS 1.2 or higher for all network communications?', riskWeight: 'critical', nistCsfMapping: 'PR.DS-02', cisControlMapping: 'CIS 3.10', displayOrder: 14 },
  { componentNumber: 5, questionText: 'Has the organization implemented data classification to identify and protect sensitive personal information?', riskWeight: 'high', nistCsfMapping: 'ID.AM-05', cisControlMapping: 'CIS 3.2', displayOrder: 15 },

  // Component 6 — Network Security and Monitoring
  { componentNumber: 6, questionText: 'Is the network segmented to isolate systems containing personal information from general corporate networks?', riskWeight: 'high', nistCsfMapping: 'PR.IR-01', cisControlMapping: 'CIS 12.2', displayOrder: 16 },
  { componentNumber: 6, questionText: 'Are firewalls, intrusion detection/prevention systems (IDS/IPS), or equivalent controls deployed to protect systems containing personal information?', riskWeight: 'high', nistCsfMapping: 'PR.IR-02', cisControlMapping: 'CIS 13.1', displayOrder: 17 },

  // Component 7 — Vulnerability and Patch Management
  { componentNumber: 7, questionText: 'Does the organization conduct regular vulnerability scans (at least quarterly) of systems that process or store personal information?', riskWeight: 'high', nistCsfMapping: 'ID.RA-01', cisControlMapping: 'CIS 7.1', displayOrder: 18 },
  { componentNumber: 7, questionText: 'Are critical security patches applied within defined timeframes (e.g., critical within 30 days, high within 60 days)?', riskWeight: 'critical', nistCsfMapping: 'PR.MA-01', cisControlMapping: 'CIS 7.4', displayOrder: 19 },

  // Component 8 — Incident Response
  { componentNumber: 8, questionText: 'Does the organization have a documented incident response plan that addresses cybersecurity incidents involving personal information?', riskWeight: 'critical', nistCsfMapping: 'RS.MA-01', cisControlMapping: 'CIS 17.1', displayOrder: 20 },
  { componentNumber: 8, questionText: 'Has the incident response plan been tested (tabletop exercise or full simulation) within the past 12 months?', riskWeight: 'high', nistCsfMapping: 'RS.MA-02', cisControlMapping: 'CIS 17.6', displayOrder: 21 },
  { componentNumber: 8, questionText: 'Are incident response roles and escalation paths clearly defined, including when to notify consumers and regulators?', riskWeight: 'high', nistCsfMapping: 'RS.CO-02', cisControlMapping: 'CIS 17.3', displayOrder: 22 },

  // Component 9 — Recovery Planning and Business Continuity
  { componentNumber: 9, questionText: 'Does the organization have documented business continuity and disaster recovery plans for systems that process personal information?', riskWeight: 'high', nistCsfMapping: 'RC.RP-01', cisControlMapping: 'CIS 11.1', displayOrder: 23 },
  { componentNumber: 9, questionText: 'Are backups of personal information data performed regularly and tested for restoration capability?', riskWeight: 'high', nistCsfMapping: 'PR.DS-11', cisControlMapping: 'CIS 11.2', displayOrder: 24 },

  // Component 10 — Security Awareness and Training
  { componentNumber: 10, questionText: 'Do all employees who handle personal information receive cybersecurity awareness training at least annually?', riskWeight: 'high', nistCsfMapping: 'PR.AT-01', cisControlMapping: 'CIS 14.1', displayOrder: 25 },
  { componentNumber: 10, questionText: 'Does the organization conduct phishing simulations or other social engineering awareness exercises?', riskWeight: 'medium', nistCsfMapping: 'PR.AT-01', cisControlMapping: 'CIS 14.2', displayOrder: 26 },

  // Component 11 — Third-Party and Vendor Risk Management
  { componentNumber: 11, questionText: 'Does the organization assess the cybersecurity posture of third-party vendors before sharing personal information with them?', riskWeight: 'high', nistCsfMapping: 'GV.SC-06', cisControlMapping: 'CIS 15.1', displayOrder: 27 },
  { componentNumber: 11, questionText: 'Are data processing agreements (DPAs) or equivalent contracts in place with all third parties that receive personal information?', riskWeight: 'critical', nistCsfMapping: 'GV.SC-04', cisControlMapping: 'CIS 15.2', displayOrder: 28 },

  // Component 12 — Physical Security Controls
  { componentNumber: 12, questionText: 'Are physical access controls (badge readers, locked server rooms, visitor logs) in place for facilities that house systems containing personal information?', riskWeight: 'medium', nistCsfMapping: 'PR.AA-01', cisControlMapping: 'CIS 10.1', displayOrder: 29 },
  { componentNumber: 12, questionText: 'Is physical media (hard drives, backup tapes, printed records) containing personal information disposed of securely using certified destruction methods?', riskWeight: 'high', nistCsfMapping: 'PR.DS-03', cisControlMapping: 'CIS 3.7', displayOrder: 30 },

  // Component 13 — Logging, Auditing, and Monitoring
  { componentNumber: 13, questionText: 'Are security-relevant events (login attempts, privilege escalations, data access) logged and retained for at least 12 months?', riskWeight: 'high', nistCsfMapping: 'DE.CM-01', cisControlMapping: 'CIS 8.2', displayOrder: 31 },
  { componentNumber: 13, questionText: 'Are logs reviewed on a regular basis (automated or manual) and alerts generated for anomalous activity?', riskWeight: 'high', nistCsfMapping: 'DE.AE-02', cisControlMapping: 'CIS 8.11', displayOrder: 32 },

  // Component 14 — Application Security
  { componentNumber: 14, questionText: 'Are applications that handle personal information developed or evaluated using a secure software development lifecycle (SSDLC)?', riskWeight: 'high', nistCsfMapping: 'PR.PS-04', cisControlMapping: 'CIS 16.1', displayOrder: 33 },
  { componentNumber: 14, questionText: 'Are web-facing applications that handle personal information tested for OWASP Top 10 vulnerabilities at least annually?', riskWeight: 'high', nistCsfMapping: 'ID.RA-01', cisControlMapping: 'CIS 16.12', displayOrder: 34 },

  // Component 15 — Change Management and Configuration Control
  { componentNumber: 15, questionText: 'Is a formal change management process in place requiring security review before changes are made to systems that process personal information?', riskWeight: 'medium', nistCsfMapping: 'PR.PS-03', cisControlMapping: 'CIS 4.1', displayOrder: 35 },
  { componentNumber: 15, questionText: 'Are system configurations hardened using industry benchmarks (CIS Benchmarks, DISA STIGs) and verified regularly?', riskWeight: 'medium', nistCsfMapping: 'PR.PS-01', cisControlMapping: 'CIS 4.2', displayOrder: 36 },

  // Component 16 — Data Retention and Secure Disposal
  { componentNumber: 16, questionText: 'Does the organization have a documented data retention policy that defines how long personal information is retained and the basis for that period?', riskWeight: 'high', nistCsfMapping: 'PR.DS-04', cisControlMapping: 'CIS 3.1', displayOrder: 37 },
  { componentNumber: 16, questionText: 'Is personal information deleted or de-identified once retention periods expire, using methods that prevent reconstruction?', riskWeight: 'high', nistCsfMapping: 'PR.DS-03', cisControlMapping: 'CIS 3.7', displayOrder: 38 },

  // Component 17 — Privacy Program Integration
  { componentNumber: 17, questionText: 'Are privacy-by-design principles incorporated into the development of new systems, products, or services that process personal information?', riskWeight: 'medium', nistCsfMapping: 'GV.PO-02', cisControlMapping: 'CIS 3.2', displayOrder: 39 },

  // Component 18 — Automated Decision-Making Technology (ADMT) Security
  { componentNumber: 18, questionText: 'If the organization uses automated decision-making technology (ADMT) that substantially replaces human review, have bias testing and fairness assessments been conducted?', riskWeight: 'high', nistCsfMapping: 'GV.PO-01', cisControlMapping: 'CIS 1.1', displayOrder: 40 },
];

// ── Insert questions ─────────────────────────────────────────────────────────
console.log(`[seed] Seeding ${QUESTIONS.length} questions across 18 §7123(c) components...`);

for (const q of QUESTIONS) {
  await sql`
    INSERT INTO questions (
      component_number, question_text, risk_weight,
      nist_csf_mapping, cis_control_mapping,
      parent_question_id, trigger_condition, display_order, active
    ) VALUES (
      ${q.componentNumber}, ${q.questionText}, ${q.riskWeight},
      ${q.nistCsfMapping}, ${q.cisControlMapping},
      ${null}, ${null}, ${q.displayOrder}, ${true}
    )
  `;
}

console.log(`[seed] Done — ${QUESTIONS.length} questions inserted.`);
await sql.end();
