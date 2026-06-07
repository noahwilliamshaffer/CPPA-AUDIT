/**
 * seed.mjs — Seeds the §7123(c) audit question bank into the SQLite database.
 *
 * Question IDs are the regulatory codes (Q-01, Q-01a, A-01, …) so the AI
 * autofill pipeline (ADD-17) can map Claude's returned IDs directly to rows.
 *
 * Bank: 30 base questions (Q-01–Q-30) across 18 §7123(c) components,
 *       9 conditional/branch questions, and 9 ADMT questions (A-01–A-08, A-04a)
 *       under the ADMT sub-assessment (component 19, §7200–7222). Total: 48.
 *
 * answerType drives the UI control and scoring:
 *   yes_partial_no_na | yes_no_na  → SCORED (yes=100, partial=50, no=0, N/A excluded)
 *   yes_no                          → gate question, NOT scored
 *   open_text | choice              → NOT scored
 *
 * triggerCondition { showWhen: [...] } lists the parent responses that reveal a child.
 *
 * Idempotent: skips if questions already exist. Usage: node docker/seed.mjs
 */

import Database from 'better-sqlite3';
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

// Shorthand keys:
//   id, c=component, q=text, w=riskWeight, csf=CSF subcategory, n=NIST 800-53,
//   p=parentQuestionId, t=showWhen[] (trigger), at=answerType, opt=options[], r=remediation
const QUESTIONS = [
  // ── Component 1 — Authentication — §7123(c)(1) ───────────────────────────────
  { id: 'Q-01', c: 1, q: 'Does the business enforce MFA for all employees, independent contractors, other personnel, service providers, and contractors accessing systems that store or process personal information?',
    w: 'critical', csf: 'PR.AA-01, PR.AA-03', n: 'IA-2, IA-2(1), IA-2(6)', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Enforce MFA on every account that can reach PI systems — cloud consoles, email, VPN, remote access, and SaaS. Eliminate exceptions and document any temporary ones with compensating controls.' },
  { id: 'Q-01a', c: 1, q: 'Which personnel groups or system access points are NOT covered by MFA, and what compensating controls are in place?',
    w: 'high', csf: 'PR.AA-01, PR.AA-03', n: 'IA-2', p: 'Q-01', t: ['partial', 'no'], at: 'open_text', opt: null,
    r: 'Document every uncovered group/access point and the compensating control, then build a remediation timeline to close the MFA gap.' },
  { id: 'Q-01b', c: 1, q: 'Is the MFA implementation phishing-resistant (e.g., hardware keys, passkeys) rather than SMS or email OTP only?',
    w: 'high', csf: 'PR.AA-01, PR.AA-03', n: 'IA-2(1), IA-2(2)', p: 'Q-01', t: ['yes', 'partial'], at: 'yes_partial_no_na', opt: null,
    r: 'Migrate from SMS/email OTP to phishing-resistant factors (FIDO2 hardware keys or passkeys), at minimum for administrators and high-risk PI access.' },
  { id: 'Q-02', c: 1, q: 'Does the business use passwords or passphrases to authenticate users?',
    w: 'high', csf: 'PR.AA-01', n: 'IA-5, IA-5(1)', p: null, t: null, at: 'yes_no', opt: null,
    r: 'If passwords are used, ensure length, breached-password screening, and reuse controls are enforced (see following questions).' },
  { id: 'Q-02a', c: 1, q: 'Does the business enforce a minimum password length of at least 8 characters?',
    w: 'high', csf: 'PR.AA-01', n: 'IA-5(1)', p: 'Q-02', t: ['yes'], at: 'yes_no_na', opt: null,
    r: 'Configure a minimum length of at least 8 characters (NIST 800-63B recommends 8+; prefer longer passphrases) in your identity provider policy.' },
  { id: 'Q-02b', c: 1, q: 'Does the business maintain and enforce a disallowed list of commonly used or breached passwords?',
    w: 'medium', csf: 'PR.AA-01', n: 'IA-5(1)', p: 'Q-02', t: ['yes'], at: 'yes_no_na', opt: null,
    r: 'Enable breached-password screening (e.g., HaveIBeenPwned integration or an IdP feature) and block common passwords at set time.' },
  { id: 'Q-02c', c: 1, q: 'Does the business prohibit password reuse across systems that process personal information?',
    w: 'medium', csf: 'PR.AA-01', n: 'IA-5(1)', p: 'Q-02', t: ['yes'], at: 'yes_no_na', opt: null,
    r: 'Adopt SSO to reduce distinct credentials and enforce policy/awareness prohibiting password reuse across PI systems.' },

  // ── Component 2 — Encryption — §7123(c)(2) ───────────────────────────────────
  { id: 'Q-03', c: 2, q: 'Does the business encrypt personal information at rest using an industry-accepted encryption standard?',
    w: 'critical', csf: 'PR.DS-01', n: 'SC-28, SC-28(1)', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Enable AES-256 (or equivalent) full-disk and database encryption for all stores holding PI, and document key management procedures.' },
  { id: 'Q-04', c: 2, q: 'Does the business encrypt personal information in transit (e.g., TLS 1.2 or higher enforced for all transmissions containing PI)?',
    w: 'critical', csf: 'PR.DS-02', n: 'SC-8, SC-8(1)', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Enforce TLS 1.2+ on all web apps, APIs, and internal services carrying PI; disable TLS 1.0/1.1; enable HSTS; scan for cleartext PI.' },

  // ── Component 3 — Account Management & Access Controls — §7123(c)(3) ──────────
  { id: 'Q-05', c: 3, q: "Does the business restrict each person's access to PI to only what is necessary for their role, and revoke access promptly on termination or role change?",
    w: 'critical', csf: 'PR.AA-05', n: 'AC-2, AC-3, AC-6', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Implement RBAC with least privilege, run periodic access reviews, and integrate offboarding with HR to deprovision access within 24 hours.' },
  { id: 'Q-06', c: 3, q: 'Does the business restrict the number of privileged accounts, limit their functions, and use a PAM solution?',
    w: 'high', csf: 'PR.AA-05', n: 'AC-2(1), AC-6(1), AC-6(5)', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Inventory privileged accounts, enforce separate admin identities, and deploy PAM with MFA, session recording, and just-in-time access.' },
  { id: 'Q-07', c: 3, q: 'Does the business restrict and monitor creation of new accounts and ensure appropriate access limits from the start?',
    w: 'high', csf: 'PR.AA-05', n: 'AC-2(2), AC-2(3)', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Define an account provisioning workflow with approval gates and alerting on new-account creation; default to least-privilege role templates.' },
  { id: 'Q-08', c: 3, q: 'Does the business restrict and monitor physical access to locations where PI is stored or processed?',
    w: 'medium', csf: 'PR.AA-05', n: 'PE-2, PE-3, PE-6', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Implement badge access to server rooms/PI areas, maintain visitor logs, review access quarterly, and add monitoring at entry points.' },

  // ── Component 4 — Inventory & Management of PI — §7123(c)(4) ──────────────────
  { id: 'Q-09', c: 4, q: 'Does the business maintain a PI inventory that maps where PI is stored, how it flows through systems, and how it is classified and tagged?',
    w: 'high', csf: 'ID.AM-01, ID.AM-05', n: 'CM-8, RA-2', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Build a data inventory and data-flow map for all PI, apply a classification scheme, and review the inventory at least annually.' },
  { id: 'Q-10', c: 4, q: 'Does the business maintain hardware and software inventories and enforce allowlisting to control what can connect to or execute on its information system?',
    w: 'medium', csf: 'ID.AM-01, ID.AM-02', n: 'CM-7, CM-8(1)', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Deploy automated HW/SW asset discovery and application allowlisting; reconcile the inventory regularly and remove unauthorized software.' },
  { id: 'Q-11', c: 4, q: 'Does the business have a documented hardware and software approval process and prevent unauthorized devices from connecting to its IS?',
    w: 'high', csf: 'ID.AM-02', n: 'CM-7, CM-8, SC-7', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Document a HW/SW approval process and enforce network access control (NAC) so only approved, compliant devices can connect.' },

  // ── Component 5 — Secure Configuration — §7123(c)(5) ─────────────────────────
  { id: 'Q-12', c: 5, q: 'Does the business have a documented process for applying software updates/upgrades and does it secure both on-premises and cloud environments?',
    w: 'high', csf: 'PR.PS-01, PR.PS-02', n: 'CM-2, CM-6, SI-2', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Document update/upgrade procedures and secure baselines (e.g., CIS Benchmarks) for both on-prem and cloud; track configuration drift.' },
  { id: 'Q-13', c: 5, q: 'Does the business mask sensitive PI by default in applications (e.g., replacing visible characters with asterisks)?',
    w: 'high', csf: 'PR.DS-01', n: 'SC-28, AC-3', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Enable default data masking in applications that display PI, revealing full values only on a documented need-to-know basis.' },
  { id: 'Q-14', c: 5, q: 'Does the business have a security patch management process including systematic notifications and verification that patches are deployed?',
    w: 'high', csf: 'PR.PS-02', n: 'SI-2, SI-2(2)', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Adopt a patch policy with SLAs (Critical ≤30d, High ≤60d), automated deployment, and verification scanning to confirm coverage.' },
  { id: 'Q-15', c: 5, q: 'Does the business have a change management process ensuring system changes do not undermine existing security safeguards?',
    w: 'medium', csf: 'PR.PS-01', n: 'CM-3, CM-4', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Implement a change management process with security impact review, approvals, testing, and rollback procedures for PI systems.' },

  // ── Component 6 — Vulnerability Management — §7123(c)(6) ──────────────────────
  { id: 'Q-16', c: 6, q: 'Does the business conduct internal and external vulnerability scans and penetration testing on a defined cadence, and operate a vulnerability disclosure or reporting program?',
    w: 'high', csf: 'ID.RA-01', n: 'RA-5, CA-8', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Run authenticated internal/external scans on a set cadence, perform periodic penetration tests, track remediation, and publish a disclosure process.' },

  // ── Component 7 — Audit-Log Management — §7123(c)(7) ─────────────────────────
  { id: 'Q-17', c: 7, q: 'Does the business centrally store, retain, and actively monitor audit logs from all systems that process PI?',
    w: 'high', csf: 'DE.CM-01, DE.CM-03', n: 'AU-2, AU-3, AU-9, AU-12', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Deploy centralized logging/SIEM covering all PI systems, set a retention schedule, protect log integrity, and review alerts on a defined cadence.' },

  // ── Component 8 — Network Monitoring & Defenses — §7123(c)(8) ─────────────────
  { id: 'Q-18', c: 8, q: 'Does the business deploy bot-detection, IDS, and IPS technologies to detect and prevent unauthorized access to PI?',
    w: 'high', csf: 'DE.CM-01, DE.CM-04', n: 'SI-3, SI-4, SI-4(2)', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Deploy IDS/IPS and bot-detection for the PI network zone, tune signatures, and route alerts to monitored response workflows.' },
  { id: 'Q-19', c: 8, q: 'Does the business deploy DLP systems to detect and prevent unauthorized access, use, or disclosure of PI?',
    w: 'high', csf: 'DE.CM-04', n: 'SI-4(4), SC-7', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Implement DLP with rules tuned to your PI categories across endpoints, email, and egress points; review DLP alerts regularly.' },

  // ── Component 9 — Antivirus & Antimalware — §7123(c)(9) ──────────────────────
  { id: 'Q-20', c: 9, q: 'Does the business deploy antivirus and antimalware protections across all endpoints and systems processing PI, with definitions updated on a defined cadence?',
    w: 'high', csf: 'PR.PS-05', n: 'SI-3, SI-3(1)', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Deploy EPP/EDR on all endpoints and PI servers with automatic definition/engine updates and centralized monitoring of detections.' },

  // ── Component 10 — Network Segmentation — §7123(c)(10) ───────────────────────
  { id: 'Q-21', c: 10, q: 'Does the business segment its information system to isolate systems processing PI from other network zones using properly configured firewalls, routers, or switches?',
    w: 'high', csf: 'PR.IR-01', n: 'SC-7, SC-7(5), SC-32', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Place PI systems in a dedicated segment/VLAN, restrict inter-zone traffic to required flows with default-deny rules, and review the ruleset quarterly.' },

  // ── Component 11 — Ports, Services & Protocols — §7123(c)(11) ─────────────────
  { id: 'Q-22', c: 11, q: 'Does the business maintain an inventory of open ports, running services, and active protocols, and disable those not necessary for business operations?',
    w: 'medium', csf: 'PR.PS-01', n: 'CM-7, CM-7(1)', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Inventory open ports/services/protocols, disable anything unnecessary, and validate via periodic port scans and firewall rule reviews.' },

  // ── Component 12 — Cybersecurity Awareness — §7123(c)(12) ─────────────────────
  { id: 'Q-23', c: 12, q: 'Does the business have a formal process for maintaining current knowledge of changing cybersecurity threats and communicating relevant threat intelligence to appropriate personnel?',
    w: 'medium', csf: 'ID.RA-02', n: 'PM-15, SI-5', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Subscribe to threat intelligence feeds/advisories (e.g., CISA), and establish a process to triage and communicate relevant threats to staff.' },

  // ── Component 13 — Cybersecurity Education & Training — §7123(c)(13) ──────────
  { id: 'Q-24', c: 13, q: 'Does the business provide cybersecurity training to all employees, independent contractors, and other personnel with access to its IS?',
    w: 'high', csf: 'PR.AT-01', n: 'AT-2, AT-2(2), AT-3', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Deliver security awareness training to all personnel with system access, track completion, and retain records for 5 years.' },
  { id: 'Q-24a', c: 13, q: 'Does the business provide cybersecurity training at onboarding?',
    w: 'medium', csf: 'PR.AT-01', n: 'AT-2, AT-3', p: 'Q-24', t: ['yes', 'partial'], at: 'yes_no_na', opt: null,
    r: 'Add a mandatory security training module to onboarding completed before access to PI systems is granted.' },
  { id: 'Q-24b', c: 13, q: 'Does the business provide cybersecurity training annually to all personnel with system access?',
    w: 'high', csf: 'PR.AT-01', n: 'AT-2, AT-2(2)', p: 'Q-24', t: ['yes', 'partial'], at: 'yes_no_na', opt: null,
    r: 'Schedule annual refresher training for all personnel with system access and track completion to 100%.' },
  { id: 'Q-24c', c: 13, q: 'Does the business provide cybersecurity training after a PI security breach (Civil Code §1798.150)?',
    w: 'low', csf: 'PR.AT-01', n: 'AT-2, IR-2', p: 'Q-24', t: ['yes', 'partial'], at: 'choice',
    opt: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'not_applicable', label: 'N/A' }, { value: 'no_breach', label: 'No breach occurred during audit period' }],
    r: 'Define post-incident training that is triggered after a PI breach, covering lessons learned and updated procedures.' },

  // ── Component 14 — Secure Development — §7123(c)(14) ──────────────────────────
  { id: 'Q-25', c: 14, q: 'Does the business follow secure development and coding best practices, including code reviews and security testing as part of its SDLC?',
    w: 'high', csf: 'PR.PS-04', n: 'SA-8, SA-11, SA-15', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Integrate threat modeling, peer code review, SAST/DAST, and dependency scanning into the SDLC; train developers on OWASP Top 10.' },

  // ── Component 15 — Service Provider Oversight — §7123(c)(15) ──────────────────
  { id: 'Q-26', c: 15, q: 'Does the business maintain oversight of service providers, contractors, and third parties to ensure compliance with §7051 and §7053, including through written contracts and periodic vendor risk assessments?',
    w: 'high', csf: 'GV.SC-01, GV.SC-04', n: 'SA-9, SR-1, SR-3', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Maintain a vendor inventory, require §7051/§7053 contract terms and security evidence (e.g., SOC 2), and reassess vendor risk annually.' },

  // ── Component 16 — Retention & Disposal — §7123(c)(16) ───────────────────────
  { id: 'Q-27', c: 16, q: 'Does the business maintain a documented retention schedule for PI and dispose of PI no longer required to be retained?',
    w: 'high', csf: 'PR.DS-05', n: 'MP-6, SI-12', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Publish a retention schedule mapping each PI category to a retention period and legal basis, with automated disposal once periods expire.' },
  { id: 'Q-27a', c: 16, q: 'What disposal method does the business use: (A) shredding, (B) erasing, or (C) rendering the information unreadable or undecipherable?',
    w: 'medium', csf: 'PR.DS-05', n: 'MP-6', p: 'Q-27', t: ['yes', 'partial'], at: 'choice',
    opt: [{ value: 'shredding', label: 'Shredding' }, { value: 'erasing', label: 'Erasing' }, { value: 'rendering', label: 'Rendering Unreadable' }, { value: 'combination', label: 'Combination' }],
    r: 'Use a certified destruction method appropriate to the media (cross-cut shredding, cryptographic erase, or NIST 800-88 sanitization) and retain destruction records.' },

  // ── Component 17 — Incident Response — §7123(c)(17) ──────────────────────────
  { id: 'Q-28', c: 17, q: 'Does the business have a documented incident response plan with predetermined procedures for detecting, responding to, limiting consequences of, and recovering from malicious attacks?',
    w: 'critical', csf: 'RS.MA-01', n: 'IR-8, IR-4', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Develop an IR plan (NIST 800-61) covering detection, containment, eradication, recovery, defined roles, escalation paths, and breach notification timelines.' },
  { id: 'Q-29', c: 17, q: 'Does the business test its incident response capabilities (e.g., tabletop exercises, simulations, or drills) and document the results?',
    w: 'high', csf: 'RS.MA-04', n: 'IR-3, IR-3(2)', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Run at least annual tabletop/drill exercises including a PI breach scenario, capture after-action findings, and update the IR plan accordingly.' },

  // ── Component 18 — Business Continuity & Disaster Recovery — §7123(c)(18) ─────
  { id: 'Q-30', c: 18, q: 'Does the business have documented, tested BCP/DRP plans including data-recovery capabilities, backup procedures, and defined RTO and RPO targets?',
    w: 'high', csf: 'RC.RP-01', n: 'CP-2, CP-9, CP-10', p: null, t: null, at: 'yes_partial_no_na', opt: null,
    r: 'Document BCP/DRP with per-system RTO/RPO, implement 3-2-1 backups, and test restoration at least quarterly with documented results.' },

  // ── Component 19 — ADMT Sub-Assessment — §7200–7222 ──────────────────────────
  { id: 'A-01', c: 19, q: 'Does the business use ADMT to make a significant decision concerning a consumer (e.g., financial services, housing, insurance, education, employment, healthcare)?',
    w: 'high', csf: 'GV.OC-01', n: 'PT-1', p: null, t: null, at: 'yes_no', opt: null,
    r: 'Inventory any automated decision-making technology used for significant decisions about consumers; if used, complete the ADMT obligations below.' },
  { id: 'A-02', c: 19, q: 'Does the business provide consumers with a Pre-use Notice before or at the point of collecting PI that will be processed using ADMT?',
    w: 'high', csf: 'GV.OC-02', n: 'PT-4, PT-5', p: 'A-01', t: ['yes'], at: 'yes_partial_no_na', opt: null,
    r: 'Publish a Pre-use Notice presented before/at collection of PI processed by ADMT, meeting §7220 content requirements.' },
  { id: 'A-03', c: 19, q: 'Does the Pre-use Notice include a plain language explanation of the specific purpose for ADMT use?',
    w: 'medium', csf: 'GV.OC-02', n: 'PT-5', p: 'A-01', t: ['yes'], at: 'yes_partial_no_na', opt: null,
    r: 'Add a plain-language statement of the specific purpose of the ADMT to the Pre-use Notice per §7220(c)(1).' },
  { id: 'A-04', c: 19, q: 'Does the business provide consumers the ability to opt-out of ADMT for significant decisions, or qualify for a recognized exception?',
    w: 'high', csf: 'ID.IM-01', n: 'PT-4', p: 'A-01', t: ['yes'], at: 'choice',
    opt: [{ value: 'opt_out', label: 'Opt-out provided' }, { value: 'exception', label: 'Exception claimed' }, { value: 'neither', label: 'Neither' }],
    r: 'Provide a consumer opt-out from ADMT for significant decisions, or document the specific §7221 exception relied upon.' },
  { id: 'A-04a', c: 19, q: 'If claiming the human appeal exception: has the business designated a human reviewer with authority to overturn the ADMT decision, and does it provide a clear, easy-to-use appeal process?',
    w: 'high', csf: 'GV.RR-02', n: 'PT-4', p: 'A-04', t: ['exception'], at: 'choice',
    opt: [{ value: 'yes', label: 'Yes' }, { value: 'partial', label: 'Partial' }, { value: 'no', label: 'No' }],
    r: 'Designate a human reviewer empowered to overturn ADMT decisions and publish a clear, accessible appeal process per §7221(b)(1).' },
  { id: 'A-05', c: 19, q: 'Does the business provide plain language explanations of ADMT purpose, logic, and outcome when a consumer requests access?',
    w: 'high', csf: 'GV.OC-02', n: 'PT-6', p: 'A-01', t: ['yes'], at: 'yes_partial_no_na', opt: null,
    r: 'Establish an access-request workflow that returns plain-language explanations of the ADMT purpose, logic, and outcome per §7222.' },
  { id: 'A-06', c: 19, q: 'Does the business disclose the categories of PI affecting ADMT output, the type of output generated, and how it is used to make a significant decision?',
    w: 'medium', csf: 'GV.OC-02', n: 'PT-5, PT-6', p: 'A-01', t: ['yes'], at: 'yes_partial_no_na', opt: null,
    r: 'Disclose the PI categories influencing the ADMT output, the output type, and how it informs the significant decision per §7220(c)(5).' },
  { id: 'A-07', c: 19, q: 'Where human involvement exists in ADMT decisionmaking: does the human reviewer have the ability to interpret the output, access to review it, and actual authority to change the decision?',
    w: 'medium', csf: 'GV.RR-02', n: 'PT-4', p: 'A-01', t: ['yes'], at: 'choice',
    opt: [{ value: 'yes', label: 'Yes' }, { value: 'partial', label: 'Partial' }, { value: 'no', label: 'No' }, { value: 'not_applicable', label: 'N/A' }, { value: 'no_human', label: 'No human in process' }],
    r: 'Ensure any human reviewer can interpret and access the ADMT output and holds genuine authority to change the decision per §7001(e)(1).' },
  { id: 'A-08', c: 19, q: 'Does the business document and disclose the alternative process for consumers who opt out of ADMT?',
    w: 'medium', csf: 'GV.OC-02', n: 'PT-4', p: 'A-01', t: ['yes'], at: 'yes_partial_no_na', opt: null,
    r: 'Document and disclose the alternative (non-ADMT) process available to consumers who opt out, per §7220(c)(5)(C).' },
];

const insert = db.prepare(`
  INSERT INTO questions (
    id, component_number, question_text, risk_weight,
    nist_csf_mapping, cis_control_mapping, nist_800_53_mapping,
    parent_question_id, trigger_condition,
    answer_type, options, display_order, active, remediation
  ) VALUES (
    @id, @c, @q, @w,
    @csf, NULL, @n,
    @p, @t,
    @at, @opt, @o, 1, @r
  )
`);

const insertAll = db.transaction((rows) => {
  rows.forEach((q, i) => {
    insert.run({
      id: q.id,
      c: q.c,
      q: q.q,
      w: q.w,
      csf: q.csf ?? null,
      n: q.n ?? null,
      p: q.p ?? null,
      t: q.t ? JSON.stringify({ showWhen: q.t }) : null,
      at: q.at,
      opt: q.opt ? JSON.stringify(q.opt) : null,
      o: i + 1,
      r: q.r ?? null,
    });
  });
});

console.log(`[seed] Seeding ${QUESTIONS.length} questions (§7123(c) bank + ADMT)...`);
insertAll(QUESTIONS);
console.log('[seed] Done.');
db.close();
