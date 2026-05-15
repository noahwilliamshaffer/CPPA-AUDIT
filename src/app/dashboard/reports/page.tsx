/**
 * Module 4: Report Generator — /dashboard/reports
 *
 * Server component. Generates the two CPPA submission documents:
 * - Document A: Full Cybersecurity Audit Report (audit_report)
 * - Document B: Executive Certification (executive_certification)
 *
 * Both documents must be retained for a minimum of 5 years per §7123.
 *
 * Access gate: Shares Module 3's gate — unlocked when assessment status is
 * 'scoring', 'complete', or 'locked'. Actual PDF/DOCX generation requires
 * 'complete' status (payment cleared), but the page loads to explain this
 * when the assessment is 'locked' (payment pending).
 *
 * Regulatory context:
 * - Document A: §7123(d) — written audit report prepared by auditor
 * - Document B: §7122(a)(5) — executive officer certification
 * - Submission deadline: determined by revenue tier and audit period end date
 *
 * Phase 5 note: Actual PDF/DOCX generation (puppeteer + docx package) ships
 * in Phase 5. This page shows the locked or preview state for Phase 1.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import {
  FileText,
  Lock,
  ChevronRight,
  Info,
  Download,
  FileCheck2,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Check Module 4 unlock status
// ---------------------------------------------------------------------------

async function checkModule4Unlocked(clerkUserId: string): Promise<{
  unlocked: boolean;
  assessmentStatus: string | null;
  existingReports: Array<{ type: string; generatedAt: string; version: number }>;
}> {
  const { db } = await import('@/db');
  const { userRoles, assessments, reports } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, clerkUserId))
    .limit(1);

  if (roleRows.length === 0) {
    return { unlocked: false, assessmentStatus: null, existingReports: [] };
  }

  const orgId = roleRows[0].orgId;

  const assessmentRows = await db
    .select({ id: assessments.id, status: assessments.status })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);

  const status = assessmentRows[0]?.status ?? null;
  const assessmentId = assessmentRows[0]?.id ?? null;

  // Module 4 shares the same gate as Module 3
  const unlocked =
    status === 'scoring' || status === 'complete' || status === 'locked';

  // Fetch any previously generated reports
  let existingReports: Array<{ type: string; generatedAt: string; version: number }> = [];
  if (assessmentId) {
    const reportRows = await db
      .select({
        reportType: reports.reportType,
        generatedAt: reports.generatedAt,
        version: reports.version,
      })
      .from(reports)
      .where(eq(reports.assessmentId, assessmentId))
      .orderBy(desc(reports.generatedAt));

    existingReports = reportRows.map((r) => ({
      type: r.reportType,
      generatedAt: r.generatedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      version: r.version,
    }));
  }

  return { unlocked, assessmentStatus: status, existingReports };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function ReportsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  let unlocked = false;
  let assessmentStatus: string | null = null;
  let existingReports: Array<{ type: string; generatedAt: string; version: number }> = [];

  try {
    const result = await checkModule4Unlocked(userId);
    unlocked = result.unlocked;
    assessmentStatus = result.assessmentStatus;
    existingReports = result.existingReports;
  } catch {
    // DB unavailable — show locked state as safe default
  }

  if (!unlocked) {
    return <LockedView />;
  }

  return (
    <UnlockedView
      assessmentStatus={assessmentStatus}
      existingReports={existingReports}
    />
  );
}

// ---------------------------------------------------------------------------
// Locked state
// ---------------------------------------------------------------------------

function LockedView() {
  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-600/80">
            <Lock size={20} className="text-slate-500" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Module 4 — Locked
            </p>
            <h1 className="font-sora text-2xl font-semibold text-slate-400">
              Report Generator
            </h1>
          </div>
        </div>
      </div>

      {/* Lock explanation */}
      <div className="max-w-2xl rounded-xl border border-navy-600 bg-navy-600/30 p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Lock size={16} className="mt-0.5 flex-shrink-0 text-slate-500" aria-hidden="true" />
          <div>
            <h2 className="font-sora text-base font-semibold text-slate-300">
              Complete Module 3 — Scoring Dashboard first
            </h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              The Report Generator becomes available after your audit assessment
              scores are calculated. Complete Modules 1–3 to unlock CPPA
              submission document generation.
            </p>
          </div>
        </div>

        {/* Steps to unlock */}
        <div className="mt-4 pt-4 border-t border-navy-700">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Steps to unlock
          </p>
          <ol className="space-y-2 text-sm text-slate-500">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 font-mono text-xs text-slate-600 mt-0.5">1.</span>
              Run the{' '}
              <span className="text-teal-400/70">Eligibility Screener</span>{' '}
              and confirm coverage.
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 font-mono text-xs text-slate-600 mt-0.5">2.</span>
              Complete the full{' '}
              <span className="text-teal-400/70">Audit Assessment</span>{' '}
              (all 18 components).
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 font-mono text-xs text-slate-600 mt-0.5">3.</span>
              Submit the assessment and complete payment.
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 font-mono text-xs text-slate-600 mt-0.5">4.</span>
              Review scores in the{' '}
              <span className="text-teal-400/70">Scoring Dashboard</span>.
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 font-mono text-xs text-slate-600 mt-0.5">5.</span>
              Generate Document A and Document B here.
            </li>
          </ol>
        </div>
      </div>

      {/* Documents preview */}
      <div className="max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-6">
        <div className="flex items-start gap-3 mb-4">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-slate-500" aria-hidden="true" />
          <h3 className="font-sora text-sm font-semibold text-slate-500">
            Documents you&apos;ll be able to generate
          </h3>
        </div>
        <div className="space-y-3">
          {DOCUMENT_TYPES.map((doc) => (
            <div
              key={doc.type}
              className="rounded-lg bg-navy-700/30 p-4"
            >
              <p className="text-sm font-semibold text-slate-500">{doc.title}</p>
              <p className="mt-1 text-xs text-slate-600">{doc.description}</p>
              <p className="mt-1 font-mono text-xs text-slate-700">{doc.regulation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unlocked state
// ---------------------------------------------------------------------------

function UnlockedView({
  assessmentStatus,
  existingReports,
}: {
  assessmentStatus: string | null;
  existingReports: Array<{ type: string; generatedAt: string; version: number }>;
}) {
  const isComplete = assessmentStatus === 'complete';
  const isPendingPayment = assessmentStatus === 'locked';

  return (
    <div className="min-h-full px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <FileText size={20} className="text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">
              Module 4
            </p>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">
              Report Generator
            </h1>
          </div>
        </div>

        <p className="mt-2 text-sm text-slate-400 max-w-2xl">
          Generate your CPPA submission documents — Document A (Audit Report,{' '}
          <span className="font-mono text-xs text-slate-300">§7123(d)</span>) and
          Document B (Executive Certification,{' '}
          <span className="font-mono text-xs text-slate-300">§7122(a)(5)</span>).
          Both must be retained for 5 years.
        </p>
      </div>

      {/* Payment pending banner */}
      {isPendingPayment && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 max-w-2xl">
          <Clock size={16} className="mt-0.5 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              Payment required to generate documents
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Your assessment is complete but awaiting payment confirmation. Complete
              payment via Stripe to unlock PDF and DOCX generation.
            </p>
          </div>
        </div>
      )}

      {/* Document generation cards */}
      <div className="mb-6 max-w-2xl space-y-4">
        {DOCUMENT_TYPES.map((doc) => {
          const priorReport = existingReports.find((r) => r.type === doc.type);

          return (
            <div
              key={doc.type}
              className="rounded-xl border border-navy-600 bg-navy-600/50 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <FileCheck2
                    size={18}
                    className="mt-0.5 flex-shrink-0 text-teal-400"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-sora text-sm font-semibold text-slate-100">
                      {doc.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      {doc.description}
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {doc.regulation}
                    </p>
                    {priorReport && (
                      <p className="mt-2 text-xs text-slate-500">
                        Last generated:{' '}
                        <span className="text-slate-400">{priorReport.generatedAt}</span>
                        {' '}(v{priorReport.version})
                      </p>
                    )}
                  </div>
                </div>

                {/* Generate button — disabled in Phase 1, and also when payment pending */}
                <button
                  disabled
                  className="flex-shrink-0 inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-teal-400/20 px-4 py-2 text-xs font-semibold text-teal-400/50"
                  title={
                    !isComplete
                      ? 'Payment required to generate documents'
                      : 'Document generation ships in Phase 5'
                  }
                  aria-disabled="true"
                >
                  <Download size={13} aria-hidden="true" />
                  Generate
                  <span className="ml-0.5 rounded bg-navy-800/60 px-1 py-0.5 text-xs font-normal text-slate-600">
                    {!isComplete ? 'Payment' : 'Phase 5'}
                  </span>
                </button>
              </div>

              {/* Format options */}
              <div className="mt-3 pt-3 border-t border-navy-700 flex gap-3">
                {doc.formats.map((fmt) => (
                  <span
                    key={fmt}
                    className="rounded bg-navy-700/60 px-2 py-0.5 font-mono text-xs text-slate-500"
                  >
                    .{fmt}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Retention notice */}
      <div className="max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-5">
        <div className="flex items-start gap-3">
          <Info size={15} className="mt-0.5 flex-shrink-0 text-slate-500" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold text-slate-400">5-Year Retention Requirement</p>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Per{' '}
              <span className="font-mono text-slate-400">Cal. Code Regs. tit. 11, §7123</span>,
              all audit reports and certifications must be retained for a minimum of 5 years
              from the date of generation. ShieldAudit stores all generated documents in
              secure cloud storage on your behalf.
            </p>
          </div>
        </div>
      </div>

      {/* What comes with Phase 5 */}
      {isComplete && (
        <div className="mt-6 max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-5">
          <div className="flex items-start gap-3 mb-3">
            <Info size={15} className="mt-0.5 flex-shrink-0 text-slate-500" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-500">
              Document generation ships in Phase 5
            </p>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {PHASE5_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight size={12} className="mt-0.5 flex-shrink-0 text-slate-700" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const DOCUMENT_TYPES: Array<{
  type: string;
  title: string;
  description: string;
  regulation: string;
  formats: string[];
}> = [
  {
    type: 'audit_report',
    title: 'Document A — Cybersecurity Audit Report',
    description:
      'The full written audit report prepared by the independent auditor. Includes findings for all 18 §7123(c) components, risk scores, evidence citations, and remediation recommendations.',
    regulation: 'Cal. Code Regs. tit. 11, §7123(d)',
    formats: ['pdf', 'docx'],
  },
  {
    type: 'executive_certification',
    title: 'Document B — Executive Officer Certification',
    description:
      'Signed certification by the executive officer responsible for the business\'s cybersecurity program, affirming the audit was conducted in accordance with §7122–§7123.',
    regulation: 'Cal. Code Regs. tit. 11, §7122(a)(5)',
    formats: ['pdf', 'docx'],
  },
];

const PHASE5_FEATURES: string[] = [
  'Puppeteer-based PDF generation from the audit data with ShieldAudit branding.',
  'DOCX export using the docx package for attorney review and annotation.',
  'White-label branding: substitute your firm logo and colors (reseller feature).',
  'Digital signature block generation for Document B.',
  'Secure cloud storage with 5-year retention and download history.',
  'Re-generation with version tracking when remediation updates are made.',
];
