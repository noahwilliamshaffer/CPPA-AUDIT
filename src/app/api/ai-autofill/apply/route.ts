/**
 * POST /api/ai-autofill/apply
 *
 * Writes the auditor's accepted / overridden AI suggestions into the standard
 * `answers` table (flagged aiGenerated), logs each as 'ai_autofill_accepted' or
 * 'ai_autofill_overridden' in the immutable audit trail, and records review
 * counts on the autofill session. Confidence + reasoning are taken from the
 * stored session — the client only sends the final response per question.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  items: z.array(
    z.object({
      questionId: z.string(),
      response: z.string().min(1).max(100),
      responseText: z.string().max(5000).optional(),
      auditorNotes: z.string().max(2000).optional(),
      overridden: z.boolean().default(false),
    })
  ).min(1),
});

const STANDARD_OPTIONS: Record<string, string[]> = {
  yes_partial_no_na: ['yes', 'partial', 'no', 'not_applicable'],
  yes_no: ['yes', 'no'],
  yes_no_na: ['yes', 'no', 'not_applicable'],
};

interface SessionResult {
  questionId: string;
  confidence: string | null;
  reasoning: string | null;
}

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
  const { userRoles, assessments, answers, questions, auditTrailEntries, aiAutofillSessions } = await import('@/db/schema');
  const { eq, desc, and, inArray } = await import('drizzle-orm');

  const roleRows = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.clerkUserId, userId)).limit(1);
  if (roleRows.length === 0) return NextResponse.json({ error: 'No org found.' }, { status: 404 });
  const { orgId } = roleRows[0];

  const assessmentRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  if (assessmentRows.length === 0) return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });
  const assessmentId = assessmentRows[0].id;

  // Latest session — source of truth for AI confidence/reasoning
  const sessionRows = await db
    .select({ id: aiAutofillSessions.id, autofillResults: aiAutofillSessions.autofillResults })
    .from(aiAutofillSessions)
    .where(eq(aiAutofillSessions.assessmentId, assessmentId))
    .orderBy(desc(aiAutofillSessions.createdAt))
    .limit(1);
  if (sessionRows.length === 0) return NextResponse.json({ error: 'No autofill session found.' }, { status: 404 });

  const resultsById = new Map<string, SessionResult>();
  for (const r of (sessionRows[0].autofillResults as SessionResult[] | null) ?? []) {
    if (r?.questionId) resultsById.set(r.questionId, r);
  }

  // Question metadata for validation
  const ids = body.items.map(i => i.questionId);
  const qRows = await db
    .select({ id: questions.id, answerType: questions.answerType, options: questions.options })
    .from(questions)
    .where(inArray(questions.id, ids));
  const qMeta = new Map(qRows.map(q => [q.id, { answerType: q.answerType ?? 'yes_partial_no_na', options: (q.options as { value: string; label: string }[] | null) }]));

  let acceptedCount = 0;
  let overriddenCount = 0;
  const skipped: string[] = [];

  for (const item of body.items) {
    const meta = qMeta.get(item.questionId);
    if (!meta) { skipped.push(item.questionId); continue; }

    let allowed: string[];
    if (meta.answerType === 'open_text') allowed = ['open_text'];
    else if (meta.answerType === 'choice') allowed = Array.isArray(meta.options) ? meta.options.map(o => o.value) : [];
    else allowed = STANDARD_OPTIONS[meta.answerType] ?? STANDARD_OPTIONS.yes_partial_no_na;

    if (!allowed.includes(item.response)) { skipped.push(item.questionId); continue; }

    const result = resultsById.get(item.questionId);
    const responseText = meta.answerType === 'open_text' ? (item.responseText ?? null) : null;

    const prior = await db
      .select({ response: answers.response, auditorNotes: answers.auditorNotes })
      .from(answers)
      .where(and(eq(answers.assessmentId, assessmentId), eq(answers.questionId, item.questionId)))
      .limit(1);

    await db
      .insert(answers)
      .values({
        assessmentId,
        questionId: item.questionId,
        orgId,
        auditorId: userId,
        response: item.response,
        responseText,
        auditorNotes: item.auditorNotes ?? null,
        updatedAt: new Date(),
        aiGenerated: true,
        aiConfidence: result?.confidence ?? null,
        aiReasoning: result?.reasoning ?? null,
        needsClientReview: false,
      })
      .onConflictDoUpdate({
        target: [answers.assessmentId, answers.questionId],
        set: {
          response: item.response,
          responseText,
          auditorNotes: item.auditorNotes ?? null,
          updatedAt: new Date(),
          aiGenerated: true,
          aiConfidence: result?.confidence ?? null,
          aiReasoning: result?.reasoning ?? null,
          needsClientReview: false,
        },
      });

    await db.insert(auditTrailEntries).values({
      assessmentId,
      orgId,
      questionId: item.questionId,
      auditorId: userId,
      action: item.overridden ? 'ai_autofill_overridden' : 'ai_autofill_accepted',
      priorValue: prior[0] ? { response: prior[0].response, notes: prior[0].auditorNotes } : null,
      newValue: { response: item.response, responseText, aiConfidence: result?.confidence ?? null },
    });

    if (item.overridden) overriddenCount++; else acceptedCount++;
  }

  await db
    .update(aiAutofillSessions)
    .set({ auditorReviewedAt: new Date(), auditorAcceptedCount: acceptedCount, auditorOverriddenCount: overriddenCount })
    .where(eq(aiAutofillSessions.id, sessionRows[0].id));

  return NextResponse.json({ ok: true, acceptedCount, overriddenCount, skipped });
}
