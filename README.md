# ShieldAudit

**CPPA Cybersecurity Audit SaaS Platform**  
California Privacy Protection Agency — Cal. Code Regs. tit. 11, §§7120–7124

Built by **ApexShield LLC** for businesses subject to California's mandatory cybersecurity audit requirement.

---

## What it does

ShieldAudit guides covered businesses through the four-module CPPA audit workflow:

| Module | Name | Description |
|--------|------|-------------|
| 1 | Eligibility Screener | §7120 OR-logic coverage determination |
| 2 | Audit Assessment | 18-component question-answer interface (§7123(c)) |
| 3 | Scoring Dashboard | Risk-weighted composite scores + traffic-light grid |
| 4 | Report Generator | Document A (Audit Report) + Document B (Executive Certification) |

Public-facing `/qualify` wizard handles lead qualification without authentication.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Auth | Clerk v7 |
| Database | Neon serverless PostgreSQL (HTTP driver) |
| ORM | Drizzle ORM |
| Payments | Stripe Checkout |
| Documents | `docx` package (DOCX generation) |
| Styling | Tailwind CSS 3 |
| Validation | Zod v4 |
| Forms | React Hook Form |

---

## Prerequisites

- **Node.js 20** (LTS)
- **npm 10+**
- A [Neon](https://neon.tech) PostgreSQL database (free tier works)
- A [Clerk](https://clerk.com) application
- (Optional) A [Stripe](https://stripe.com) account for live payments

> **Windows note:** A race condition in Windows Node.js 20's bundled OpenSSL causes intermittent build failures when many workers run concurrently. `next.config.mjs` limits workers to 4 on Windows to mitigate this. If you still see `InitializeBundledRootCertificates` assertion failures, run `npm run build` again. The issue does not occur in Docker (Linux).

---

## Local development setup

### 1. Clone and install

```bash
git clone https://github.com/noahwilliamshaffer/CPPA-AUDIT
cd CPPA-AUDIT
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

| Variable | Where to get it |
|----------|-----------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `DATABASE_URL` | Neon Console → Connection string |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks (or `stripe listen` output) |
| `STRIPE_PRICE_ID_ASSESSMENT` | Stripe Dashboard → Products |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |

Set feature flags:

```bash
STORAGE_MODE=mock   # skips S3 uploads — files download directly
STRIPE_MODE=mock    # skips Stripe — payment advances automatically
```

In `mock` mode you can complete the full workflow without real Stripe or S3 credentials.

### 3. Push the database schema

```bash
npm run db:push
```

This syncs the Drizzle schema to your Neon database (creates all 14 tables).

### 4. Seed the question bank

```bash
npx tsx src/db/seeds/questions.ts
```

This inserts the 40+ audit questions across all 18 §7123(c) components.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Complete onboarding

1. Create a Clerk account and sign in
2. Complete the onboarding wizard (org name, revenue tier, contact)
3. The dashboard unlocks at `/dashboard`

---

## Environment variable reference

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Database
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Stripe (leave blank or use STRIPE_MODE=mock to skip)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_ASSESSMENT=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Feature flags
STORAGE_MODE=mock   # or: live (requires S3/R2 config)
STRIPE_MODE=mock    # or: live (requires Stripe keys above)
```

---

## Docker (local container)

Run the entire app in Docker while connecting to your Neon cloud database. No local PostgreSQL container needed.

### Setup

```bash
# 1. Copy the env template
cp .env.docker.example .env.docker

# 2. Fill in your credentials (Neon DATABASE_URL + Clerk keys)
nano .env.docker  # or open in your editor

# 3. Build and start
npm run docker:up
```

Open [http://localhost:3000](http://localhost:3000).

### Docker commands

| Command | What it does |
|---------|-------------|
| `npm run docker:up` | Build image and start container |
| `npm run docker:down` | Stop and remove container |
| `npm run docker:reset` | Stop, delete volumes, rebuild, start |

### Architecture note

The Docker container runs the Next.js app and connects to **Neon** (your cloud PostgreSQL instance). There is no local `postgres` container because the `pg` (node-postgres) native module causes an OpenSSL assertion crash on Windows Node.js 20. The Neon HTTP driver (`@neondatabase/serverless`) does not have this limitation.

For a fully offline/air-gapped deployment, switch `src/db/index.ts` to `drizzle-orm/node-postgres` + a local PostgreSQL container, and build on Linux (CI/CD).

---

## Module progression

The dashboard enforces **linear module completion**:

```
Module 1 (Eligibility) → Module 2 (Assessment) → Module 3 (Scoring) → Module 4 (Reports)
```

Each module unlocks only when the previous is complete:

| Gate | Condition |
|------|-----------|
| Module 2 unlock | `eligibility_results.covered = true` |
| Module 3 unlock | `assessments.status IN ('scoring', 'complete', 'locked')` |
| Module 4 unlock | Same gate as Module 3 |
| Document generation | `assessments.status = 'complete'` |

---

## Stripe payment flow

```
User completes scoring (status: 'scoring')
  → POST /api/stripe/checkout
  → STRIPE_MODE=mock: status → 'complete' immediately
  → STRIPE_MODE=live:  creates Stripe Checkout session, status → 'locked'
  → Stripe fires checkout.session.completed webhook
  → POST /api/stripe/webhook: status → 'complete'
  → Reports unlock, documents available
```

### Testing Stripe locally

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
```

---

## Scoring algorithm

Each question receives points based on the auditor's response:

| Response | Points |
|----------|--------|
| Yes | 100 |
| Partial | 50 |
| No | 0 |
| N/A | Excluded from denominator |

Risk weight multipliers:

| Weight | Multiplier |
|--------|-----------|
| Critical | 4× |
| High | 3× |
| Medium | 2× |
| Low | 1× |

**Component score** = `(Σ weighted points) / (Σ max weighted points) × 100`

Traffic-light classification:

| Band | Color |
|------|-------|
| ≥ 80 | Green |
| 50–79 | Yellow |
| < 50 | Red |

---

## Document generation

When an assessment reaches `complete` status, two CPPA submission documents are available at `/dashboard/reports`:

| Document | Regulation | Format |
|----------|-----------|--------|
| Document A — Cybersecurity Audit Report | §7123(d) | DOCX |
| Document B — Executive Officer Certification | §7122(a)(5) | DOCX |

In `STORAGE_MODE=mock`, documents are generated in memory and downloaded directly to the browser. In production, documents would be uploaded to S3/R2 and a presigned URL returned.

Both documents must be retained for **5 years** per Cal. Code Regs. tit. 11, §7123.

---

## Database schema (14 tables)

| Table | Description |
|-------|-------------|
| `organizations` | Multi-tenant root; one row per covered business |
| `user_roles` | RBAC: maps Clerk user IDs to roles per org |
| `assessments` | One per audit engagement; tracks status through workflow |
| `eligibility_results` | §7120 screener output: covered/not_covered |
| `component_applicability` | Auditor marks each of 18 components as applicable |
| `questions` | Seeded question bank (40+ questions, 18 components) |
| `answers` | Auditor responses: yes/partial/no/N/A per question |
| `evidence_items` | File evidence per component (S3/R2 or mock) |
| `test_logs` | Technical test records per component |
| `interview_logs` | Personnel interview notes (title only, no names) |
| `audit_trail_entries` | Immutable append-only audit trail |
| `component_scores` | Cached weighted scores per component |
| `admt_assessments` | ADMT sub-assessment (§7001(ddd)) |
| `reports` | Generated document records with version tracking |

All tables include `org_id` for row-level multi-tenant isolation.

---

## Architecture decisions

**Neon HTTP driver instead of `pg`:** The `pg` (node-postgres) package includes a native OpenSSL extension that causes an assertion failure (`InitializeBundledRootCertificates`) on Windows Node.js 20. ShieldAudit uses `@neondatabase/serverless` with the HTTP transport, which is pure JavaScript and unaffected.

**Clerk v7 auth:** Uses `clerkMiddleware` + `createRouteMatcher` in `src/proxy.ts`. The `/qualify` public funnel and `/api/stripe/webhook` route are explicitly excluded from auth.

**Immutable audit trail:** The `audit_trail_entries` table is append-only. A PostgreSQL trigger (`prevent_audit_trail_mutation`) prevents UPDATE and DELETE at the database level.

**Document generation:** DOCX files are generated server-side using the `docx` npm package. The generator is dynamically imported inside the API route handler (not at module initialization time) to avoid the Windows OpenSSL race condition during Next.js builds.

**Worker limit on Windows:** `next.config.mjs` caps concurrent build workers at 4 on Windows via `experimental.cpus` to prevent the OpenSSL multi-process race condition.

---

## Regulatory context

| Regulation | Scope |
|-----------|-------|
| Cal. Code Regs. tit. 11, §7120 | Applicability thresholds (revenue / consumer volume) |
| Cal. Code Regs. tit. 11, §7121 | General audit requirements |
| Cal. Code Regs. tit. 11, §7122 | Auditor independence and qualifications |
| Cal. Code Regs. tit. 11, §7123 | Audit scope: 18 components + evidence requirements |
| Cal. Code Regs. tit. 11, §7124 | Submission and timing requirements |
| Cal. Civ. Code §1798.81.5 | Personal information security requirements |

---

## Scripts

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint

npm run db:push      # Push Drizzle schema to Neon
npm run db:studio    # Open Drizzle Studio (visual DB browser)

npm run docker:up    # Build Docker image and start container
npm run docker:down  # Stop container
npm run docker:reset # Full reset (delete volumes, rebuild)
```

---

## License

Proprietary — ApexShield LLC. All rights reserved.

---

*ShieldAudit is built on the Anthropic Claude AI platform.*
