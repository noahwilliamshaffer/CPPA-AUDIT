/**
 * §7123(c) audit component definitions — 18 components, authoritative order.
 * Used across the assessment module for rendering, routing, and scoring.
 */

export interface AuditComponent {
  number: number;
  title: string;
  description: string;
  questionCount: number;
}

export const AUDIT_COMPONENTS: AuditComponent[] = [
  { number: 1,  title: 'Cybersecurity Governance',         description: 'Formal cybersecurity policies, executive accountability, and defined roles and responsibilities.',          questionCount: 3 },
  { number: 2,  title: 'Risk Assessment',                  description: 'Formal risk assessment processes, risk registers, and consideration of threats to personal information.',     questionCount: 3 },
  { number: 3,  title: 'Asset Management',                 description: 'Hardware/software inventory and documented data flows for personal information.',                             questionCount: 2 },
  { number: 4,  title: 'Access Controls',                  description: 'Least privilege, MFA, periodic access reviews, and privileged account management.',                          questionCount: 4 },
  { number: 5,  title: 'Data Security',                    description: 'Encryption at rest and in transit, data classification for personal information.',                            questionCount: 3 },
  { number: 6,  title: 'Network Security',                 description: 'Network segmentation, firewalls, and intrusion detection for systems holding personal information.',          questionCount: 2 },
  { number: 7,  title: 'Vulnerability Management',         description: 'Regular vulnerability scanning and timely patching of systems that process personal information.',            questionCount: 2 },
  { number: 8,  title: 'Incident Response',                description: 'Documented incident response plan, annual testing, and defined escalation and notification paths.',           questionCount: 3 },
  { number: 9,  title: 'Recovery Planning',                description: 'Business continuity and disaster recovery plans, and backup testing for personal information systems.',       questionCount: 2 },
  { number: 10, title: 'Security Awareness & Training',    description: 'Annual employee cybersecurity training and phishing simulation exercises.',                                    questionCount: 2 },
  { number: 11, title: 'Third-Party Risk Management',      description: 'Vendor cybersecurity assessments and data processing agreements for all third-party data recipients.',        questionCount: 2 },
  { number: 12, title: 'Physical Security',                description: 'Physical access controls for data facilities and secure disposal of physical media.',                         questionCount: 2 },
  { number: 13, title: 'Logging & Monitoring',             description: 'Security event logging with 12-month retention and regular anomaly review.',                                  questionCount: 2 },
  { number: 14, title: 'Application Security',             description: 'Secure SDLC practices and annual OWASP Top 10 testing for web-facing applications.',                         questionCount: 2 },
  { number: 15, title: 'Change Management',                description: 'Formal change process with security review and CIS/DISA benchmark hardening.',                               questionCount: 2 },
  { number: 16, title: 'Data Retention & Disposal',        description: 'Retention policies with defined periods and secure deletion upon expiry.',                                    questionCount: 2 },
  { number: 17, title: 'Privacy Program Integration',      description: 'Privacy-by-design principles in new product and system development.',                                         questionCount: 1 },
  { number: 18, title: 'ADMT Security Controls',          description: 'Bias testing and fairness assessments for automated decision-making technology per §7001(ddd).',             questionCount: 1 },
];
