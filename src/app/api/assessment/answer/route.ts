/**
 * POST /api/assessment/answer
 * Upserts an auditor's answer for a specific question within an assessment.
 * Also writes an audit trail entry for every change.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  assessmentId: z.string().uuid(),
  questionId: z.string().uuid(),
  response: z.enum(['yes', 'partial', 'no', 'not_applicable']),
  auditorNotes: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues.map(e => e.message).join('; ') : 'Invalid request.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { answers, assessments, auditTrailEntries } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  // Verify assessment belongs to user's org
  const { userRoles } = await import('@/db/schema');
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

  // Read prior answer for audit trail
  const prior = await db
    .select({ response: answers.response, auditorNotes: answers.auditorNotes })
    .from(answers)
    .where(and(eq(answers.assessmentId, body.assessmentId), eq(answers.questionId, body.questionId)))
    .limit(1);

  // Upsert the answer
  await db
    .insert(answers)
    .values({
      assessmentId: body.assessmentId,
      questionId: body.questionId,
      orgId,
      auditorId: userId,
      response: body.response,
      auditorNotes: body.auditorNotes ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [answers.assessmentId, answers.questionId],
      set: {
        response: body.response,
        auditorNotes: body.auditorNotes ?? null,
        updatedAt: new Date(),
      },
    });

  // Append audit trail entry
  await db.insert(auditTrailEntries).values({
    assessmentId: body.assessmentId,
    orgId,
    questionId: body.questionId,
    auditorId: userId,
    action: 'answer_saved',
    priorValue: prior[0] ? { response: prior[0].response, notes: prior[0].auditorNotes } : null,
    newValue: { response: body.response, notes: body.auditorNotes ?? null },
  });

  return NextResponse.json({ ok: true });
}
