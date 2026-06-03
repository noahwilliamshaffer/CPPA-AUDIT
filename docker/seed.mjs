/**
 * seed.mjs — Seeds the 40-question bank into the SQLite database.
 * Idempotent: skips if questions already exist.
 * Usage: node docker/seed.mjs
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH ?? path.join(__dirname, '..', 'shieldaudit.db');

const db = new Database(DB_PATH);

// Check if already seeded
const existing = db.prepare('SELECT COUNT(*) as n FROM questions').get();
if (existing.n > 0) {
  console.log(`[seed] Already seeded (${existing.n} questions). Skipping.`);
  db.close();
  process.exit(0);
}

const QUESTIONS = [
  // Component 1 — Cybersecurity Governance
  { c: 1, q: 'Does the organization have a formally documented cybersecurity policy that has been approved by executive leadership?', w: 'critical', nist: 'GV.PO-01', cis: 'CIS 1.1', o: 1,
    r: 'Develop and gain executive sign-off on a written cybersecurity policy. Use NIST CSF or ISO 27001 as a template. Policy must be reviewed annually and communicated to all staff.' },
  { c: 1, q: 'Is there a designated individual or team (e.g., CISO, security officer) accountable for the cybersecurity program?', w: 'high', nist: 'GV.RR-02', cis: 'CIS 1.1', o: 2,
    r: 'Appoint a named CISO or Security Officer with a defined charter. If budget is limited, designate an existing senior technical role as the cybersecurity owner with documented responsibilities.' },
  { c: 1, q: 'Are cybersecurity roles, responsibilities, and authorities clearly defined and communicated across the organization?', w: 'medium', nist: 'GV.RR-01', cis: 'CIS 1.1', o: 3,
    r: 'Create a RACI matrix for cybersecurity responsibilities. Include it in job descriptions, onboarding materials, and the annual security awareness training.' },

  // Component 2 — Risk Assessment
  { c: 2, q: 'Does the organization conduct formal cybersecurity risk assessments at least annually or upon significant change?', w: 'critical', nist: 'ID.RA-01', cis: 'CIS 18.1', o: 4,
    r: 'Implement an annual risk assessment cadence. Use NIST SP 800-30 methodology. Trigger reassessments on: new systems, M&A activity, major infrastructure changes, or significant incidents.' },
  { c: 2, q: 'Are identified risks tracked in a risk register with assigned owners and remediation timelines?', w: 'high', nist: 'ID.RA-06', cis: 'CIS 18.2', o: 5,
    r: 'Maintain a formal risk register (spreadsheet or GRC tool). Each risk entry must include: description, likelihood, impact, risk rating, owner, mitigation action, and target remediation date.' },
  { c: 2, q: 'Does the risk assessment process consider threats to the confidentiality, integrity, and availability of consumer personal information?', w: 'critical', nist: 'ID.RA-02', cis: 'CIS 18.1', o: 6,
    r: 'Explicitly scope risk assessments to include consumer PI data flows. Map data to systems, identify threat scenarios (breach, ransomware, insider threat), and document CIA impact ratings.' },

  // Component 3 — Asset Management
  { c: 3, q: 'Does the organization maintain a current inventory of all hardware and software assets that process or store personal information?', w: 'high', nist: 'ID.AM-01', cis: 'CIS 1.1', o: 7,
    r: 'Deploy an automated asset discovery tool (e.g., CIS-CAT, Tenable, Qualys). Maintain a CMDB that tags PI-processing assets. Review and reconcile the inventory quarterly.' },
  { c: 3, q: 'Are data flows for personal information documented, including third-party transfers and storage locations?', w: 'high', nist: 'ID.AM-03', cis: 'CIS 1.2', o: 8,
    r: 'Create a data flow diagram (DFD) that maps all PI from collection through deletion. Document third-party recipients, transfer mechanisms (API, SFTP, email), and storage locations. Review annually.' },

  // Component 4 — Access Controls
  { c: 4, q: 'Does the organization enforce the principle of least privilege, granting access only to the minimum necessary for each role?', w: 'critical', nist: 'PR.AA-05', cis: 'CIS 5.4', o: 9,
    r: 'Conduct an access rights review. Implement role-based access control (RBAC). Remove all "just in case" access. Use privileged access management (PAM) tools for admin accounts.' },
  { c: 4, q: 'Is multi-factor authentication (MFA) required for all access to systems that contain personal information?', w: 'critical', nist: 'PR.AA-03', cis: 'CIS 6.3', o: 10,
    r: 'Enable MFA for all accounts accessing PI systems — no exceptions. Prioritize: cloud consoles, email, VPN, remote access, and SaaS applications. Use TOTP, hardware keys, or push authentication.' },
  { c: 4, q: 'Are user access rights reviewed at least quarterly and promptly revoked upon termination or role change?', w: 'high', nist: 'PR.AA-05', cis: 'CIS 5.3', o: 11,
    r: 'Establish a formal access review process: quarterly reviews with documented sign-off by managers. Integrate with HR offboarding to automate account deprovisioning within 24 hours of termination.' },
  { c: 4, q: 'Are privileged accounts (admin, root) managed separately from standard user accounts with additional controls?', w: 'critical', nist: 'PR.AA-05', cis: 'CIS 5.4', o: 12,
    r: 'Implement a PAM solution. Admins must use separate privileged accounts (not daily-use accounts). Require MFA, session recording, and time-limited access for all privileged operations.' },

  // Component 5 — Data Security
  { c: 5, q: 'Is personal information encrypted at rest using industry-standard algorithms (e.g., AES-256)?', w: 'critical', nist: 'PR.DS-01', cis: 'CIS 3.11', o: 13,
    r: 'Enable full-disk encryption (FDE) on all endpoints and servers. Use AES-256 for database encryption and file-level encryption for PI exports. Document encryption key management procedures.' },
  { c: 5, q: 'Is personal information encrypted in transit using TLS 1.2 or higher for all network communications?', w: 'critical', nist: 'PR.DS-02', cis: 'CIS 3.10', o: 14,
    r: 'Enforce TLS 1.2+ on all web applications, APIs, and internal services. Disable TLS 1.0 and 1.1. Use HSTS headers. Scan for cleartext PI transmission quarterly using a proxy tool.' },
  { c: 5, q: 'Has the organization implemented data classification to identify and protect sensitive personal information?', w: 'high', nist: 'ID.AM-05', cis: 'CIS 3.2', o: 15,
    r: 'Define a data classification scheme (Public, Internal, Confidential, Restricted). Tag PI as Confidential/Restricted. Implement DLP tools to enforce classification-based handling rules.' },

  // Component 6 — Network Security
  { c: 6, q: 'Is the network segmented to isolate systems containing personal information from general corporate networks?', w: 'high', nist: 'PR.IR-01', cis: 'CIS 12.2', o: 16,
    r: 'Implement network segmentation using VLANs or micro-segmentation. Place PI-processing systems in a dedicated security zone. Restrict inter-zone traffic to only necessary flows with firewall rules.' },
  { c: 6, q: 'Are firewalls, intrusion detection/prevention systems (IDS/IPS), or equivalent controls deployed to protect systems containing personal information?', w: 'high', nist: 'PR.IR-02', cis: 'CIS 13.1', o: 17,
    r: 'Deploy next-gen firewalls (NGFW) at perimeter and between segments. Implement IDS/IPS or EDR for the PI network zone. Review and tune firewall rules quarterly. Enable logging for all denied traffic.' },

  // Component 7 — Vulnerability Management
  { c: 7, q: 'Does the organization conduct regular vulnerability scans (at least quarterly) of systems that process or store personal information?', w: 'high', nist: 'ID.RA-01', cis: 'CIS 7.1', o: 18,
    r: 'Deploy an authenticated vulnerability scanner (Tenable Nessus, Qualys, Rapid7). Scan PI systems at minimum quarterly; critical systems monthly. Review results within 5 business days.' },
  { c: 7, q: 'Are critical security patches applied within defined timeframes (e.g., critical within 30 days, high within 60 days)?', w: 'critical', nist: 'PR.MA-01', cis: 'CIS 7.4', o: 19,
    r: 'Establish a formal patch management policy with SLAs: Critical ≤30 days, High ≤60 days, Medium ≤90 days. Use automated patch management tools. Track exceptions with documented compensating controls.' },

  // Component 8 — Incident Response
  { c: 8, q: 'Does the organization have a documented incident response plan that addresses cybersecurity incidents involving personal information?', w: 'critical', nist: 'RS.MA-01', cis: 'CIS 17.1', o: 20,
    r: 'Develop an IRP following NIST SP 800-61. Include: PI breach scenarios, containment procedures, evidence preservation, consumer notification timelines (72-hour CPPA requirement), and regulatory reporting steps.' },
  { c: 8, q: 'Has the incident response plan been tested (tabletop exercise or full simulation) within the past 12 months?', w: 'high', nist: 'RS.MA-02', cis: 'CIS 17.6', o: 21,
    r: 'Conduct an annual tabletop exercise with IT, legal, HR, and executive leadership. Include a PI breach scenario. Document findings and update the IRP within 30 days. Retain exercise records for 5 years.' },
  { c: 8, q: 'Are incident response roles and escalation paths clearly defined, including when to notify consumers and regulators?', w: 'high', nist: 'RS.CO-02', cis: 'CIS 17.3', o: 22,
    r: 'Create an incident response contact tree with 24/7 escalation paths. Define PI breach thresholds triggering CPPA notification (within 72 hours). Pre-draft consumer notification templates.' },

  // Component 9 — Recovery Planning
  { c: 9, q: 'Does the organization have documented business continuity and disaster recovery plans for systems that process personal information?', w: 'high', nist: 'RC.RP-01', cis: 'CIS 11.1', o: 23,
    r: 'Develop a BCP/DRP that includes PI systems. Define RTOs and RPOs for each critical system. Document failover procedures, alternate processing sites, and recovery team responsibilities.' },
  { c: 9, q: 'Are backups of personal information data performed regularly and tested for restoration capability?', w: 'high', nist: 'PR.DS-11', cis: 'CIS 11.2', o: 24,
    r: 'Implement automated daily backups following 3-2-1 rule (3 copies, 2 media types, 1 offsite). Test restoration quarterly. Encrypt backups at rest. Store backup media in a secure offsite location.' },

  // Component 10 — Security Awareness & Training
  { c: 10, q: 'Do all employees who handle personal information receive cybersecurity awareness training at least annually?', w: 'high', nist: 'PR.AT-01', cis: 'CIS 14.1', o: 25,
    r: 'Deploy annual security awareness training covering: phishing, PI handling, password hygiene, incident reporting, and CPPA obligations. Track completion rates and maintain records for 5 years.' },
  { c: 10, q: 'Does the organization conduct phishing simulations or other social engineering awareness exercises?', w: 'medium', nist: 'PR.AT-01', cis: 'CIS 14.2', o: 26,
    r: 'Run quarterly phishing simulations using a platform like KnowBe4 or Proofpoint. Track click rates over time. Require additional training for repeat clickers. Report metrics to executive leadership.' },

  // Component 11 — Third-Party Risk Management
  { c: 11, q: 'Does the organization assess the cybersecurity posture of third-party vendors before sharing personal information with them?', w: 'high', nist: 'GV.SC-06', cis: 'CIS 15.1', o: 27,
    r: 'Implement a vendor risk assessment program. Before sharing PI: require SOC 2 Type II reports or equivalent, complete security questionnaires, and review their breach history. Reassess annually.' },
  { c: 11, q: 'Are data processing agreements (DPAs) or equivalent contracts in place with all third parties that receive personal information?', w: 'critical', nist: 'GV.SC-04', cis: 'CIS 15.2', o: 28,
    r: 'Audit all vendor contracts for PI. Add DPA language to any vendor receiving PI — covering: data use limitations, security requirements, breach notification obligations, and return/deletion of data.' },

  // Component 12 — Physical Security
  { c: 12, q: 'Are physical access controls (badge readers, locked server rooms, visitor logs) in place for facilities that house systems containing personal information?', w: 'medium', nist: 'PR.AA-01', cis: 'CIS 10.1', o: 29,
    r: 'Implement badge-based access to server rooms and areas containing PI. Maintain visitor logs. Review access lists quarterly. Install security cameras at entry points. Conduct annual physical security audits.' },
  { c: 12, q: 'Is physical media (hard drives, backup tapes, printed records) containing personal information disposed of securely using certified destruction methods?', w: 'high', nist: 'PR.DS-03', cis: 'CIS 3.7', o: 30,
    r: 'Use a certified media destruction vendor (NAID AAA certified). Maintain a chain-of-custody log for all media destruction. Shred printed PI documents. Obtain and retain certificates of destruction.' },

  // Component 13 — Logging & Monitoring
  { c: 13, q: 'Are security-relevant events (login attempts, privilege escalations, data access) logged and retained for at least 12 months?', w: 'high', nist: 'DE.CM-01', cis: 'CIS 8.2', o: 31,
    r: 'Deploy a SIEM (Splunk, Elastic SIEM, Microsoft Sentinel) or centralized log management. Configure logging for: authentication events, privilege changes, data access to PI, and admin actions. Retain 12+ months.' },
  { c: 13, q: 'Are logs reviewed on a regular basis (automated or manual) and alerts generated for anomalous activity?', w: 'high', nist: 'DE.AE-02', cis: 'CIS 8.11', o: 32,
    r: 'Configure automated alerting rules in your SIEM for: multiple failed logins, off-hours access, bulk PI downloads, privilege escalations. Assign an analyst to review alerts daily. Document review evidence.' },

  // Component 14 — Application Security
  { c: 14, q: 'Are applications that handle personal information developed or evaluated using a secure software development lifecycle (SSDLC)?', w: 'high', nist: 'PR.PS-04', cis: 'CIS 16.1', o: 33,
    r: 'Integrate security into the SDLC: threat modeling at design, SAST in CI/CD pipeline, code reviews for security issues, DAST before release. Train developers on OWASP Top 10 and secure coding practices.' },
  { c: 14, q: 'Are web-facing applications that handle personal information tested for OWASP Top 10 vulnerabilities at least annually?', w: 'high', nist: 'ID.RA-01', cis: 'CIS 16.12', o: 34,
    r: 'Conduct annual penetration testing of all web applications processing PI. Use a qualified third-party tester or approved automated tools. Remediate critical/high findings within 30 days. Retain reports.' },

  // Component 15 — Change Management
  { c: 15, q: 'Is a formal change management process in place requiring security review before changes are made to systems that process personal information?', w: 'medium', nist: 'PR.PS-03', cis: 'CIS 4.1', o: 35,
    r: 'Implement a change advisory board (CAB) process. Require security impact assessment for changes to PI systems. Maintain a change log with approvals, test results, and rollback procedures.' },
  { c: 15, q: 'Are system configurations hardened using industry benchmarks (CIS Benchmarks, DISA STIGs) and verified regularly?', w: 'medium', nist: 'PR.PS-01', cis: 'CIS 4.2', o: 36,
    r: 'Apply CIS Benchmarks for all PI-processing systems (OS, database, web server). Use configuration management tools (Ansible, Chef) to enforce baselines. Scan for drift quarterly.' },

  // Component 16 — Data Retention & Disposal
  { c: 16, q: 'Does the organization have a documented data retention policy that defines how long personal information is retained and the basis for that period?', w: 'high', nist: 'PR.DS-04', cis: 'CIS 3.1', o: 37,
    r: 'Create a data retention schedule mapping each PI category to a retention period with legal basis. Include CPPA requirement: audit records retained 5 years. Review policy annually with legal counsel.' },
  { c: 16, q: 'Is personal information deleted or de-identified once retention periods expire, using methods that prevent reconstruction?', w: 'high', nist: 'PR.DS-03', cis: 'CIS 3.7', o: 38,
    r: 'Implement automated deletion workflows tied to retention schedule. Use cryptographic erasure or DoD 5220.22-M overwrite for digital PI. For de-identification, follow NIST SP 800-188 or safe harbor standards.' },

  // Component 17 — Privacy Program Integration
  { c: 17, q: 'Are privacy-by-design principles incorporated into the development of new systems, products, or services that process personal information?', w: 'medium', nist: 'GV.PO-02', cis: 'CIS 3.2', o: 39,
    r: 'Conduct Privacy Impact Assessments (PIAs) for new PI-processing systems. Require privacy review at design stage. Adopt data minimization: only collect PI necessary for the stated purpose.' },

  // Component 18 — ADMT Security Controls
  { c: 18, q: 'If the organization uses automated decision-making technology (ADMT) that substantially replaces human review, have bias testing and fairness assessments been conducted?', w: 'high', nist: 'GV.PO-01', cis: 'CIS 1.1', o: 40,
    r: 'Document all ADMT systems per §7001(ddd). Conduct annual bias audits using demographic parity or equalized odds metrics. Maintain opt-out mechanisms for consumers. Retain bias testing records for 5 years.' },
];

const insert = db.prepare(`
  INSERT INTO questions (id, component_number, question_text, risk_weight,
    nist_csf_mapping, cis_control_mapping, parent_question_id, trigger_condition,
    display_order, active, remediation)
  VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 1, ?)
`);

const insertAll = db.transaction((questions) => {
  for (const q of questions) {
    insert.run(randomUUID(), q.c, q.q, q.w, q.nist, q.cis, q.o, q.r);
  }
});

console.log(`[seed] Seeding ${QUESTIONS.length} questions...`);
insertAll(QUESTIONS);
console.log('[seed] Done.');
db.close();
