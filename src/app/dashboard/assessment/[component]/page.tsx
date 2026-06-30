export const dynamic = 'force-dynamic';

/**
 * /dashboard/assessment/[component] — questions for a single §7123(c) component
 * (or the ADMT sub-assessment, component 19).
 * Server renders current answer state + AI autofill suggestions; the client
 * component handles answer submission and conditional branch visibility.
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AUDIT_COMPONENTS } from '@/lib/components';
import ComponentQuestions from './ComponentQuestions';
import EvidenceLocker from './EvidenceLocker';
import AuditorLogs from './AuditorLogs';
import ComponentStatusControl from './ComponentStatusControl';

interface PageProps {
  params: Promise<{ component: string }>;
}

interface AiResultRow {
  questionId: string;
  suggestedAnswer: string | null;
  confidence: string | null;
  reasoning: string | null;
  sourceDocuments?: string[];
  needsReview: boolean;
}

async function fetchComponentData(clerkUserId: string, componentNumber: number) {
  const { db } = await import('@/db');
  const { userRoles, assessments, eligibilityResults, questions, answers, aiAutofillSessions } =
    await import('@/db/schema');
  const { eq, desc, and } = await import('drizzle-orm');

  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, clerkUserId))
    .limit(1);
  if (roleRows.length === 0) return null;
  const { orgId } = roleRows[0];

  // Check coverage gate
  const eligRows = await db
    .select({ covered: eligibilityResults.covered })
    .from(eligibilityResults)
    .where(eq(eligibilityResults.orgId, orgId))
    .orderBy(desc(eligibilityResults.createdAt))
    .limit(1);
  if (!eligRows[0]?.covered) {
    return { gated: true, hasSession: true, orgId, assessmentId: null, questions: [], answers: [], aiResults: {} };
  }

  // Get most recent assessment
  const assessmentRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  const assessmentId = assessmentRows[0]?.id ?? null;

  // Has the auditor completed (or skipped) the document-upload step?
  let hasSession = false;
  let autofillResults: AiResultRow[] = [];
  if (assessmentId) {
    const sessionRows = await db
      .select({ status: aiAutofillSessions.status, autofillResults: aiAutofillSessions.autofillResults })
      .from(aiAutofillSessions)
      .where(eq(aiAutofillSessions.assessmentId, assessmentId))
      .orderBy(desc(aiAutofillSessions.createdAt))
      .limit(1);
    hasSession = sessionRows.length > 0;
    autofillResults = (sessionRows[0]?.autofillResults as AiResultRow[] | undefined) ?? [];
  }

  // Fetch questions for this component (base + conditionals)
  const componentQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.componentNumber, componentNumber))
    .orderBy(questions.displayOrder);

  // Fetch existing answers
  const existingAnswers = assessmentId
    ? await db
        .select()
        .from(answers)
        .where(and(eq(answers.assessmentId, assessmentId), eq(answers.orgId, orgId)))
    : [];

  // Build AI-result map for this component's questions
  const qIds = new Set(componentQuestions.map(q => q.id));
  const aiResults: Record<string, { needsReview: boolean; confidence: string | null; reasoning: string | null; sourceDocuments: string[]; suggestedAnswer: string | null }> = {};
  for (const r of autofillResults) {
    if (r && qIds.has(r.questionId)) {
      aiResults[r.questionId] = {
        needsReview: !!r.needsReview,
        confidence: r.confidence ?? null,
        reasoning: r.reasoning ?? null,
        sourceDocuments: r.sourceDocuments ?? [],
        suggestedAnswer: r.suggestedAnswer ?? null,
      };
    }
  }

  return {
    gated: false,
    hasSession,
    orgId,
    assessmentId,
    questions: componentQuestions.map(q => ({
      id: q.id,
      questionText: q.questionText,
      riskWeight: q.riskWeight,
      nistCsfMapping: q.nistCsfMapping,
      nist80053Mapping: q.nist80053Mapping,
      cisControlMapping: q.cisControlMapping,
      displayOrder: q.displayOrder,
      answerType: (q.answerType ?? 'yes_partial_no_na') as
        'yes_partial_no_na' | 'yes_no' | 'yes_no_na' | 'open_text' | 'choice',
      options: (q.options as { value: string; label: string }[] | null) ?? null,
      parentQuestionId: q.parentQuestionId,
      triggerCondition: (q.triggerCondition as { showWhen?: string[] } | null) ?? null,
    })),
    answers: existingAnswers.map(a => ({
      questionId: a.questionId,
      response: a.response,
      responseText: a.responseText,
      auditorNotes: a.auditorNotes,
      aiGenerated: a.aiGenerated,
      aiConfidence: a.aiConfidence,
      aiReasoning: a.aiReasoning,
      needsClientReview: a.needsClientReview,
    })),
    aiResults,
  };
}

export default async function ComponentPage({ params }: PageProps) {
  const userId = 'local-user';

  const { component } = await params;
  const componentNumber = parseInt(component, 10);
  if (isNaN(componentNumber) || componentNumber < 1 || componentNumber > 19) notFound();

  const componentDef = AUDIT_COMPONENTS.find(c => c.number === componentNumber);
  if (!componentDef) notFound();

  let data: Awaited<ReturnType<typeof fetchComponentData>> = null;
  try {
    data = await fetchComponentData(userId, componentNumber);
  } catch {
    // DB unavailable
  }

  // Gate Module 2 behind the document-upload step (redirect must be outside try/catch).
  if (data && !data.gated && !data.hasSession) {
    redirect('/dashboard/assessment/document-upload');
  }

  const prevComponent = componentNumber > 1 ? componentNumber - 1 : null;
  const nextComponent = componentNumber < 19 ? componentNumber + 1 : null;

  return (
    <div className="min-h-full px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/dashboard/assessment"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
        >
          <ChevronLeft size={12} />
          All Components
        </Link>
        <span className="text-slate-600 text-xs">/</span>
        <span className="text-xs text-slate-400">{componentDef.citation}</span>
      </div>

      {/* Header */}
      <div className="mb-6 max-w-2xl">
        <p className="font-mono text-xs text-teal-400 mb-1">{componentDef.citation}</p>
        <h1 className="font-sora text-2xl font-semibold text-slate-100 mb-2">{componentDef.title}</h1>
        <p className="text-sm text-slate-400">{componentDef.description}</p>
      </div>

      {/* Gated */}
      {data?.gated && (
        <div className="max-w-2xl rounded-xl border border-amber-400/30 bg-amber-400/10 p-6">
          <p className="text-sm font-semibold text-amber-400 mb-1">Assessment locked</p>
          <p className="text-xs text-slate-400">Complete the Eligibility Screener first.</p>
          <Link href="/dashboard/eligibility" className="mt-3 inline-flex text-xs text-teal-400 hover:text-teal-300">
            Go to Eligibility Screener →
          </Link>
        </div>
      )}

      {/* Applicability + Mark Complete (§7123(c)) */}
      {data && !data.gated && data.assessmentId && (
        <ComponentStatusControl componentNumber={componentNumber} />
      )}

      {/* Questions */}
      {data && !data.gated && (
        <ComponentQuestions
          componentNumber={componentNumber}
          componentTitle={componentDef.title}
          questions={data.questions}
          existingAnswers={data.answers}
          assessmentId={data.assessmentId}
          aiResults={data.aiResults}
        />
      )}

      {/* Evidence Locker (§7123(e)) */}
      {data && !data.gated && data.assessmentId && (
        <EvidenceLocker componentNumber={componentNumber} />
      )}

      {/* Testing + Interview logs (§7123(e) auditor-observed evidence) */}
      {data && !data.gated && data.assessmentId && (
        <AuditorLogs componentNumber={componentNumber} />
      )}

      {/* Prev / Next navigation */}
      <div className="mt-8 flex items-center gap-4 max-w-2xl">
        {prevComponent ? (
          <Link
            href={`/dashboard/assessment/${prevComponent}`}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronLeft size={14} />
            {AUDIT_COMPONENTS[prevComponent - 1]?.title}
          </Link>
        ) : <div />}
        <div className="flex-1" />
        {nextComponent && (
          <Link
            href={`/dashboard/assessment/${nextComponent}`}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {AUDIT_COMPONENTS[nextComponent - 1]?.title}
            <ChevronRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
