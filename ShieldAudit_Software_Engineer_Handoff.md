# SOFTWARE ENGINEER HANDOFF — ShieldAudit (v2.0)
**Project:** ShieldAudit — CCPA Cybersecurity Audit Platform  
**Client:** ApexShield LLC, San Diego CA  
**Prepared by:** Erwin Bruno, Managing Member  
**Date:** May 2026  
**Status:** Pre-development. No code written yet. This document supersedes v1.0.

---

## 1. WHAT THIS PLATFORM IS (AND IS NOT)

ShieldAudit is a **workflow and decision-support engine** for performing CPPA-required cybersecurity audits. It is not a cloud scanner, continuous monitoring tool, or automated compliance checker.

The platform supports an Auditor (internal or external) in conducting an independent review per Cal. Code Regs. tit. 11, §§ 7120-7124. The auditor drives every phase: reviewing documents, conducting tests, recording interviews, and certifying findings. The platform structures, records, and formats that work into the two legally required output documents.

---

## 2. LEGAL AND REGULATORY GROUNDING

| Item | Detail |
|------|--------|
| Law | California Consumer Privacy Act (CCPA) as amended by CPRA |
| Regulation | Cal. Code Regs. tit. 11, §§ 7120-7124 |
| Enforcement agency | California Privacy Protection Agency (CPPA) |
| Rulemaking status | Final. Adopted July 24, 2025. Approved by OAL September 22, 2025. Filed with Secretary of State September 22, 2025. |
| Effective date | January 1, 2026 |
| Penalties | $2,663 to $7,988 per violation, per consumer record, per day |
| Accepted frameworks | NIST CSF 2.0, CIS Controls v8.1 (satisfy §7123(f) if all requirements are met) |
| Document retention | 5 years minimum (§7123) |

**Submission deadlines (phased by revenue):**

| Revenue Tier | First Audit Period | Certification Due |
|---|---|---|
| Over $100M (2026 revenue) | Jan 1, 2027 to Dec 31, 2027 | April 1, 2028 |
| $50M to $100M (2027 revenue) | Jan 1, 2028 to Dec 31, 2028 | April 1, 2029 |
| Under $50M (2028 revenue) | Jan 1, 2029 to Dec 31, 2029 | April 1, 2030 |

Compliance program obligations begin January 1, 2026. First certifiable audit periods begin 2027 for the largest tier.

---

## 3. ELIGIBILITY LOGIC (§7120)

A business is subject to the cybersecurity audit requirement if it meets the general CCPA threshold AND its data processing presents "significant risk." The platform must screen for all four triggers with OR logic across data triggers:

**General CCPA threshold (must meet):**
- For-profit business that determines the purposes and means of processing California consumers' personal information

**Significant-risk triggers (OR logic, must meet at least one):**

| Trigger | Threshold |
|---|---|
| Revenue from data | Derives 50%+ of annual revenue from selling or sharing personal information |
| Consumer data volume | Processes personal information of 250,000+ California consumers or households per year |
| Sensitive data volume | Processes sensitive personal information of 50,000+ California consumers per year |

**Sensitive personal information includes (verified, non-exhaustive):** SSNs, financial account data, precise geolocation, health data, biometrics, racial/ethnic origin, religious beliefs, union membership, citizenship/immigration status, sex life/sexual orientation data, children's personal information, neural data (added January 1, 2025).

**Geographic scope:** Any for-profit business, regardless of where headquartered, that processes California residents' personal information.

**Screener questions (5 total):**
1. Annual gross revenue (ranges: under $26.6M / $26.6M-$50M / $50M-$100M / over $100M)
2. California consumers' PI processed per year (ranges: under 50K / 50K-250K / over 250K)
3. California consumers' sensitive PI processed per year (ranges: under 10K / 10K-50K / over 50K)
4. Percentage of revenue from selling/sharing PI (ranges: 0% / under 25% / 25-50% / over 50%)
5. Does the business process personal information of California residents? (yes/no)

Output: Covered / Not Covered, specific trigger cited, submission deadline calculated from revenue tier.

---

## 4. THE 18 AUDIT COMPONENTS (§7123(c)) — VERIFIED FROM FINAL APPROVED REGULATION TEXT

These are the exact components auditors must assess "if applicable to the business's information system." The auditor determines applicability; the platform must surface all 18 and require the auditor to mark each as Applicable or Not Applicable before proceeding.

| # | Component (§7123(c)) | Platform Assessment Focus |
|---|---|---|
| 1 | Authentication | MFA enforcement, password/passphrase controls (applies only if business uses passwords/passphrases per §7123(c)(1)(B)), account lockout, session management |
| 2 | Encryption of personal information, at rest and in transit | Encryption standards for stored PI and data-in-transit; key management |
| 3 | Account management and access controls | RBAC, least privilege, access provisioning/deprovisioning, privileged access |
| 4 | Inventory and management of personal information and the business's information system | Asset inventory completeness, PI data flows documented, system classification |
| 5 | Secure configuration of hardware and software | Hardening standards, baseline configs, patch levels on endpoints and servers |
| 6 | Internal and external vulnerability scans, penetration testing, and vulnerability disclosure/reporting (bug bounty, ethical hacking) | Scan cadence, scope, remediation SLAs, CVSS prioritization, responsible disclosure program |
| 7 | Audit-log management, including centralized storage, retention and monitoring of logs | Log sources, SIEM or centralized collection, retention period, review frequency |
| 8 | Network monitoring and defenses | Firewall rules, IDS/IPS, bot-detection, intrusion-prevention, anomaly detection |
| 9 | Antivirus and anti-malware protections | Coverage across endpoints, update cadence, alert response |
| 10 | Segmentation of an information system | Network segmentation design, isolation of PI-processing systems, micro-segmentation |
| 11 | Limitation and control of ports, services and protocols | Open port inventory, unused service shutdown, protocol allowlisting |
| 12 | Cybersecurity awareness, including how the business maintains current knowledge of changing threats and countermeasures | Threat intelligence feeds, awareness program, communication to personnel |
| 13 | Cybersecurity education and training (training at onboarding, annually, and after a breach) | Training cadence, scope (employees, contractors, all personnel with system access), phishing simulation |
| 14 | Secure development and coding best practices, including code reviews and testing | SDLC security gates, SAST/DAST, code review process, dependency scanning |
| 15 | Oversight of service providers, contractors and third parties | Third-party risk assessments, DPAs in place, vendor access controls, annual review |
| 16 | Retention schedules and proper disposal of personal information (shredding, erasing, or rendering unreadable) | Retention schedule documented, secure deletion procedures, media disposal logs |
| 17 | How the business manages its responses to security incidents | IR plan existence, tabletop exercises, breach notification workflow, 45-day clock for 500+ residents (CA-specific) |
| 18 | Business-continuity and disaster-recovery plans, including data-recovery capabilities and backups | BCP/DRP documented, tested, backup frequency and integrity, RTO/RPO defined |

**Note on component count:** The regulation enumerates 18 components at §7123(c). All prior ShieldAudit documents correctly identified 18. This table reflects the final approved text as confirmed by law firm analyses of the September 22, 2025 approved regulations.

---

## 5. PLATFORM ARCHITECTURE — FIVE MODULES

### Module 1: Eligibility Screener
5 questions. OR logic across data triggers. Binary output: Covered / Not Covered with specific trigger cited and deadline calculated. Non-covered businesses exit gracefully with a recommendation to reassess annually.

### Module 2: Auditor Workspace (Assessment Engine)

This is the core of the platform. It is not a simple question form. It is an **adaptive assessment engine** built around the CPPA's three mandated auditor actions:

**Action A: Document Review (Evidence Locker)**
Each component has an evidence collection interface. Auditor uploads documents, links to external sources, or logs that evidence was reviewed in person. Every uploaded document is linked to the specific component and the specific question it supports. The Evidence Locker is encrypted at rest; each file is tagged with component number, question ID, upload timestamp, and auditor ID.

**Action B: Testing Log**
For each applicable component, the auditor can log test results: test name, test methodology, pass/fail/partial result, date conducted, and findings. Tests are distinct from document review. The platform enforces that at least one test log entry exists before a component can be certified (configurable per component).

**Action C: Interview Log**
For each applicable component, the auditor can record interview notes: interviewee title (never name, for privacy), date, topics discussed, and relevant findings. Interview logs feed directly into the audit report.

**Adaptive questioning:** The 40-question bank is not a static list. Answer logic determines what follow-up questions surface. Example: If the auditor answers "Yes" to "Does the business use passwords or passphrases?" then the password-specific sub-questions under Component 1 appear. If "No," those sub-questions are hidden. This branching logic applies across all 18 components.

**Question answer options:** Yes / Partial / No / Not Applicable  
**Each question has:** Evidence field (links to Evidence Locker items), Auditor notes field, Risk weight (Critical / High / Medium / Low)

**ADMT Logic Tree (separate sub-module):** For any business that uses Automated Decisionmaking Technology to make significant decisions (as defined at §7001(ddd)), the platform surfaces an ADMT sub-assessment within the audit workflow. This documents:
- Whether ADMT is used to make significant decisions (financial services, housing, education, employment, healthcare — not advertising)
- AI bias prevention measures
- Opt-out workflow for consumers
- Human review override capability
- Whether the ADMT substantially replaces human decisionmaking (the regulatory threshold per §7001(e))

**Auditor independence enforcement (RBAC):**

| Role | Permissions |
|---|---|
| Business Admin / CISO | Read-only on assessment findings and scoring. Can upload evidence when requested. Cannot modify auditor findings, notes, or certifications. |
| Independent Auditor | Read-write on all findings, notes, test logs, interview logs, and certifications. Read-only on business settings, org profile, and prior-period data to prevent retroactive manipulation. |
| ShieldAudit LLC Consultant (Erwin / ApexShield) | Full admin. Creates workspaces, assigns roles, runs all modules, generates output. |
| Reseller | Same as ShieldAudit Consultant within their own tenant workspace. |

Internal auditors must be configured to report to a member of executive management who does not have direct cybersecurity responsibility (per §7122(a)(3)). The platform must capture and display this reporting structure.

**Immutable audit trail:** Every auditor certification of a control is permanently logged with: timestamp, auditor user ID, component number, question ID, response recorded, evidence file IDs linked, and IP address. This log cannot be edited or deleted by any user role. It is the integrity backbone of the platform.

### Module 3: Scoring Dashboard

Outputs after Module 2 is complete:

- Per-component score (0-100, traffic light: red under 50 / yellow 50-79 / green 80+)
- Overall program readiness score (0-100, weighted)
- Penalty exposure estimate: (consumer record count) x ($5,325 midpoint) x (estimated exposure days)
- Deadline countdown: days until submission deadline from revenue tier
- Top 5 critical gaps ranked by risk weight
- NIST CSF 2.0 function alignment map (Govern, Identify, Protect, Detect, Respond, Recover)
- CIS Controls v8.1 group alignment

### Module 4: Report Generator

One button. Produces two documents automatically from Module 2 data.

**Document A: Cybersecurity Audit Report (§7123)**

Required elements (all must be present):
1. Description of the business's information system
2. Identification of policies, procedures, and practices assessed
3. Assessment of each applicable component with specific evidence examined (not management attestations)
4. Identification of gaps and weaknesses that increase risk of unauthorized access, use, modification, destruction, or disclosure of PI, or loss of availability
5. Status of any gaps/weaknesses from prior audit (if second or subsequent audit)
6. Remediation plan with specific timelines for each gap
7. Titles (not names) of up to three individuals responsible for the cybersecurity program
8. Auditor name, qualifications, and signed independence certification (highest-ranking auditor only, per §7123(e)(8))
9. Samples of breach notifications issued during the audit period (if applicable, California notifications only per §7123(e)(10))
10. ADMT findings section (if ADMT sub-assessment was triggered)

The report must be based on specific evidence reviewed by the auditor, not on management assertions. This is a hard regulatory requirement (§7123(e)).

**Document B: Executive Certification (§7124)**

Required elements (all must be present):
1. Business name and point of contact with contact information
2. Statement that the business has completed the cybersecurity audit
3. Time period covered by the audit (by month and year)
4. Attestation that the person completing the certification: (a) is directly responsible for the business's cybersecurity-audit compliance, (b) has sufficient knowledge of the audit to provide accurate information, and (c) has authority to submit the certification
5. Certification under penalty of perjury that the information submitted is true and correct and that the business has not made any attempt to influence the auditor's decisions or assessments
6. Name and business title of the person submitting the certification
7. Date of the certification
8. Submission to cppa.ca.gov

**CORRECTION NOTE:** Earlier versions of this document stated the §7124 signer must be the "highest-ranking executive NOT directly responsible for cybersecurity." This was incorrect. The final approved regulation (§7124(c)) requires the signer to be a member of executive management who IS directly responsible for the business's cybersecurity-audit compliance, has sufficient knowledge of the audit, and has the authority to submit. This is the opposite of the original draft and must be reflected exactly in Document B's signature block and instructions.

Both documents export as PDF (Puppeteer, server-side) and DOCX (docx.js). White-label branding applied to both.

### Module 5: White-Label Reseller Configuration

Reseller registers, uploads logo, sets firm name and contact. All output documents are branded under reseller firm name. Subdomain routing: firm.shieldaudit.com or custom domain. Per-assessment Stripe billing locks the assessment until payment is confirmed.

---

## 6. TECH STACK

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript | Component reuse, strong typing for compliance-sensitive data |
| Styling | Tailwind CSS | Fast, consistent |
| Backend | Next.js API routes | Unified stack, SSR for report generation |
| Database | PostgreSQL | Relational schema suits component/question/answer/evidence model |
| Auth | Clerk or Auth0 | Multi-tenant, white-label workspace isolation |
| PDF generation | Puppeteer (server-side) | Precise, reliable output for legal documents |
| DOCX generation | docx.js | Word export for attorney review and client delivery |
| Payments | Stripe | Per-assessment billing |
| Hosting | Vercel + Railway | Low ops overhead for MVP |
| File storage | AWS S3 or Cloudflare R2 | 5-year retention requirement |

---

## 7. DATA MODEL (CONCEPTUAL)

```
Organization
  id, name, legal_entity, revenue_tier, consumer_record_count,
  contact_email, brand_config, internal_auditor_reporting_structure

Assessment
  id, org_id, audit_period_start, audit_period_end, status,
  created_at, completed_at, auditor_id, uses_admt (bool)

EligibilityResult
  id, assessment_id, trigger_fired (revenue/volume/sensitive/data_sales),
  covered (bool), submission_deadline

ComponentApplicability
  id, assessment_id, component_number (1-18), applicable (bool), auditor_id

Question
  id, component_number, question_text, risk_weight, nist_csf_mapping,
  cis_control_mapping, parent_question_id (for branching), trigger_condition

Answer
  id, assessment_id, question_id, response (yes/partial/no/na),
  auditor_notes, timestamp, auditor_id

EvidenceItem
  id, assessment_id, component_number, question_id, file_url, file_name,
  file_type, uploaded_at, uploaded_by, description

TestLog
  id, assessment_id, component_number, test_name, methodology,
  result (pass/fail/partial), conducted_at, findings, auditor_id

InterviewLog
  id, assessment_id, component_number, interviewee_title, interview_date,
  topics, findings, auditor_id

AuditTrailEntry
  id, assessment_id, component_number, question_id, auditor_id, action,
  prior_value, new_value, evidence_ids, timestamp, ip_address
  [IMMUTABLE — no UPDATE or DELETE permitted on this table]

ComponentScore
  id, assessment_id, component_number (1-18), score (0-100),
  status (red/yellow/green)

ADMTAssessment
  id, assessment_id, uses_admt_for_significant_decisions (bool),
  significant_decision_types, bias_controls, opt_out_workflow,
  human_review_override, substantially_replaces_human (bool), notes

Report
  id, assessment_id, generated_at, pdf_url, docx_url,
  report_type (audit/certification), version
```

---

## 8. OPEN QUESTIONS FOR ENGINEER

1. SPA vs. Next.js? Preference is Next.js for easier API routes and report generation server-side.
2. PDF generation: React-PDF (in-browser) vs. Puppeteer (server-side)? Server-side strongly preferred for legal document fidelity.
3. Multi-tenant: shared DB with org_id isolation, or separate schema per tenant?
4. White-label: subdomain routing (firm.shieldaudit.com) or custom domain support (audit.lawfirm.com)?
5. Stripe billing: charge per completed assessment or per started assessment? Current preference: completed.
6. Immutable audit trail: enforce at DB level (triggers, append-only table), application level, or both?
7. Evidence file storage: how to handle large uploads within the 5-year retention window without cost explosion on S3/R2?
8. ADMT logic tree: graph-based branching structure or decision-table approach? Recommend graph-based for extensibility.

---

## 9. MVP SCOPE (PHASE 1) — BUILD ONLY THIS

- User auth (admin, auditor, reseller roles with strict RBAC)
- Eligibility screener (5 questions, binary output)
- Assessment engine (40 questions, 18 components, adaptive branching)
- Evidence Locker (per-component, per-question file uploads with audit trail)
- Test log and interview log modules
- Immutable audit trail (append-only, no edit/delete)
- ADMT logic tree (branching sub-assessment for AI/significant decisions)
- Scoring dashboard (per-component traffic lights, overall score, penalty estimate)
- Report generator (Document A and Document B, PDF and DOCX)
- White-label config (logo, firm name, contact, subdomain routing)
- Per-assessment Stripe billing

**Not in Phase 1:**
- Self-serve client portal
- Automated evidence ingestion from third-party tools
- Continuous monitoring
- Multi-year audit history tracking
- Public API
- Mobile app

---

## 10. COMPLIANCE REQUIREMENTS FOR THE PLATFORM ITSELF

- Assessment data encrypted at rest
- Audit reports retained minimum 5 years (§7123)
- Strict multi-tenant data isolation between organizations
- Access logs maintained for the platform itself
- Data Processing Agreement (DPA) required with every reseller before workspace creation
- Platform privacy policy must disclose data collected and retention period
- California privacy attorney to review DPA and ToS before launch

---

## 11. KEY MILESTONES

| Milestone | Target |
|---|---|
| Engineer onboarded, repo created | Week 1 |
| Eligibility screener functional | Week 2 |
| Assessment engine with adaptive branching | Week 5 |
| Evidence Locker + test/interview logs | Week 6 |
| Scoring dashboard | Week 8 |
| Document A and B PDF generation | Week 10 |
| White-label config and branding on reports | Week 11 |
| Stripe billing integration | Week 12 |
| Attorney review + pilot reseller onboarding | Week 13 |
| Beta launch (3 pilot resellers) | Week 14 |

---

## 12. CONTACT

**Erwin Bruno**  
Managing Member, ApexShield LLC  
erwin.v.bruno@gmail.com  
619-394-0650  
linkedin.com/in/erwinvonbruno

All questions go to Erwin directly. Do not contact any client, reseller, or third party independently.

---

*Document v2.0 — May 2026 — ApexShield LLC — Confidential — Supersedes v1.0*
