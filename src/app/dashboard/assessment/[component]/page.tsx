export const dynamic = 'force-dynamic';

/**
 * /dashboard/assessment/[component] — questions for a single §7123(c) component.
 * Server renders current answer state; client component handles answer submission.
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AUDIT_COMPONENTS } from '@/lib/components';
import ComponentQuestions from './ComponentQuestions';

interface PageProps {
  params: Promise<{ component: string }>;
}

async function fetchComponentData(clerkUserId: string, componentNumber: number) {
  const { db } = await import('@/db');
  const { userRoles, assessments, eligibilityResults, questions, answers } = await import('@/db/schema');
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
  if (!eligRows[0]?.covered) return { gated: true, orgId, assessmentId: null, questions: [], answers: [] };

  // Get most recent assessment
  const assessmentRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  const assessmentId = assessmentRows[0]?.id ?? null;

  // Fetch questions for this component
  const componentQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.componentNumber, componentNumber))
    .orderBy(questions.displayOrder);

  // Fetch existing answers if assessment exists
  const existingAnswers = assessmentId
    ? await db
        .select()
        .from(answers)
        .where(
          and(
            eq(answers.assessmentId, assessmentId),
            eq(answers.orgId, orgId)
          )
        )
    : [];

  return {
    gated: false,
    orgId,
    assessmentId,
    questions: componentQuestions,
    answers: existingAnswers,
  };
}

export default async function ComponentPage({ params }: PageProps) {
  const userId = 'local-user';

  const { component } = await params;
  const componentNumber = parseInt(component, 10);
  if (isNaN(componentNumber) || componentNumber < 1 || componentNumber > 18) notFound();

  const componentDef = AUDIT_COMPONENTS.find(c => c.number === componentNumber);
  if (!componentDef) notFound();

  let data: Awaited<ReturnType<typeof fetchComponentData>> = null;
  try {
    data = await fetchComponentData(userId, componentNumber);
  } catch {
    // DB unavailable
  }

  const prevComponent = componentNumber > 1 ? componentNumber - 1 : null;
  const nextComponent = componentNumber < 18 ? componentNumber + 1 : null;

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
        <span className="text-xs text-slate-400">§7123(c)({componentNumber})</span>
      </div>

      {/* Header */}
      <div className="mb-6 max-w-2xl">
        <p className="font-mono text-xs text-teal-400 mb-1">§7123(c)({componentNumber})</p>
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

      {/* Questions */}
      {data && !data.gated && (
        <ComponentQuestions
          componentNumber={componentNumber}
          componentTitle={componentDef.title}
          questions={data.questions}
          existingAnswers={data.answers}
          assessmentId={data.assessmentId}
        />
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
