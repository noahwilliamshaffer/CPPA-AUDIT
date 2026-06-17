# ShieldAudit

**CCPA cybersecurity-audit platform** for the independent annual audit required of
California-covered businesses under Cal. Code Regs. tit. 11, **§§ 7120–7124**
(effective Jan 1, 2026). It runs **fully offline in one Docker container** — no
external database, no cloud accounts, no sign-in required.

---

## Run it (one command)

**Prerequisite:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and **running**.

```bash
git clone https://github.com/noahwilliamshaffer/CPPA-AUDIT.git
cd CPPA-AUDIT
```

**Windows (PowerShell):**
```powershell
.\start.ps1
```

**macOS / Linux:**
```bash
./start.sh
```

…or directly with Compose on any OS:
```bash
docker compose up --build
```

Then open **http://localhost:3000**. The first build takes a few minutes; on boot
the container creates the database schema and seeds the 48-question §7123(c)
bank automatically. It runs in **mock mode** out of the box — no API keys needed.

Stop with `docker compose down` (keeps data) or `docker compose down -v` (wipes data).

---

## What's inside

The audit flow is **Onboarding → Assessment → Scoring → Reports**, plus evidence,
an audit trail, remediation tickets, integrations, and white-label branding.

- **Assessment** — 48 questions across the 18 §7123(c) components + the ADMT
  sub-assessment, with conditional branching and per-answer notes.
- **AI document autofill** — upload security documents; Claude drafts a NIST
  800-53 summary and per-question suggestions for the auditor to accept or
  override. Mock by default; set `ANTHROPIC_API_KEY` for real analysis.
- **Scoring** — risk-weighted traffic-light scores per component
  (Yes 100 / Partial 50 / No 0; Critical 4× → Low 1×; Green ≥80 / Yellow 50–79 / Red <50).
- **Reports** — Document A (Audit Report, §7123(d)) and Document B (Executive
  Certification, §7122(a)(5)) as PDF **and** DOCX, plus an AI-drafted System
  Security Plan.
- **Evidence Locker** — per-component §7123(e) auditor-observed evidence upload,
  stored on the data volume; uploads and removals recorded in the audit trail.
- **Audit Trail** — immutable, append-only log (DB-trigger enforced) with
  CSV/JSON export.
- **Remediation Tickets** — generated from gaps; export CSV / JSON / Markdown.
- **Integrations** — push to **Jira**, publish to **Confluence / Notion**, upload
  to **S3 / S3-compatible** (R2, MinIO, Wasabi), notify **Slack / Teams /
  webhook**. Plus connector *scaffolds* (Okta, Entra, AWS, Tenable, Qualys,
  CrowdStrike, Intune, Vanta, Drata, Secureframe, OneTrust, DocuSign, Adobe Sign)
  with live connectivity tests. Credentials are AES-256-GCM encrypted at rest.
- **White-label branding** — per-org firm name, accent color, logo, and report
  footer applied to the app shell and the Document A/B PDFs.

---

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Drizzle ORM ·
**better-sqlite3** (offline SQLite) · pdfkit / docx · `@anthropic-ai/sdk` ·
Docker. Tests run on Vitest.

The database and any uploaded evidence live in the `shieldaudit_data` Docker
volume on your machine — data never leaves it.

---

## Configuration (all optional)

The app runs with no configuration. To enable real services, create a `.env`
next to `docker-compose.yml` (see [`.env.example`](.env.example)) — e.g.
`ANTHROPIC_API_KEY` for AI autofill, or `JIRA_*` / `CONFLUENCE_*` / `S3_*` for
integrations. Credentials can also be entered in-app under **Integrations →
Credentials** and **Settings → White-Label Branding** (encrypted at rest).

---

## Local development (without Docker)

```bash
npm install
npm run setup     # create the SQLite DB + seed the question bank
npm run dev       # http://localhost:3000
npm test          # Vitest unit suite
```

> On Windows, `next build` can intermittently crash in Turbopack; verify with
> `npx tsc --noEmit` and the Docker build (Linux), which are unaffected.

See [QUICKSTART.md](QUICKSTART.md) for backup/restore and more detail.

---

## Regulatory context

| Citation | Scope |
|---|---|
| §7120 | Coverage determination (handled at provisioning) |
| §7122(a)(5) | Executive officer certification (Document B) |
| §7123(c) | The 18 enumerated audit components |
| §7123(d) | Written audit report (Document A) |
| §7123(e) | Evidence: auditor observation, not management attestation |

Both reports must be retained for **5 years** per §7123.

---

## License

Proprietary — ApexShield LLC. All rights reserved.
