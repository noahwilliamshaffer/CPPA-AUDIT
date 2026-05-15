/**
 * Module 2: Audit Assessment — /dashboard/assessment
 *
 * Server component. The core audit questionnaire covering all 18 §7123(c)
 * cybersecurity components with 40 questions, adaptive branching, evidence
 * locker, test logs, and interview logs.
 *
 * Access gate: This module is only unlocked after the Eligibility Screener
 * confirms coverage (eligibility_results row with covered = true).
 *
 * This page shows a locked state if Module 1 hasn't produced a "covered"
 * result yet. When unlocked, it shows the module overview and entry points.
 * The full 40-question wizard ships in Phase 3.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import {
  ClipboardList,
  Lock,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Check Module 2 unlock status for the current user's org.
// Returns true only if an eligibility_results row exists with covered = true.
// ---------------------------------------------------------------------------

async function checkModule2Unlocked(clerkUserId: string): Promise<{
  unlocked: boolean;
  assessmentStatus: string | null;
}> {
  const { db } = await import('@/db');
  const { userRoles, eligibilityResults, assessments } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, clerkUserId))
    .limit(1);

  if (roleRows.length === 0) return { unlocked: false, assessmentStatus: null };

  const orgId = roleRows[0].orgId;

  // Check for a covered eligibility result
  const eligibilityRows = await db
    .select({ covered: eligibilityResults.covered })
    .from(eligibilityResults)
    .where(eq(eligibilityResults.orgId, orgId))
    .orderBy(desc(eligibilityResults.createdAt))
    .limit(1);

  const unlocked =
    eligibilityRows.length > 0 && eligibilityRows[0].covered === true;

  // Get current assessment status if one exists
  const assessmentRows = await db
    .select({ status: assessments.status })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);

  return {
    unlocked,
    assessmentStatus: assessmentRows[0]?.status ?? null,
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function AssessmentPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  let unlocked = false;
  let assessmentStatus: string | null = null;

  try {
    const result = await checkModule2Unlocked(userId);
    unlocked = result.unlocked;
    assessmentStatus = result.assessmentStatus;
  } catch {
    // DB unavailable — show locked state as a safe default
  }

  if (!unlocked) {
    return <LockedView />;
  }

  return <UnlockedView assessmentStatus={assessmentStatus} />;
}

// ---------------------------------------------------------------------------
// Locked state — shown when Module 1 (Eligibility Screener) is not complete
// ---------------------------------------------------------------------------

function LockedView() {
  return (
    <div className="min-h-full px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-600/80">
            <Lock size={20} className="text-slate-500" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Module 2 — Locked
            </p>
            <h1 className="font-sora text-2xl font-semibold text-slate-400">
              Audit Assessment
            </h1>
          </div>
        </div>
      </div>

      {/* Lock explanation card */}
      <div className="max-w-2xl rounded-xl border border-navy-600 bg-navy-600/30 p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Lock size={16} className="mt-0.5 flex-shrink-0 text-slate-500" aria-hidden="true" />
          <div>
            <h2 className="font-sora text-base font-semibold text-slate-300">
              Complete Module 1 — Eligibility Screener first
            </h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              The Audit Assessment unlocks only after the Eligibility Screener
              confirms your organization is covered under{' '}
              <span className="font-mono text-xs text-slate-400">
                Cal. Code Regs. tit. 11, §7120
              </span>
              . If your screener result is{' '}
              <span className="font-semibold text-slate-400">Not Covered</span>
              , you are not required to complete a cybersecurity audit and
              Module 2 will remain locked.
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
              Navigate to{' '}
              <span className="text-teal-400/70">Eligibility Screener</span>{' '}
              in the sidebar.
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 font-mono text-xs text-slate-600 mt-0.5">2.</span>
              Answer all 5 threshold questions under{' '}
              <span className="font-mono text-xs text-slate-400">§7120(b)</span>.
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 font-mono text-xs text-slate-600 mt-0.5">3.</span>
              If your result is{' '}
              <span className="text-amber-400/70">Covered</span>, Module 2 will
              unlock automatically.
            </li>
          </ol>
        </div>
      </div>

      {/* Preview of what's inside */}
      <div className="max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-6">
        <div className="flex items-start gap-3 mb-4">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-slate-500" aria-hidden="true" />
          <h3 className="font-sora text-sm font-semibold text-slate-500">
            What becomes available after unlocking
          </h3>
        </div>
        <ul className="space-y-2 text-sm text-slate-600">
          {ASSESSMENT_PREVIEW.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <ChevronRight size={14} className="mt-0.5 flex-shrink-0 text-slate-700" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unlocked state — shown when Module 1 is complete with covered = true
// ---------------------------------------------------------------------------

function UnlockedView({ assessmentStatus }: { assessmentStatus: string | null }) {
  const statusLabel = STATUS_LABELS[assessmentStatus ?? ''] ?? 'Not Started';
  const statusClass = STATUS_CLASSES[assessmentStatus ?? ''] ?? 'bg-slate-500/20 text-slate-400';

  return (
    <div className="min-h-full px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <ClipboardList size={20} className="text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">
              Module 2
            </p>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">
              Audit Assessment
            </h1>
          </div>
        </div>

        <p className="mt-2 text-sm text-slate-400 max-w-2xl">
          40 questions across{' '}
          <span className="font-semibold text-slate-300">
            18 CPPA-mandated cybersecurity components
          </span>{' '}
          (
          <span className="font-mono text-xs text-slate-300">§7123(c)</span>).
          Each component requires documentation review, testing, and/or
          interviews per the three mandatory audit actions.
        </p>

        {/* Status badge */}
        <div className="mt-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}
          >
            <CheckCircle2 size={12} aria-hidden="true" />
            {statusLabel}
          </span>
        </div>
      </div>

      {/* In-progress banner */}
      {assessmentStatus === 'in_progress' && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-teal-400/30 bg-teal-400/10 p-4 max-w-2xl">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-teal-400" aria-hidden="true" />
          <p className="text-sm text-slate-300">
            Assessment is in progress. Continue answering questions to complete
            all 18 components.
          </p>
        </div>
      )}

      {/* Module overview card */}
      <div className="rounded-xl bg-navy-600/50 border border-navy-600 p-6 mb-6 max-w-2xl">
        <div className="flex items-start gap-3 mb-4">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-teal-400" aria-hidden="true" />
          <h2 className="font-sora text-base font-semibold text-slate-100">
            Assessment structure
          </h2>
        </div>

        <p className="mb-4 text-sm text-slate-400 leading-relaxed">
          The audit covers all{' '}
          <span className="font-semibold text-slate-300">
            18 §7123(c) cybersecurity components
          </span>
          . For each applicable component, the auditor must perform all three
          mandatory actions: documentation review (Action A), technical testing
          (Action B), and personnel interviews (Action C).
        </p>

        <ul className="space-y-2.5 text-sm">
          {COMPONENT_SUMMARY.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="font-mono text-xs text-slate-500 flex-shrink-0 mt-0.5 w-6">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-slate-300">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-4">
        <button
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-teal-400/30 px-5 py-2.5 text-sm font-semibold text-teal-400/60"
          title="Full assessment wizard ships in Phase 3"
          aria-disabled="true"
        >
          <ClipboardList size={16} aria-hidden="true" />
          {assessmentStatus === 'in_progress' ? 'Continue Assessment' : 'Begin Assessment'}
          <span className="ml-1 rounded bg-navy-800/60 px-1.5 py-0.5 text-xs font-normal text-slate-500">
            Phase 3
          </span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const ASSESSMENT_PREVIEW: string[] = [
  '40 questions across 18 §7123(c) cybersecurity components with risk-weighted scoring.',
  'Adaptive branching: follow-up questions appear based on prior answers.',
  'Evidence Locker for uploading supporting documentation per component.',
  'Test log entries to record Action B (technical testing) results.',
  'Interview logs to record Action C (personnel interviews) — title only, no names.',
  'Immutable audit trail: every answer change is logged and timestamped.',
];

const COMPONENT_SUMMARY: string[] = [
  'Risk assessments — documented annual process',
  'Information security policies and procedures',
  'Data inventory and classification',
  'Access controls and identity management',
  'Encryption of personal information in transit and at rest',
  'Physical and logical security of systems',
  'Vulnerability management and patching',
  'Network security and segmentation',
  'Incident response plan and testing',
  'Business continuity and disaster recovery',
  'Third-party vendor and service provider oversight',
  'Employee security training and awareness',
  'Secure software development practices',
  'Data minimization and retention policies',
  'Consumer rights fulfillment infrastructure',
  'Audit logging and monitoring',
  'Multi-factor authentication deployment',
  'Automated Decision-Making Technology (ADMT) controls — if applicable',
];

// Assessment status → display label
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  scoring: 'Awaiting Scoring',
  complete: 'Complete',
  locked: 'Locked (Awaiting Payment)',
};

// Assessment status → Tailwind classes for the status badge
const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-400',
  in_progress: 'bg-teal-400/15 text-teal-400',
  scoring: 'bg-amber-400/15 text-amber-400',
  complete: 'bg-score-green/15 text-score-green',
  locked: 'bg-crimson-400/15 text-crimson-400',
};
