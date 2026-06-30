/**
 * POST /api/assessment/answer
 * Upserts an auditor's answer for a specific question within an assessment.
 * Also writes an audit trail entry for every change.
 *
 * Question IDs are regulatory codes (e.g. 'Q-01', 'A-04a'), not UUIDs.
 * `response` is validated against the question's answerType / options.
 * A manual save always clears any prior AI-generated flags — once a human
 * picks a response it is the auditor's answer, not the AI's suggestion.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  assessmentId: z.string(),
  questionId: z.string(),
  response: z.string().min(1).max(100),
  responseText: z.string().max(5000).optional(),
  auditorNotes: z.string().max(2000).optional(),
});

const STANDARD_OPTIONS: Record<string, string[]> = {
  yes_partial_no_na: ['yes', 'partial', 'no', 'not_applicable'],
  yes_no: ['yes', 'no'],
  yes_no_na: ['yes', 'no', 'not_applicable'],
};

export async function POST(req: Request) {
  const userId = 'local-user';

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues.map(e => e.message).join('; ') : 'Invalid request.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { answers, assessments, auditTrailEntries, questions, userRoles, componentApplicability } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  // Verify assessment belongs to user's org
  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, userId))
    .limit(1);
  if (roleRows.length === 0) return NextResponse.json({ error: 'No org found.' }, { status: 404 });
  const { orgId } = roleRows[0];

  const assessmentRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(and(eq(assessments.id, body.assessmentId), eq(assessments.orgId, orgId)))
    .limit(1);
  if (assessmentRows.length === 0) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });

  // Look up the question to validate the response against its answer type
  const qRows = await db
    .select({ answerType: questions.answerType, options: questions.options })
    .from(questions)
    .where(eq(questions.id, body.questionId))
    .limit(1);
  if (qRows.length === 0) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

  const answerType = qRows[0].answerType ?? 'yes_partial_no_na';
  const options = (qRows[0].options ?? null) as { value: string; label: string }[] | null;

  let allowed: string[];
  if (answerType === 'open_text') {
    allowed = ['open_text'];
  } else if (answerType === 'choice') {
    allowed = Array.isArray(options) ? options.map(o => o.value) : [];
  } else {
    allowed = STANDARD_OPTIONS[answerType] ?? STANDARD_OPTIONS.yes_partial_no_na;
  }

  if (!allowed.includes(body.response)) {
    return NextResponse.json({ error: 'Invalid response for this question type.' }, { status: 400 });
  }
  if (answerType === 'open_text' && !body.responseText?.trim()) {
    return NextResponse.json({ error: 'Response text is required for this question.' }, { status: 400 });
  }

  // Read prior answer for audit trail
  const prior = await db
    .select({ response: answers.response, responseText: answers.responseText, auditorNotes: answers.auditorNotes })
    .from(answers)
    .where(and(eq(answers.assessmentId, body.assessmentId), eq(answers.questionId, body.questionId)))
    .limit(1);

  const responseText = answerType === 'open_text' ? (body.responseText ?? null) : null;

  // Upsert the answer — a manual save clears any AI-generated metadata.
  await db
    .insert(answers)
    .values({
      assessmentId: body.assessmentId,
      questionId: body.questionId,
      orgId,
      auditorId: userId,
      response: body.response,
      responseText,
      auditorNotes: body.auditorNotes ?? null,
      updatedAt: new Date(),
      aiGenerated: false,
      aiConfidence: null,
      aiReasoning: null,
      needsClientReview: false,
    })
    .onConflictDoUpdate({
      target: [answers.assessmentId, answers.questionId],
      set: {
        response: body.response,
        responseText,
        auditorNotes: body.auditorNotes ?? null,
        updatedAt: new Date(),
        aiGenerated: false,
        aiConfidence: null,
        aiReasoning: null,
        needsClientReview: false,
      },
    });

  // Append audit trail entry
  await db.insert(auditTrailEntries).values({
    assessmentId: body.assessmentId,
    orgId,
    questionId: body.questionId,
    auditorId: userId,
    action: 'answer_saved',
    priorValue: prior[0]
      ? { response: prior[0].response, responseText: prior[0].responseText, notes: prior[0].auditorNotes }
      : null,
    newValue: { response: body.response, responseText, notes: body.auditorNotes ?? null },
  });

  // ADMT gate (A-01, §7001(ddd)): drives the assessment's uses_admt flag and
  // component-19 applicability. If the business doesn't use ADMT for significant
  // decisions, component 19 is Not Applicable (excluded from scoring) and its
  // §7200–7222 sub-questions stay hidden.
  if (body.questionId === 'A-01') {
    const usesAdmt = body.response === 'yes';
    await db.update(assessments).set({ usesAdmt }).where(eq(assessments.id, body.assessmentId));

    const existingApp = await db
      .select({ id: componentApplicability.id })
      .from(componentApplicability)
      .where(and(eq(componentApplicability.assessmentId, body.assessmentId), eq(componentApplicability.componentNumber, 19)))
      .limit(1);
    if (existingApp.length > 0) {
      await db
        .update(componentApplicability)
        .set({ applicable: usesAdmt, markedAt: new Date() })
        .where(eq(componentApplicability.id, existingApp[0].id));
    } else {
      await db.insert(componentApplicability).values({
        assessmentId: body.assessmentId, componentNumber: 19, applicable: usesAdmt, completed: false, auditorId: userId,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/assessment/answer
 * Clears an answer — used when a conditional question becomes hidden because
 * its parent's response changed (e.g. Q-02 flipped from Yes to No hides Q-02a-c).
 * Removing the row keeps scoring and progress consistent with what's actually shown.
 */
const deleteSchema = z.object({
  assessmentId: z.string(),
  questionId: z.string(),
});

export async function DELETE(req: Request) {
  const userId = 'local-user';

  let body: z.infer<typeof deleteSchema>;
  try {
    body = deleteSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { answers, assessments, auditTrailEntries, userRoles } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, userId))
    .limit(1);
  if (roleRows.length === 0) return NextResponse.json({ error: 'No org found.' }, { status: 404 });
  const { orgId } = roleRows[0];

  const assessmentRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(and(eq(assessments.id, body.assessmentId), eq(assessments.orgId, orgId)))
    .limit(1);
  if (assessmentRows.length === 0) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });

  const prior = await db
    .select({ response: answers.response, responseText: answers.responseText, auditorNotes: answers.auditorNotes })
    .from(answers)
    .where(and(eq(answers.assessmentId, body.assessmentId), eq(answers.questionId, body.questionId)))
    .limit(1);

  if (prior.length === 0) {
    return NextResponse.json({ ok: true, cleared: false });
  }

  await db
    .delete(answers)
    .where(and(eq(answers.assessmentId, body.assessmentId), eq(answers.questionId, body.questionId)));

  await db.insert(auditTrailEntries).values({
    assessmentId: body.assessmentId,
    orgId,
    questionId: body.questionId,
    auditorId: userId,
    action: 'answer_cleared',
    priorValue: { response: prior[0].response, responseText: prior[0].responseText, notes: prior[0].auditorNotes },
    newValue: null,
  });

  return NextResponse.json({ ok: true, cleared: true });
}
