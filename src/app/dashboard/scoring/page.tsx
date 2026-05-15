/**
 * Module 3: Scoring Dashboard — /dashboard/scoring
 *
 * Server component. Displays risk-weighted composite scores for each of the
 * 18 §7123(c) cybersecurity components using a traffic-light system.
 *
 * Scoring algorithm (cached in component_scores table):
 * - Yes = 100 pts | Partial = 50 pts | No = 0 pts | N/A = excluded from denominator
 * - Risk weight multipliers: Critical = 4×, High = 3×, Medium = 2×, Low = 1×
 * - Traffic lights: Red < 50 | Yellow 50–79 | Green ≥ 80
 *
 * Access gate: Requires Module 2 complete — assessment status must be
 * 'scoring', 'complete', or 'locked' (locked = payment pending).
 *
 * Phase 3 note: The live score calculation engine and per-component drill-down
 * ship in Phase 4. This page shows the locked or preview state for Phase 1.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import {
  BarChart3,
  Lock,
  ChevronRight,
  Info,
  TrendingUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Check Module 3 unlock status
// ---------------------------------------------------------------------------

async function checkModule3Unlocked(clerkUserId: string): Promise<{
  unlocked: boolean;
  assessmentStatus: string | null;
}> {
  const { db } = await import('@/db');
  const { userRoles, assessments } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, clerkUserId))
    .limit(1);

  if (roleRows.length === 0) return { unlocked: false, assessmentStatus: null };

  const orgId = roleRows[0].orgId;

  const assessmentRows = await db
    .select({ status: assessments.status })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);

  const status = assessmentRows[0]?.status ?? null;

  // Module 3 is unlocked when assessment has moved past the Module 2 submission
  // stage. 'locked' status means payment is pending but the scoring data is
  // available — the UI can still show scores as an incentive to pay.
  const unlocked =
    status === 'scoring' || status === 'complete' || status === 'locked';

  return { unlocked, assessmentStatus: status };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function ScoringPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  let unlocked = false;
  let assessmentStatus: string | null = null;

  try {
    const result = await checkModule3Unlocked(userId);
    unlocked = result.unlocked;
    assessmentStatus = result.assessmentStatus;
  } catch {
    // DB unavailable — show locked state as safe default
  }

  if (!unlocked) {
    return <LockedView />;
  }

  return <UnlockedView assessmentStatus={assessmentStatus} />;
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
              Module 3 — Locked
            </p>
            <h1 className="font-sora text-2xl font-semibold text-slate-400">
              Scoring Dashboard
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
              Complete Module 2 — Audit Assessment first
            </h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              The Scoring Dashboard becomes available after you submit the full
              40-question audit assessment across all 18{' '}
              <span className="font-mono text-xs text-slate-400">§7123(c)</span>{' '}
              components and complete payment. Scores are calculated automatically
              from your submitted answers.
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
              Complete the{' '}
              <span className="text-teal-400/70">Eligibility Screener</span>{' '}
              with a Covered result.
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 font-mono text-xs text-slate-600 mt-0.5">2.</span>
              Answer all applicable questions in the{' '}
              <span className="text-teal-400/70">Audit Assessment</span> (Module 2).
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 font-mono text-xs text-slate-600 mt-0.5">3.</span>
              Submit the assessment and complete payment via Stripe.
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 font-mono text-xs text-slate-600 mt-0.5">4.</span>
              Scores are calculated automatically and this dashboard unlocks.
            </li>
          </ol>
        </div>
      </div>

      {/* Preview of scoring features */}
      <div className="max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-6">
        <div className="flex items-start gap-3 mb-4">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-slate-500" aria-hidden="true" />
          <h3 className="font-sora text-sm font-semibold text-slate-500">
            What you&apos;ll see here
          </h3>
        </div>
        <ul className="space-y-2 text-sm text-slate-600">
          {SCORING_PREVIEW.map((item, i) => (
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
// Unlocked state — shown when assessment status is scoring/complete/locked
// ---------------------------------------------------------------------------

function UnlockedView({ assessmentStatus }: { assessmentStatus: string | null }) {
  const isPendingPayment = assessmentStatus === 'locked';

  return (
    <div className="min-h-full px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <BarChart3 size={20} className="text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">
              Module 3
            </p>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">
              Scoring Dashboard
            </h1>
          </div>
        </div>

        <p className="mt-2 text-sm text-slate-400 max-w-2xl">
          Risk-weighted composite scores for each of the 18{' '}
          <span className="font-mono text-xs text-slate-300">§7123(c)</span>{' '}
          cybersecurity components. Traffic-light indicators flag components
          requiring remediation before CPPA submission.
        </p>
      </div>

      {/* Payment pending banner */}
      {isPendingPayment && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 max-w-2xl">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              Payment required to finalize scores
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Your assessment is complete. Complete payment via Stripe to unlock
              the Report Generator and download your CPPA submission documents.
              Score previews are available below.
            </p>
          </div>
        </div>
      )}

      {/* Scoring method explanation */}
      <div className="mb-6 max-w-2xl rounded-xl border border-navy-600 bg-navy-600/50 p-6">
        <div className="flex items-start gap-3 mb-4">
          <TrendingUp size={16} className="mt-0.5 flex-shrink-0 text-teal-400" aria-hidden="true" />
          <h2 className="font-sora text-base font-semibold text-slate-100">
            Scoring methodology
          </h2>
        </div>

        {/* Score value legend */}
        <div className="mb-4 grid grid-cols-4 gap-3">
          {SCORE_VALUES.map(({ response, points, desc }) => (
            <div
              key={response}
              className="rounded-lg bg-navy-700/80 p-3 text-center"
            >
              <p className="font-mono text-lg font-bold text-slate-100">{points}</p>
              <p className="text-xs font-semibold text-slate-300">{response}</p>
              <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>

        {/* Traffic light key */}
        <div className="mb-4 flex gap-4 flex-wrap">
          {TRAFFIC_LIGHTS.map(({ color, bgClass, textClass, label, range }) => (
            <div key={color} className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${bgClass}`} aria-hidden="true" />
              <span className={`text-xs font-semibold ${textClass}`}>{label}</span>
              <span className="text-xs text-slate-500">{range}</span>
            </div>
          ))}
        </div>

        {/* Risk weight multipliers */}
        <div className="pt-4 border-t border-navy-600">
          <p className="mb-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Risk weight multipliers
          </p>
          <div className="flex gap-6 flex-wrap">
            {RISK_WEIGHTS.map(({ weight, multiplier }) => (
              <div key={weight} className="text-xs">
                <span className="font-semibold text-slate-300">{weight}:</span>{' '}
                <span className="font-mono text-slate-400">{multiplier}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live scores placeholder */}
      <div className="max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-6">
        <div className="flex items-start gap-3 mb-4">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-slate-500" aria-hidden="true" />
          <div>
            <h3 className="font-sora text-sm font-semibold text-slate-400">
              Per-component score grid
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              The interactive score grid with drill-down, remediation tracking,
              and comparison views ships in Phase 4.
            </p>
          </div>
        </div>

        {/* Skeleton rows to communicate what the grid will look like */}
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-navy-700/40 px-4 py-3"
            >
              <div className="h-2.5 w-2.5 rounded-full bg-navy-600" aria-hidden="true" />
              <div className="h-3 w-48 rounded bg-navy-600/60" aria-hidden="true" />
              <div className="ml-auto h-6 w-14 rounded bg-navy-600/60" aria-hidden="true" />
            </div>
          ))}
          <p className="text-center text-xs text-slate-600 pt-2">
            18 component rows — available in Phase 4
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Static display data
// ---------------------------------------------------------------------------

const SCORING_PREVIEW: string[] = [
  'Composite risk-weighted score (0–100) for each of the 18 §7123(c) components.',
  'Traffic-light status: Red (<50), Yellow (50–79), Green (≥80) per component.',
  'Drill-down view showing individual question scores within each component.',
  'Overall organization score derived from all applicable components.',
  'Remediation recommendations for Red and Yellow components.',
  'Historical score comparison if re-assessments have been run.',
];

const SCORE_VALUES: Array<{ response: string; points: string; desc: string }> = [
  { response: 'Yes', points: '100', desc: 'Full credit' },
  { response: 'Partial', points: '50', desc: 'Half credit' },
  { response: 'No', points: '0', desc: 'No credit' },
  { response: 'N/A', points: '—', desc: 'Excluded' },
];

const TRAFFIC_LIGHTS: Array<{
  color: string;
  bgClass: string;
  textClass: string;
  label: string;
  range: string;
}> = [
  {
    color: 'green',
    bgClass: 'bg-score-green',
    textClass: 'text-score-green',
    label: 'Green',
    range: '≥ 80',
  },
  {
    color: 'yellow',
    bgClass: 'bg-score-yellow',
    textClass: 'text-score-yellow',
    label: 'Yellow',
    range: '50–79',
  },
  {
    color: 'red',
    bgClass: 'bg-score-red',
    textClass: 'text-score-red',
    label: 'Red',
    range: '< 50',
  },
];

const RISK_WEIGHTS: Array<{ weight: string; multiplier: string }> = [
  { weight: 'Critical', multiplier: '4×' },
  { weight: 'High', multiplier: '3×' },
  { weight: 'Medium', multiplier: '2×' },
  { weight: 'Low', multiplier: '1×' },
];
