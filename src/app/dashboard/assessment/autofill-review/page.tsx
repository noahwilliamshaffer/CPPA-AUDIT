export const dynamic = 'force-dynamic';

/**
 * /dashboard/assessment/autofill-review — ADD-17 review gate.
 * Shows the AI's NIST 800-53 document summary and per-question suggestions for
 * the auditor to accept or override before anything is written to the answers
 * table. Only reachable when the latest autofill session is 'complete'.
 */

import { redirect } from 'next/navigation';
import { AUDIT_COMPONENTS } from '@/lib/components';
import AutofillReview from './AutofillReview';

interface RawResult {
  questionId: string;
  suggestedAnswer: string | null;
  confidence: string | null;
  reasoning: string | null;
  sourceDocuments?: string[];
  needsReview: boolean;
}

async function load(userId: string) {
  const { db } = await import('@/db');
  const { userRoles, assessments, questions, aiAutofillSessions } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const roleRows = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.clerkUserId, userId)).limit(1);
  if (roleRows.length === 0) return { ok: false as const, redirectTo: '/dashboard/assessment/document-upload' };
  const { orgId } = roleRows[0];

  const assessmentRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  if (assessmentRows.length === 0) return { ok: false as const, redirectTo: '/dashboard/assessment/document-upload' };
  const assessmentId = assessmentRows[0].id;

  const sessionRows = await db
    .select({
      status: aiAutofillSessions.status,
      nistSummaryText: aiAutofillSessions.nistSummaryText,
      autofillResults: aiAutofillSessions.autofillResults,
      documentsUploaded: aiAutofillSessions.documentsUploaded,
    })
    .from(aiAutofillSessions)
    .where(eq(aiAutofillSessions.assessmentId, assessmentId))
    .orderBy(desc(aiAutofillSessions.createdAt))
    .limit(1);

  if (sessionRows.length === 0) return { ok: false as const, redirectTo: '/dashboard/assessment/document-upload' };
  const session = sessionRows[0];
  if (session.status !== 'complete') return { ok: false as const, redirectTo: '/dashboard/assessment' };

  const qRows = await db
    .select({
      id: questions.id,
      componentNumber: questions.componentNumber,
      questionText: questions.questionText,
      riskWeight: questions.riskWeight,
      answerType: questions.answerType,
      displayOrder: questions.displayOrder,
      options: questions.options,
    })
    .from(questions)
    .orderBy(questions.displayOrder);

  const metaById = new Map(qRows.map(q => [q.id, q]));
  const results = (session.autofillResults as RawResult[] | null) ?? [];

  const items = results
    .filter(r => metaById.has(r.questionId))
    .map(r => {
      const m = metaById.get(r.questionId)!;
      return {
        questionId: r.questionId,
        componentNumber: m.componentNumber,
        questionText: m.questionText,
        riskWeight: m.riskWeight,
        answerType: (m.answerType ?? 'yes_partial_no_na') as string,
        options: (m.options as { value: string; label: string }[] | null) ?? null,
        displayOrder: m.displayOrder,
        suggestedAnswer: r.suggestedAnswer ?? null,
        confidence: r.confidence ?? null,
        reasoning: r.reasoning ?? null,
        sourceDocuments: r.sourceDocuments ?? [],
        needsReview: !!r.needsReview,
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);

  let nistSummary: {
    controlFamilySummaries: Record<string, string | null>;
    documentCoverage: Record<string, string[]>;
    overallReadabilityAssessment: string;
  } | null = null;
  if (session.nistSummaryText) {
    try { nistSummary = JSON.parse(session.nistSummaryText); } catch { nistSummary = null; }
  }

  const components = AUDIT_COMPONENTS.map(c => ({ number: c.number, title: c.title, citation: c.citation }));

  return { ok: true as const, items, nistSummary, components };
}

export default async function AutofillReviewPage() {
  const userId = 'local-user';

  let result: Awaited<ReturnType<typeof load>> | null = null;
  try {
    result = await load(userId);
  } catch {
    redirect('/dashboard/assessment');
  }

  if (!result || !result.ok) {
    redirect(result?.redirectTo ?? '/dashboard/assessment');
  }

  return <AutofillReview items={result.items} nistSummary={result.nistSummary} components={result.components} />;
}
