/**
 * §7123(c) audit component definitions — 18 enumerated components plus the
 * ADMT sub-assessment (§7200–7222), modeled as component 19.
 *
 * This is the authoritative component list for rendering, routing, and scoring.
 * The question bank (docker/seed.mjs) maps each question to a componentNumber
 * defined here. `questionCount` counts BASE (always-shown) questions only —
 * conditional/branch questions are revealed dynamically in the component form.
 */

export interface AuditComponent {
  number: number;
  title: string;
  citation: string;        // regulatory citation shown in the UI (ADMT is not a §7123(c) subsection)
  description: string;
  questionCount: number;   // base questions (parentQuestionId IS NULL) for this component
  isAdmt?: boolean;        // true for the ADMT sub-assessment (component 19)
}

export const AUDIT_COMPONENTS: AuditComponent[] = [
  { number: 1,  title: 'Authentication',                          citation: '§7123(c)(1)',  questionCount: 2, description: 'Multi-factor authentication for all personnel accessing personal information, and secure password/passphrase practices.' },
  { number: 2,  title: 'Encryption',                              citation: '§7123(c)(2)',  questionCount: 2, description: 'Encryption of personal information at rest and in transit using industry-accepted standards.' },
  { number: 3,  title: 'Account Management & Access Controls',    citation: '§7123(c)(3)',  questionCount: 4, description: 'Least-privilege access, privileged account management, account provisioning controls, and physical access restriction.' },
  { number: 4,  title: 'Inventory & Management of PI',            citation: '§7123(c)(4)',  questionCount: 3, description: 'PI inventory and data-flow mapping, hardware/software inventories with allowlisting, and a device approval process.' },
  { number: 5,  title: 'Secure Configuration',                    citation: '§7123(c)(5)',  questionCount: 4, description: 'Update/upgrade processes for on-prem and cloud, PI masking by default, patch management, and change management.' },
  { number: 6,  title: 'Vulnerability Management',               citation: '§7123(c)(6)',  questionCount: 1, description: 'Internal/external vulnerability scanning, penetration testing on a defined cadence, and a vulnerability disclosure program.' },
  { number: 7,  title: 'Audit-Log Management',                    citation: '§7123(c)(7)',  questionCount: 1, description: 'Centralized storage, retention, and active monitoring of audit logs from all systems that process PI.' },
  { number: 8,  title: 'Network Monitoring & Defenses',          citation: '§7123(c)(8)',  questionCount: 2, description: 'Bot-detection, IDS/IPS, and data loss prevention (DLP) technologies protecting personal information.' },
  { number: 9,  title: 'Antivirus & Antimalware',                citation: '§7123(c)(9)',  questionCount: 1, description: 'Antivirus and antimalware protections across all endpoints and systems processing PI, with current definitions.' },
  { number: 10, title: 'Network Segmentation',                    citation: '§7123(c)(10)', questionCount: 1, description: 'Segmentation isolating systems that process PI from other network zones via firewalls, routers, or switches.' },
  { number: 11, title: 'Ports, Services & Protocols',            citation: '§7123(c)(11)', questionCount: 1, description: 'Inventory of open ports, running services, and active protocols, with unnecessary ones disabled.' },
  { number: 12, title: 'Cybersecurity Awareness',               citation: '§7123(c)(12)', questionCount: 1, description: 'A formal process for tracking changing cyber threats and communicating threat intelligence to personnel.' },
  { number: 13, title: 'Cybersecurity Education & Training',     citation: '§7123(c)(13)', questionCount: 1, description: 'Cybersecurity training for all personnel with system access — at onboarding, annually, and after a PI breach.' },
  { number: 14, title: 'Secure Development',                      citation: '§7123(c)(14)', questionCount: 1, description: 'Secure development and coding practices, including code reviews and security testing within the SDLC.' },
  { number: 15, title: 'Service Provider Oversight',             citation: '§7123(c)(15)', questionCount: 1, description: 'Oversight of service providers and third parties per §7051/§7053, including contracts and vendor risk assessments.' },
  { number: 16, title: 'Retention & Disposal',                    citation: '§7123(c)(16)', questionCount: 1, description: 'A documented PI retention schedule and secure disposal of PI no longer required to be retained.' },
  { number: 17, title: 'Incident Response',                       citation: '§7123(c)(17)', questionCount: 2, description: 'A documented incident response plan with predetermined procedures, and tested IR capabilities with documented results.' },
  { number: 18, title: 'Business Continuity & Disaster Recovery', citation: '§7123(c)(18)', questionCount: 1, description: 'Documented, tested BCP/DRP plans with data-recovery capabilities, backups, and defined RTO/RPO targets.' },
  { number: 19, title: 'ADMT Sub-Assessment',                     citation: '§7200–7222',   questionCount: 1, isAdmt: true, description: 'Automated Decision-Making Technology: pre-use notices, opt-out rights, human appeal, and access/explanation obligations.' },
];

/** Total enumerated §7123(c) components (excludes the ADMT sub-assessment). */
export const CORE_COMPONENT_COUNT = 18;
