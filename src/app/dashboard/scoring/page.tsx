export const dynamic = 'force-dynamic';

/**
 * Module 3: Scoring Dashboard — /dashboard/scoring
 * Displays risk-weighted composite scores for all 18 §7123(c) components.
 * Scores are computed by POST /api/scoring/calculate and cached in component_scores.
 *
 * Gate: org must be covered (Module 1) and have at least one answered question (Module 2).
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Lock, ChevronRight, Calculator, FileText } from 'lucide-react';
import { AUDIT_COMPONENTS } from '@/lib/components';
import ScoreActions from './ScoreActions';
import PaymentCTA from './PaymentCTA';

interface ComponentScore {
  componentNumber: number;
  score: number;
  status: 'green' | 'yellow' | 'red';
}

async function fetchScoringData(clerkUserId: string) {
  const { db } = await import('@/db');
  const { userRoles, assessments, eligibilityResults, componentScores, answers } = await import('@/db/schema');
  const { eq, desc, sql } = await import('drizzle-orm');

  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, clerkUserId))
    .limit(1);
  if (roleRows.length === 0) return { gated: 'no_org' as const };

  const { orgId } = roleRows[0];

  const eligRows = await db
    .select({ covered: eligibilityResults.covered })
    .from(eligibilityResults)
    .where(eq(eligibilityResults.orgId, orgId))
    .orderBy(desc(eligibilityResults.createdAt))
    .limit(1);
  if (!eligRows[0]?.covered) return { gated: 'eligibility' as const };

  const assessmentRows = await db
    .select({ id: assessments.id, status: assessments.status })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  if (assessmentRows.length === 0) return { gated: 'no_assessment' as const };

  const { id: assessmentId, status: assessmentStatus } = assessmentRows[0];

  const countRows = await db
    .select({ c: sql<number>`cast(count(*) as integer)` })
    .from(answers)
    .where(eq(answers.assessmentId, assessmentId));
  const answerCount = Number(countRows[0]?.c ?? 0);
  if (answerCount === 0) return { gated: 'no_answers' as const };

  const scores = await db
    .select({
      componentNumber: componentScores.componentNumber,
      score: componentScores.score,
      status: componentScores.status,
    })
    .from(componentScores)
    .where(eq(componentScores.assessmentId, assessmentId))
    .orderBy(componentScores.componentNumber);

  return {
    gated: false as const,
    assessmentId,
    assessmentStatus,
    answerCount,
    scores: scores as ComponentScore[],
  };
}

export default async function ScoringPage() {
  const userId = 'local-user';

  let data: Awaited<ReturnType<typeof fetchScoringData>> = { gated: 'no_org' };
  try {
    data = await fetchScoringData(userId);
  } catch {
    // DB unavailable
  }

  if (data.gated) {
    return <GatedView reason={data.gated} />;
  }

  const { assessmentId, assessmentStatus, answerCount, scores } = data;
  const hasScores = scores.length > 0;

  // Build a map for O(1) lookup when rendering the component grid
  const scoreMap = new Map(scores.map(s => [s.componentNumber, s]));

  // Overall score = average of all component scores
  const overallScore = hasScores
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : null;
  const overallStatus = overallScore !== null
    ? overallScore >= 80 ? 'green' : overallScore >= 50 ? 'yellow' : 'red'
    : null;

  const greenCount = scores.filter(s => s.status === 'green').length;
  const yellowCount = scores.filter(s => s.status === 'yellow').length;
  const redCount = scores.filter(s => s.status === 'red').length;

  return (
    <div className="min-h-full px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <BarChart3 size={20} className="text-teal-400" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">Module 3</p>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">Scoring Dashboard</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl">
          Risk-weighted composite scores for each{' '}
          <span className="font-mono text-xs text-slate-300">§7123(c)</span> component.
          Traffic-light status flags components that require remediation before CPPA submission.
        </p>
      </div>

      {/* Submit & Pay CTA — shown when scores are calculated but payment not started */}
      {assessmentStatus === 'scoring' && hasScores && (
        <div className="mb-6 max-w-2xl rounded-xl border border-teal-400/30 bg-teal-400/5 p-5">
          <p className="text-sm font-semibold text-teal-300 mb-1">Scores ready — submit your assessment</p>
          <p className="text-xs text-slate-400 mb-4">
            Review the scores below, then submit to generate your CPPA submission documents
            (Document A and Document B).
          </p>
          <PaymentCTA />
        </div>
      )}

      {/* Payment pending banner — shown after Stripe checkout initiated */}
      {assessmentStatus === 'locked' && (
        <div className="mb-6 max-w-2xl rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 flex items-start gap-3">
          <Lock size={16} className="mt-0.5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Payment processing</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Your payment is being confirmed. Reports will unlock automatically once
              payment clears. This usually takes a few seconds.
            </p>
          </div>
        </div>
      )}

      {/* Complete — link to reports */}
      {assessmentStatus === 'complete' && (
        <div className="mb-6 max-w-2xl rounded-xl border border-score-green/30 bg-score-green/5 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText size={16} className="flex-shrink-0 text-score-green" aria-hidden="true" />
            <p className="text-sm text-slate-300">
              Assessment complete — your CPPA submission documents are ready.
            </p>
          </div>
          <Link
            href="/dashboard/reports"
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-score-green/20 px-3 py-1.5 text-xs font-semibold text-score-green hover:bg-score-green/30 transition-colors"
          >
            Generate Documents <ChevronRight size={12} />
          </Link>
        </div>
      )}

      {/* No scores yet */}
      {!hasScores && (
        <div className="mb-6 max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-6 flex items-start gap-4">
          <Calculator size={20} className="mt-0.5 flex-shrink-0 text-teal-400" />
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-1">Scores not yet calculated</p>
            <p className="text-xs text-slate-400 mb-4">
              {answerCount} question{answerCount !== 1 ? 's' : ''} answered. Click below to run the
              weighted scoring algorithm across all answered components.
            </p>
            <ScoreActions hasScores={false} assessmentId={assessmentId} />
          </div>
        </div>
      )}

      {/* Overall score card */}
      {hasScores && overallScore !== null && overallStatus && (
        <div className="mb-6 max-w-2xl rounded-xl border border-navy-600 bg-navy-600/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">
                Overall Score
              </p>
              <div className="flex items-baseline gap-3">
                <span
                  className={`font-sora text-5xl font-bold ${
                    overallStatus === 'green'
                      ? 'text-score-green'
                      : overallStatus === 'yellow'
                      ? 'text-score-yellow'
                      : 'text-score-red'
                  }`}
                >
                  {overallScore}
                </span>
                <span className="text-lg text-slate-500">/100</span>
              </div>
            </div>

            {/* Traffic light summary */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-score-green" />
                <span className="text-xs text-slate-400">{greenCount} Green</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-score-yellow" />
                <span className="text-xs text-slate-400">{yellowCount} Yellow</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-score-red" />
                <span className="text-xs text-slate-400">{redCount} Red</span>
              </div>
            </div>
          </div>

          {/* Overall score bar */}
          <div className="h-2 w-full rounded-full bg-navy-800">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${
                overallStatus === 'green'
                  ? 'bg-score-green'
                  : overallStatus === 'yellow'
                  ? 'bg-score-yellow'
                  : 'bg-score-red'
              }`}
              style={{ width: `${overallScore}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Average across {scores.length} scored component{scores.length !== 1 ? 's' : ''} ·{' '}
            {answerCount} questions answered
          </p>
        </div>
      )}

      {/* Component score grid */}
      {hasScores && (
        <div className="mb-6 max-w-2xl space-y-1.5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Component Scores
            </p>
            <ScoreActions hasScores={true} assessmentId={assessmentId} />
          </div>

          {AUDIT_COMPONENTS.map(comp => {
            const s = scoreMap.get(comp.number);
            return (
              <div
                key={comp.number}
                className="flex items-center gap-3 rounded-lg border border-navy-600/60 bg-navy-600/20 px-4 py-3"
              >
                {/* Traffic light dot */}
                <div
                  className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                    !s
                      ? 'bg-slate-700'
                      : s.status === 'green'
                      ? 'bg-score-green'
                      : s.status === 'yellow'
                      ? 'bg-score-yellow'
                      : 'bg-score-red'
                  }`}
                />

                {/* Component name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-slate-600">
                      §7123(c)({comp.number})
                    </span>
                    <span className="text-xs font-medium text-slate-300 truncate">
                      {comp.title}
                    </span>
                  </div>
                </div>

                {/* Score bar + value */}
                {s ? (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-24 h-1.5 rounded-full bg-navy-800">
                      <div
                        className={`h-1.5 rounded-full ${
                          s.status === 'green'
                            ? 'bg-score-green'
                            : s.status === 'yellow'
                            ? 'bg-score-yellow'
                            : 'bg-score-red'
                        }`}
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    <span
                      className={`font-mono text-xs font-semibold w-8 text-right ${
                        s.status === 'green'
                          ? 'text-score-green'
                          : s.status === 'yellow'
                          ? 'text-score-yellow'
                          : 'text-score-red'
                      }`}
                    >
                      {s.score}
                    </span>
                  </div>
                ) : (
                  <span className="font-mono text-xs text-slate-700 flex-shrink-0">—</span>
                )}

                {/* Link to component questions */}
                <Link
                  href={`/dashboard/assessment/${comp.number}`}
                  className="flex-shrink-0 text-slate-600 hover:text-teal-400 transition-colors"
                >
                  <ChevronRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Scoring methodology note */}
      <div className="max-w-2xl rounded-xl border border-navy-600/40 bg-navy-600/10 px-5 py-4">
        <div className="flex gap-6 flex-wrap text-xs text-slate-500">
          <span><span className="text-slate-400 font-semibold">Yes</span> = 100 pts</span>
          <span><span className="text-slate-400 font-semibold">Partial</span> = 50 pts</span>
          <span><span className="text-slate-400 font-semibold">No</span> = 0 pts</span>
          <span><span className="text-slate-400 font-semibold">N/A</span> = excluded</span>
          <span className="text-slate-600">·</span>
          <span><span className="text-slate-400 font-semibold">Critical</span> 4× · <span className="text-slate-400 font-semibold">High</span> 3× · <span className="text-slate-400 font-semibold">Medium</span> 2× · <span className="text-slate-400 font-semibold">Low</span> 1×</span>
        </div>
      </div>
    </div>
  );
}

function GatedView({ reason }: { reason: 'no_org' | 'eligibility' | 'no_assessment' | 'no_answers' }) {
  const messages: Record<typeof reason, { title: string; body: string; href: string; cta: string }> = {
    no_org: {
      title: 'Organization setup required',
      body: 'Complete onboarding to set up your organization before accessing the Scoring Dashboard.',
      href: '/onboarding',
      cta: 'Go to Onboarding',
    },
    eligibility: {
      title: 'Eligibility Screener required',
      body: 'Complete the Eligibility Screener with a Covered result to unlock the Audit Assessment and Scoring Dashboard.',
      href: '/dashboard/eligibility',
      cta: 'Go to Eligibility Screener',
    },
    no_assessment: {
      title: 'No assessment found',
      body: 'Start the Audit Assessment (Module 2) to begin answering questions. Scores are calculated from your answers.',
      href: '/dashboard/assessment',
      cta: 'Go to Audit Assessment',
    },
    no_answers: {
      title: 'No answers recorded yet',
      body: 'Answer at least one question in the Audit Assessment before calculating scores.',
      href: '/dashboard/assessment',
      cta: 'Go to Audit Assessment',
    },
  };

  const msg = messages[reason];

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-600/80">
            <Lock size={20} className="text-slate-500" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Module 3 — Locked</p>
            <h1 className="font-sora text-2xl font-semibold text-slate-400">Scoring Dashboard</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl rounded-xl border border-navy-600 bg-navy-600/30 p-6">
        <p className="text-sm font-semibold text-slate-300 mb-2">{msg.title}</p>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">{msg.body}</p>
        <Link
          href={msg.href}
          className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors"
        >
          {msg.cta} <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}
