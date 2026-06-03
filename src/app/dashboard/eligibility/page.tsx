/**
 * Module 1: Eligibility Screener — /dashboard/eligibility
 *
 * Server component. Determines whether the user's business is covered under
 * Cal. Code Regs. tit. 11, §7120. Coverage is determined by OR logic across
 * five threshold questions — meeting ANY single threshold triggers coverage.
 *
 * This is always the first and always-accessible step regardless of the user's
 * role. Even "not covered" organizations need to run this screener to
 * generate proof that they are outside CPPA jurisdiction.
 *
 * Phase 1 note: The interactive screener wizard (5 questions → binary
 * Covered/Not Covered result) ships in Phase 2. This page serves as the
 * entry point and orientation screen for now.
 */


import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ClipboardCheck,
  CheckCircle2,
  Info,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Fetch the most recent eligibility result for this org, if any.
// Returns null if the screener hasn't been run yet or if the DB is unavailable.
// ---------------------------------------------------------------------------

interface EligibilityStatus {
  hasResult: boolean;
  covered: boolean | null;
  completedAt: string | null;
}

async function fetchEligibilityStatus(clerkUserId: string): Promise<EligibilityStatus> {
  const { db } = await import('@/db');
  const { userRoles, eligibilityResults } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  // Find the org for this user
  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, clerkUserId))
    .limit(1);

  if (roleRows.length === 0) return { hasResult: false, covered: null, completedAt: null };

  const orgId = roleRows[0].orgId;

  const resultRows = await db
    .select({
      covered: eligibilityResults.covered,
      createdAt: eligibilityResults.createdAt,
    })
    .from(eligibilityResults)
    .where(eq(eligibilityResults.orgId, orgId))
    .orderBy(desc(eligibilityResults.createdAt))
    .limit(1);

  if (resultRows.length === 0) return { hasResult: false, covered: null, completedAt: null };

  return {
    hasResult: true,
    covered: resultRows[0].covered,
    completedAt: resultRows[0].createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function EligibilityPage() {
  const userId = 'local-user';

  // Attempt to fetch prior screener result; gracefully degrade if DB is down.
  let eligibilityStatus: EligibilityStatus = {
    hasResult: false,
    covered: null,
    completedAt: null,
  };

  try {
    eligibilityStatus = await fetchEligibilityStatus(userId);
  } catch {
    // DB unavailable in dev — show the "ready to begin" state
  }

  return (
    <div className="min-h-full px-8 py-8">
      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <ClipboardCheck size={20} className="text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">
              Module 1
            </p>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">
              Eligibility Screener
            </h1>
          </div>
        </div>

        <p className="mt-2 text-sm text-slate-400 max-w-2xl">
          Determine if your business is covered under{' '}
          <span className="font-mono text-slate-300">
            Cal. Code Regs. tit. 11, §7120
          </span>{' '}
          and required to complete a CPPA cybersecurity audit.
        </p>

        {/* Status badge */}
        <div className="mt-4">
          {eligibilityStatus.hasResult ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                eligibilityStatus.covered
                  ? 'bg-amber-400/15 text-amber-400'
                  : 'bg-score-green/15 text-score-green'
              }`}
            >
              <CheckCircle2 size={12} aria-hidden="true" />
              {eligibilityStatus.covered
                ? 'Covered — Audit Required'
                : 'Not Covered — No Audit Required'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-400/15 px-3 py-1 text-xs font-semibold text-teal-400">
              <CheckCircle2 size={12} aria-hidden="true" />
              Ready to Begin
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Prior result banner (if screener already completed)                */}
      {/* ------------------------------------------------------------------ */}
      {eligibilityStatus.hasResult && (
        <div
          className={`mb-6 flex items-start gap-3 rounded-lg border p-4 ${
            eligibilityStatus.covered
              ? 'border-amber-400/30 bg-amber-400/10'
              : 'border-score-green/30 bg-score-green/10'
          }`}
        >
          <AlertCircle
            size={16}
            className={`mt-0.5 flex-shrink-0 ${eligibilityStatus.covered ? 'text-amber-400' : 'text-score-green'}`}
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-slate-100">
              Screener completed on {eligibilityStatus.completedAt}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {eligibilityStatus.covered
                ? 'Your organization is covered under §7120. You may proceed to Module 2 to begin the full audit assessment.'
                : 'Your organization is not covered under §7120. No cybersecurity audit is required at this time. You can re-run the screener if your business circumstances change.'}
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Module description card                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl bg-navy-600/50 border border-navy-600 p-6 mb-6 max-w-2xl">
        <div className="flex items-start gap-3 mb-4">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-teal-400" aria-hidden="true" />
          <h2 className="font-sora text-base font-semibold text-slate-100">
            What this module does
          </h2>
        </div>

        <p className="mb-4 text-sm text-slate-400 leading-relaxed">
          The Eligibility Screener asks{' '}
          <span className="font-semibold text-slate-300">5 threshold questions</span>{' '}
          drawn directly from{' '}
          <span className="font-mono text-xs text-slate-300">§7120(b)(1)–(5)</span>.
          Coverage is determined using{' '}
          <span className="font-semibold text-slate-300">OR logic</span> — meeting{' '}
          <em>any single threshold</em> triggers a Covered determination and unlocks
          Module 2.
        </p>

        {/* Five threshold questions summary */}
        <ul className="space-y-2.5 text-sm">
          {THRESHOLDS.map((threshold, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <ChevronRight
                size={14}
                className="mt-0.5 flex-shrink-0 text-teal-400"
                aria-hidden="true"
              />
              <span className="text-slate-300">
                <span className="font-mono text-xs text-slate-500 mr-2">
                  §7120(b)({i + 1})
                </span>
                {threshold}
              </span>
            </li>
          ))}
        </ul>

        {/* Result type */}
        <div className="mt-5 pt-4 border-t border-navy-600">
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-400">Result type:</span>{' '}
            Binary —{' '}
            <span className="font-semibold text-teal-400">Covered</span> or{' '}
            <span className="font-semibold text-slate-300">Not Covered</span>.
            Covered organizations are automatically advanced to Module 2.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Action button                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/eligibility/screener"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-5 py-2.5 text-sm font-semibold text-navy-800 transition-colors hover:bg-teal-300"
        >
          <ClipboardCheck size={16} aria-hidden="true" />
          {eligibilityStatus.hasResult ? 'Re-run Screener' : 'Begin Screener'}
        </Link>

        {eligibilityStatus.hasResult && eligibilityStatus.covered && (
          <p className="text-xs text-slate-500">
            Module 2 is already unlocked — proceed to{' '}
            <span className="text-teal-400">Audit Assessment</span> in the sidebar.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §7120(b) coverage threshold descriptions (short form for the UI)
// ---------------------------------------------------------------------------

const THRESHOLDS: string[] = [
  'Annual gross revenue exceeds $25 million (inflation-adjusted) in the preceding calendar year.',
  'Buys, sells, or shares personal information of 100,000 or more consumers or households annually.',
  "Derives 50% or more of annual revenue from selling consumers' personal information.",
  'Annually buys, sells, or shares personal information of 25,000 or more consumers and derives 25% or more of annual revenue from that data.',
  'Annually buys or receives personal information of 10,000 or more consumers for commercial purposes.',
];
