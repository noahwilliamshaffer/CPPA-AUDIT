export const dynamic = 'force-dynamic';

/**
 * Module 2: Audit Assessment — /dashboard/assessment
 * 18 §7123(c) component cards plus the ADMT sub-assessment, with live
 * per-component completion. Gated behind the AI document-upload step: if the
 * current assessment has no autofill session yet, the auditor is routed there
 * first (they can analyze documents or explicitly skip).
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList, CheckCircle2, Circle, ChevronRight, AlertCircle, Download, Sparkles } from 'lucide-react';
import { AUDIT_COMPONENTS } from '@/lib/components';
import NewAssessmentButton from './NewAssessmentButton';

interface ComponentStatus {
  componentNumber: number;
  answered: number;
  total: number;
}

async function fetchAssessmentStatus(clerkUserId: string): Promise<{
  assessmentId: string | null;
  hasSession: boolean;
  hasNistSummary: boolean;
  sessionStatus: string | null;
  componentStatuses: ComponentStatus[];
}> {
  const { db } = await import('@/db');
  const { userRoles, assessments, answers, questions, aiAutofillSessions } = await import('@/db/schema');
  const { eq, desc, and, sql, isNull } = await import('drizzle-orm');

  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, clerkUserId))
    .limit(1);

  if (roleRows.length === 0) return { assessmentId: null, hasSession: false, hasNistSummary: false, sessionStatus: null, componentStatuses: [] };
  const { orgId } = roleRows[0];

  const assessmentRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);

  if (assessmentRows.length === 0) return { assessmentId: null, hasSession: false, hasNistSummary: false, sessionStatus: null, componentStatuses: [] };
  const assessmentId = assessmentRows[0].id;

  const sessionRows = await db
    .select({ id: aiAutofillSessions.id, status: aiAutofillSessions.status, nistSummaryText: aiAutofillSessions.nistSummaryText })
    .from(aiAutofillSessions)
    .where(eq(aiAutofillSessions.assessmentId, assessmentId))
    .orderBy(desc(aiAutofillSessions.createdAt))
    .limit(1);
  const hasSession = sessionRows.length > 0;
  const hasNistSummary = !!sessionRows[0]?.nistSummaryText;
  const sessionStatus = sessionRows[0]?.status ?? null;

  // Count only BASE questions (conditionals are revealed dynamically and not
  // counted toward a component's checklist total).
  const answerCounts = await db
    .select({
      componentNumber: questions.componentNumber,
      answered: sql<number>`cast(count(${answers.id}) as integer)`,
    })
    .from(questions)
    .leftJoin(
      answers,
      and(eq(answers.questionId, questions.id), eq(answers.assessmentId, assessmentId))
    )
    .where(isNull(questions.parentQuestionId))
    .groupBy(questions.componentNumber);

  const countMap = new Map(answerCounts.map(r => [r.componentNumber, Number(r.answered)]));

  const componentStatuses = AUDIT_COMPONENTS.map(c => ({
    componentNumber: c.number,
    answered: countMap.get(c.number) ?? 0,
    total: c.questionCount,
  }));

  return { assessmentId, hasSession, hasNistSummary, sessionStatus, componentStatuses };
}

export default async function AssessmentPage() {
  const userId = 'local-user';
  let assessmentId: string | null = null;
  let hasSession = true; // assume true on error so we don't loop into the upload page
  let hasNistSummary = false;
  let sessionStatus: string | null = null;
  let componentStatuses: ComponentStatus[] = [];

  try {
    const result = await fetchAssessmentStatus(userId);
    assessmentId = result.assessmentId;
    hasSession = result.hasSession;
    hasNistSummary = result.hasNistSummary;
    sessionStatus = result.sessionStatus;
    componentStatuses = result.componentStatuses;
  } catch {
    // DB unavailable
  }

  // Required upload step before Module 2 (redirect outside try/catch).
  if (!hasSession) {
    redirect('/dashboard/assessment/document-upload');
  }

  const statusMap = new Map(componentStatuses.map(s => [s.componentNumber, s]));
  const totalAnswered = componentStatuses.reduce((sum, s) => sum + Math.min(s.answered, s.total), 0);
  const totalQuestions = componentStatuses.reduce((sum, s) => sum + s.total, 0);
  const overallPct = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
              <ClipboardList size={20} className="text-teal-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-teal-400">Module 2</p>
              <h1 className="font-sora text-2xl font-semibold text-slate-100">Audit Assessment</h1>
            </div>
          </div>
          <NewAssessmentButton />
        </div>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl">
          Answer questions across all 18{' '}
          <span className="font-mono text-xs text-slate-300">§7123(c)</span> audit components plus the
          ADMT sub-assessment. Components can be assessed in any order.
        </p>
        {hasNistSummary && (
          <a
            href="/api/ai-autofill/nist-summary"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors"
          >
            <Download size={12} /> Download NIST 800-53 Summary (PDF)
          </a>
        )}
      </div>

      {sessionStatus === 'complete' && (
        <div className="mb-6 max-w-2xl rounded-xl border border-teal-400/20 bg-teal-400/5 p-4 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            AI suggestions are ready to review. Your accept/override progress is saved as you go — leave and come back anytime.
          </p>
          <Link
            href="/dashboard/assessment/autofill-review"
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-400 hover:bg-teal-400/20 transition-colors"
          >
            <Sparkles size={12} /> Review AI suggestions <ChevronRight size={12} />
          </Link>
        </div>
      )}

      <div className="mb-6 max-w-2xl rounded-xl bg-navy-600/50 border border-navy-600 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-200">Overall Progress</p>
              <span className="font-mono text-sm text-teal-400">{overallPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-navy-800">
              <div className="h-2 rounded-full bg-teal-400 transition-all duration-500" style={{ width: `${overallPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {totalAnswered} of {totalQuestions} base questions answered across 18 components + ADMT
            </p>
          </div>

          {!assessmentId && (
            <div className="mb-6 max-w-2xl rounded-xl border border-teal-400/20 bg-teal-400/5 p-4 flex items-start gap-3">
              <AlertCircle size={15} className="mt-0.5 text-teal-400 flex-shrink-0" />
              <p className="text-xs text-slate-400">
                Click any component to begin. An assessment record will be created automatically on your first answer.
              </p>
            </div>
          )}

          {totalAnswered > 0 && (
            <div className="mb-6 max-w-2xl rounded-xl border border-teal-400/20 bg-teal-400/5 p-4 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-400">
                Ready to see your risk scores? The Scoring Dashboard calculates weighted results from your answers.
              </p>
              <Link
                href="/dashboard/scoring"
                className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-400 hover:bg-teal-400/20 transition-colors"
              >
                View Scores <ChevronRight size={12} />
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 max-w-4xl sm:grid-cols-2">
            {AUDIT_COMPONENTS.map(component => {
              const status = statusMap.get(component.number);
              const answered = Math.min(status?.answered ?? 0, component.questionCount);
              const total = component.questionCount;
              const pct = total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0;
              const complete = answered >= total && total > 0;

              return (
                <Link
                  key={component.number}
                  href={`/dashboard/assessment/${component.number}`}
                  className="group rounded-xl border border-navy-600 bg-navy-600/30 p-5 transition-all hover:border-teal-400/30 hover:bg-navy-600/60"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono text-xs text-slate-500">{component.citation}</span>
                    {complete ? (
                      <CheckCircle2 size={15} className="text-score-green flex-shrink-0" />
                    ) : answered > 0 ? (
                      <span className="font-mono text-xs text-teal-400">{pct}%</span>
                    ) : (
                      <Circle size={15} className="text-slate-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="font-sora text-sm font-semibold text-slate-200 mb-1.5 group-hover:text-teal-400 transition-colors">
                    {component.title}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-4">
                    {component.description}
                  </p>
                  <div className="h-1 w-full rounded-full bg-navy-800">
                    <div
                      className={`h-1 rounded-full transition-all duration-300 ${complete ? 'bg-score-green' : 'bg-teal-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">{answered}/{total} questions</p>
                </Link>
              );
            })}
          </div>
    </div>
  );
}
