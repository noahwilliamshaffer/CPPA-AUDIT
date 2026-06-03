# ShieldAudit — Project Prompt (CLAUDE.md)

## What This Is

ShieldAudit is a **commercial CCPA cybersecurity audit SaaS platform** built for California-covered businesses required to complete annual independent audits under Cal. Code Regs. tit. 11, §§ 7120–7124 (effective Jan 1, 2026). It is simultaneously a **capstone project** (MS Cybersecurity Engineering, University of San Diego) and a **real product** that ApexShield LLC will sell.

- **Sole engineer:** Noah Shaffer (noahwilliamshaffer@gmail.com)
- **Product owners:** Erwin Bruno & Bobby Dai (ApexShield LLC)
- **Advisor:** Professor Haydar Majeed (USD)
- **Repo:** https://github.com/noahwilliamshaffer/CPPA-AUDIT
- **Working directory:** `C:\Users\noahw\Desktop\CPPA`
- **Capstone timeline:** May 5 – Aug 7, 2026 (14 weeks)
- **Business model:** $9,500/client direct engagements; $300–$500/assessment white-label reseller

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router (16.2.6), Turbopack |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | Clerk v7 (`@clerk/nextjs`) |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 (Docker container in production, volume-isolated) |
| PDF generation | pdfkit (server-external — see Gotchas) |
| DOCX generation | docx (server-external — see Gotchas) |
| Payments | Stripe (`STRIPE_MODE=mock` in client deployments) |
| File storage | S3/R2 (`STORAGE_MODE=mock` in client deployments) |
| Hosting | Docker via `docker-compose.yml` — fully self-contained |

---

## Product Architecture (Modules)

**Module 1 (Eligibility Screener) has been removed.** Clients are pre-screened for CPPA coverage before being provisioned ShieldAudit. The screener is not needed in-app. Onboarding auto-provisions a `covered=true` eligibility result and a `draft` assessment record for every new org.

The active module flow is:

```
/dashboard  →  /dashboard/assessment  →  /dashboard/scoring  →  /dashboard/reports
               (Module 2)                  (Module 3)              (Module 4)
```

**Sidebar nav:** Audit Assessment | Scoring Dashboard | Report Generator | Settings

**Module unlock gates:**
- Module 2 (Assessment): Always unlocked — eligibility pre-screened at provisioning
- Module 3 (Scoring): Requires assessment status = `scoring`, `complete`, or `locked`
- Module 4 (Reports): Same gate as Module 3
- Settings: Always unlocked

---

## Regulatory Context

| Regulation | Meaning |
|---|---|
| §7120 | Eligibility / coverage determination (handled at provisioning, not in-app) |
| §7122 | Who must conduct the audit; independence requirements |
| §7122(a)(5) | Executive officer certification requirement (Document B) |
| §7123(c) | 18 enumerated audit components — the backbone of the assessment |
| §7123(d) | Written audit report requirement (Document A) |
| §7123(e) | Evidence requirement: auditor observation, NOT management attestation |
| §7001(ddd) | Automated Decision-Making Technology (ADMT) definition |

**Critical facts:**
- 18 §7123(c) components — NOT 17, NOT the count from Deliverable 1 (v2.0 handoff is authoritative)
- Document B signer MUST be the executive directly responsible for cybersecurity-audit compliance per §7122(a)(5) — not just any officer
- 5-year data retention requirement
- Penalties: $2,663 / $5,325 / $7,988 per violation / record / day
- `audit_trail_entries` is **append-only immutable** — DB trigger `prevent_audit_trail_mutation` enforces this

---

## Database Schema

14 tables, all org-scoped. Every query against business data MUST filter by `org_id`.

```
organizations          — multi-tenant root; one row per business or reseller
user_roles             — Clerk user_id → role per org (admin/auditor/business_admin/reseller)
assessments            — one per audit engagement (status: draft→in_progress→scoring→complete→locked)
eligibility_results    — auto-created at onboarding; covered=true, trigger_fired=revenue
questions              — seeded 40-question bank across 18 §7123(c) components
answers                — auditor responses (yes/partial/no/not_applicable); UNIQUE(assessment_id, question_id)
component_applicability— auditor marks each component applicable/not before answering
component_scores       — calculated after M2 complete; Yes=100, Partial=50, No=0; Risk weights Crit=4x/High=3x/Med=2x/Low=1x; Red<50/Yellow 50–79/Green≥80
evidence_items         — files uploaded to Evidence Locker per component
test_logs              — test results per component (Action B)
interview_logs         — interview notes per component (title only — never names)
admt_assessments       — ADMT sub-assessment (when assessment.uses_admt=true)
audit_trail_entries    — IMMUTABLE append-only audit log
reports                — generated Document A (audit_report) and Document B (executive_certification)
```

**Enums of note:**
- `assessment_status`: `draft | in_progress | scoring | complete | locked`
- `answer_response`: `yes | partial | no | not_applicable`
- `component_score_status`: `red | yellow | green`
- `report_type`: `audit_report | executive_certification`
- `user_role`: `admin | auditor | business_admin | reseller`

---

## The 18 §7123(c) Audit Components

Defined in `src/lib/components.ts`. 40 questions total across 18 components.

| # | Title | Questions |
|---|---|---|
| 1 | Cybersecurity Governance | 3 |
| 2 | Risk Assessment | 3 |
| 3 | Asset Management | 2 |
| 4 | Access Controls | 4 |
| 5 | Data Security | 3 |
| 6 | Network Security | 2 |
| 7 | Vulnerability Management | 2 |
| 8 | Incident Response | 3 |
| 9 | Recovery Planning | 2 |
| 10 | Security Awareness & Training | 2 |
| 11 | Third-Party Risk Management | 2 |
| 12 | Physical Security | 2 |
| 13 | Logging & Monitoring | 2 |
| 14 | Application Security | 2 |
| 15 | Change Management | 2 |
| 16 | Data Retention & Disposal | 2 |
| 17 | Privacy Program Integration | 1 |
| 18 | ADMT Security Controls | 1 |

---

## Key API Routes

```
POST /api/onboarding              — creates org + user_role + eligibility + draft assessment
POST /api/assessment/answer       — upserts answer; writes audit trail entry
POST /api/scoring/calculate       — scores all 18 components; advances assessment to 'scoring'
POST /api/reports/generate        — generates Document A or B in PDF or DOCX format
POST /api/stripe/checkout         — mock mode: immediately advances assessment to 'complete'
POST /api/eligibility/result      — (legacy; eligibility now auto-provisioned at onboarding)
```

---

## Docker Deployment

```bash
# Start everything (DB + app)
docker compose up --build

# The entrypoint (docker-entrypoint.sh) on every boot:
# 1. Waits for PostgreSQL
# 2. Runs: drizzle-kit push --force   (idempotent schema sync)
# 3. Runs: node /app/docker/seed.mjs  (seeds 40 questions if questions table is empty)
# 4. Starts: next start

# Backup
docker run --rm -v shieldaudit_cppa_db:/data -v $(pwd):/out \
  alpine tar czf /out/shieldaudit-backup.tar.gz -C /data .

# Wipe all data
docker compose down -v   # WARNING: deletes everything
```

The database is container-internal only — port 5432 is NOT exposed by default.
`STORAGE_MODE=mock` and `STRIPE_MODE=mock` are set in `docker-compose.yml` — no S3 or Stripe keys required for client deployments.

---

## Critical Gotchas & Fixed Bugs

### 1. `answers` table requires `uniqueIndex` (not `index`) on `(assessment_id, question_id)`
The answer upsert uses Drizzle's `onConflictDoUpdate`. PostgreSQL requires a UNIQUE constraint for `ON CONFLICT` to reference. Using `index()` instead of `uniqueIndex()` causes:
```
ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification (42P10)
```
**Fix:** `src/db/schema.ts` uses `uniqueIndex('answers_assessment_question_idx')`. If you ever regenerate the schema, keep this.

### 2. pdfkit / Turbopack `__dirname → /ROOT` rewrite
Turbopack bundles server modules and rewrites `__dirname` to `/ROOT`. pdfkit uses `__dirname` to locate AFM font files at `__dirname/data/Helvetica.afm`. This causes ENOENT at runtime.
**Fix:** `next.config.mjs` has `serverExternalPackages: ['pdfkit', 'docx']` — prevents bundling, preserves real `__dirname`.
**Belt-and-suspenders:** `Dockerfile` has `RUN ln -sfn /app /ROOT` (runs as root before `USER nextjs`).

### 3. `redirect()` must NOT be inside `try/catch`
Next.js `redirect()` throws a special `NEXT_REDIRECT` error internally. If it's inside a `try/catch`, the catch swallows it and the redirect never fires.

### 4. Drizzle's `onConflictDoUpdate` doesn't work with Neon HTTP driver transactions
The Neon HTTP driver doesn't support multi-statement transactions. Two-step inserts (org + user_role) are done as separate awaits, not wrapped in `db.transaction()`. This is documented in `src/app/api/onboarding/route.ts`.

### 5. Windows Node.js 20 OpenSSL race condition
On Windows, parallel build workers hit a race in `InitializeBundledRootCertificates`. `next.config.mjs` caps workers at 4 on Windows (`experimental.cpus: 4`). This is a no-op in Docker/Linux.

### 6. Clerk auth in API routes
Always use `auth()` from `@clerk/nextjs/server` (not the client-side hook) in API routes and server components. The session is available via cookies — no manual token passing needed for same-origin fetches.

---

## Auth & RBAC

- Auth provider: Clerk v7
- All server components call `const { userId } = await auth()` and redirect to `/sign-in` if null
- `user_roles` maps Clerk `user_id` to role within an org
- Roles: `admin` (full access), `auditor` (assessment worker), `business_admin`, `reseller`
- The org context comes from `user_roles.org_id` — there is no Clerk org integration; org membership is tracked in the local DB

---

## Onboarding Flow

`/onboarding` → `OnboardingWizard` → `POST /api/onboarding`

The API handler:
1. Creates `organizations` row
2. Creates `user_roles` row (admin or reseller)
3. Auto-provisions `assessments` row (status=`draft`, current audit year)
4. Auto-provisions `eligibility_results` row (covered=true, trigger_fired=revenue)

After onboarding, the user lands on `/dashboard` which immediately redirects to `/dashboard/assessment`.

---

## Report Generation

Two documents, two formats each (4 files total per assessment):

| Document | Type | Content |
|---|---|---|
| Document A | `audit_report` | Full 18-component audit findings, risk scores, NIST CSF mappings, evidence citations, auditor certification |
| Document B | `executive_certification` | Executive officer certification per §7122(a)(5), 5-point attestation, signature block |

Both available as **PDF** (via pdfkit) and **DOCX** (via docx library).
Generated via `POST /api/reports/generate` with `{ reportType, format }`.
Each generation increments a `version` counter in the `reports` table.
Both formats must be retained for 5 years per §7123.

---

## Development Environment

```bash
# Local dev (not Docker)
npm run dev           # Turbopack dev server at localhost:3000

# Docker (production-equivalent)
docker compose up --build

# DB schema sync (dev)
npx drizzle-kit push

# Seed questions (if running outside Docker)
node docker/seed.mjs
```

**Environment variables needed (`.env.local` for dev, `.env.client` for Docker):**
```
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
# Optional (mocked by default):
STRIPE_MODE=mock
STORAGE_MODE=mock
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Important File Locations

```
src/
  app/
    api/
      onboarding/route.ts          — org creation + auto-provisioning
      assessment/answer/route.ts   — answer upsert (uses onConflictDoUpdate)
      scoring/calculate/route.ts   — 18-component scoring
      reports/generate/route.ts    — Document A + B PDF/DOCX generation
      stripe/checkout/route.ts     — mock payment → assessment status advance
    dashboard/
      layout.tsx                   — module unlock gate logic; Sidebar props
      page.tsx                     — redirects to /dashboard/assessment
      Sidebar.tsx                  — nav (4 items: Assessment, Scoring, Reports, Settings)
      assessment/
        page.tsx                   — 18-component grid with per-component progress
        [component]/page.tsx       — individual component question form
      scoring/
        page.tsx                   — traffic-light score dashboard
        PaymentCTA.tsx             — mock Stripe payment gate
      reports/
        page.tsx                   — Document A + B download UI
    onboarding/
      page.tsx                     — OnboardingWizard (role, org info, revenue tier)
  db/
    index.ts                       — Drizzle client initialization
    schema.ts                      — All 14 tables + enums + relations
  lib/
    components.ts                  — 18 §7123(c) component definitions (authoritative)

docker/
  seed.mjs                         — Idempotent question bank seeder (runs in entrypoint)

docker-entrypoint.sh               — Wait→schema push→seed→start
Dockerfile                         — Multi-stage: deps→builder→runner
docker-compose.yml                 — Self-contained deployment (DB + app + volumes)
next.config.mjs                    — serverExternalPackages, Windows cpus fix
drizzle.config.ts                  — Drizzle ORM config
```

---

## Completed Work (as of May 29, 2026)

All 4 modules are built and verified end-to-end:
- Onboarding → Assessment (40 questions, 18 components) → Scoring (traffic lights) → Reports (PDF + DOCX)
- Docker deployment working with auto schema migration + question seeding
- Eligibility screener (Module 1) removed — clients are pre-screened before provisioning
- Auto-provisioning of eligibility + draft assessment at onboarding
- All critical bugs fixed (uniqueIndex on answers, pdfkit serverExternalPackages, /ROOT symlink)
- Mock payment gate advances assessment to `complete` for client demos

**Remaining phases (from original 7-phase plan):**
- Phase 6: White-label reseller config (per-org branding, `brandConfig` JSONB already in schema)
- Phase 7: QA pass, accessibility audit, E2E tests, README, attorney review gate (Week 13 hard requirement before launch)
