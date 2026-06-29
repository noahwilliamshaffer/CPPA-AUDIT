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
  const { userRoles, organizations, assessments, eligibilityResults, componentScores, answers, questions } = await import('@/db/schema');
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

  // ── Module 3 insight inputs ────────────────────────────────────────────────
  const orgRows = await db
    .select({ recordCount: organizations.consumerRecordCount, revenueTier: organizations.revenueTier })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const dlRows = await db
    .select({ deadline: eligibilityResults.submissionDeadline })
    .from(eligibilityResults)
    .where(eq(eligibilityResults.orgId, orgId))
    .orderBy(desc(eligibilityResults.createdAt))
    .limit(1);

  const answeredMeta = await db
    .select({
      response: answers.response,
      riskWeight: questions.riskWeight,
      componentNumber: questions.componentNumber,
      questionText: questions.questionText,
      nistCsf: questions.nistCsfMapping,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(eq(answers.assessmentId, assessmentId));

  return {
    gated: false as const,
    assessmentId,
    assessmentStatus,
    answerCount,
    scores: scores as ComponentScore[],
    recordCount: orgRows[0]?.recordCount ?? null,
    revenueTier: orgRows[0]?.revenueTier ?? null,
    submissionDeadline: dlRows[0]?.deadline ?? null,
    answeredMeta,
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

  const { assessmentId, assessmentStatus, answerCount, scores, recordCount, submissionDeadline, answeredMeta } = data;
  const hasScores = scores.length > 0;

  // ── Module 3 insights ──────────────────────────────────────────────────────
  const usd = (n: number) => '$' + n.toLocaleString('en-US');
  const penaltyMid = recordCount ? recordCount * 5325 : null;   // midpoint $/record/day
  const penaltyLow = recordCount ? recordCount * 2663 : null;
  const penaltyHigh = recordCount ? recordCount * 7988 : null;
  const deadlineDays = submissionDeadline
    ? Math.ceil((new Date(submissionDeadline).getTime() - Date.now()) / 86400000)
    : null;

  const RISK_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const RISK_BADGE: Record<string, string> = {
    critical: 'text-red-400 bg-red-400/10', high: 'text-orange-400 bg-orange-400/10',
    medium: 'text-amber-400 bg-amber-400/10', low: 'text-slate-400 bg-slate-500/10',
  };
  const topGaps = answeredMeta
    .filter(a => a.response === 'no' || a.response === 'partial')
    .sort((a, b) => (RISK_RANK[a.riskWeight] ?? 9) - (RISK_RANK[b.riskWeight] ?? 9))
    .slice(0, 5);

  const RESP_PTS: Record<string, number> = { yes: 100, partial: 50, no: 0 };
  const CSF_NAMES: Record<string, string> = { GV: 'Govern', ID: 'Identify', PR: 'Protect', DE: 'Detect', RS: 'Respond', RC: 'Recover' };
  const csfAgg: Record<string, { sum: number; n: number }> = {};
  for (const a of answeredMeta) {
    const pts = RESP_PTS[a.response];
    if (pts === undefined) continue; // skip N/A + non-scoring
    const code = (a.nistCsf ?? '').split('.')[0].trim().toUpperCase().slice(0, 2);
    if (!CSF_NAMES[code]) continue;
    const e = (csfAgg[code] ??= { sum: 0, n: 0 });
    e.sum += pts;
    e.n++;
  }
  const csfRows = Object.keys(CSF_NAMES)
    .filter(code => csfAgg[code]?.n)
    .map(code => ({ code, name: CSF_NAMES[code], score: Math.round(csfAgg[code].sum / csfAgg[code].n) }));

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

      {/* Audit insights (penalty exposure, deadline, top gaps, NIST CSF) */}
      {hasScores && (
        <div className="mb-6 max-w-2xl grid gap-3 sm:grid-cols-2">
          {/* Penalty exposure */}
          <div className="rounded-xl border border-navy-600 bg-navy-600/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Penalty exposure (per day)</p>
            {penaltyMid !== null ? (
              <>
                <p className="font-sora text-2xl font-bold text-score-red">{usd(penaltyMid)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {usd(penaltyLow!)}–{usd(penaltyHigh!)} · {recordCount!.toLocaleString()} records × $2,663–$7,988 per record/day
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500">Set consumer record count at onboarding to estimate.</p>
            )}
          </div>

          {/* Deadline countdown */}
          <div className="rounded-xl border border-navy-600 bg-navy-600/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Submission deadline</p>
            {deadlineDays !== null ? (
              <>
                <p className={`font-sora text-2xl font-bold ${deadlineDays < 60 ? 'text-score-red' : deadlineDays < 180 ? 'text-score-yellow' : 'text-teal-400'}`}>
                  {deadlineDays} days
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Due {submissionDeadline} (§7124)</p>
              </>
            ) : (
              <p className="text-xs text-slate-500">No submission deadline on file.</p>
            )}
          </div>

          {/* Top critical gaps */}
          <div className="rounded-xl border border-navy-600 bg-navy-600/20 p-4 sm:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Top critical gaps</p>
            {topGaps.length === 0 ? (
              <p className="text-xs text-slate-500">No open gaps — all assessed controls are implemented.</p>
            ) : (
              <ul className="space-y-1.5">
                {topGaps.map((g, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium uppercase ${RISK_BADGE[g.riskWeight] ?? RISK_BADGE.low}`}>{g.riskWeight}</span>
                    <span className="text-slate-600 font-mono text-[10px] flex-shrink-0">§7123(c)({g.componentNumber})</span>
                    <span className="text-slate-400 truncate">{g.questionText}</span>
                    <span className={`ml-auto flex-shrink-0 text-[10px] font-medium ${g.response === 'no' ? 'text-score-red' : 'text-score-yellow'}`}>{g.response}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* NIST CSF 2.0 function alignment */}
          {csfRows.length > 0 && (
            <div className="rounded-xl border border-navy-600 bg-navy-600/20 p-4 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">NIST CSF 2.0 function alignment</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {csfRows.map(f => (
                  <div key={f.code}>
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="text-slate-400">{f.name}</span>
                      <span className="font-mono text-slate-500">{f.score}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-navy-800">
                      <div
                        className={`h-1.5 rounded-full ${f.score >= 80 ? 'bg-score-green' : f.score >= 50 ? 'bg-score-yellow' : 'bg-score-red'}`}
                        style={{ width: `${f.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
