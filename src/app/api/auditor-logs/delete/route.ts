/**
 * POST /api/auditor-logs/delete  { kind: 'test'|'interview', id }
 * Removes an auditor work-log entry (org-scoped) and records the removal in the
 * immutable audit trail.
 */

import { NextResponse } from 'next/server';
import { getOrgAndAssessment } from '@/lib/current-assessment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const userId = 'local-user';
  let body: { kind?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const ctx = await getOrgAndAssessment();
  if (!ctx) return NextResponse.json({ error: 'No organization.' }, { status: 404 });
  if (!body.id) return NextResponse.json({ error: 'id required.' }, { status: 400 });

  const { db } = await import('@/db');
  const { testLogs, interviewLogs, auditTrailEntries } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  if (body.kind === 'test') {
    const rows = await db.select().from(testLogs).where(and(eq(testLogs.id, body.id), eq(testLogs.orgId, ctx.orgId))).limit(1);
    if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    await db.delete(testLogs).where(eq(testLogs.id, body.id));
    await db.insert(auditTrailEntries).values({
      assessmentId: rows[0].assessmentId, orgId: ctx.orgId, componentNumber: rows[0].componentNumber, auditorId: userId,
      action: 'test_log_deleted', priorValue: { testName: rows[0].testName },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.kind === 'interview') {
    const rows = await db.select().from(interviewLogs).where(and(eq(interviewLogs.id, body.id), eq(interviewLogs.orgId, ctx.orgId))).limit(1);
    if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    await db.delete(interviewLogs).where(eq(interviewLogs.id, body.id));
    await db.insert(auditTrailEntries).values({
      assessmentId: rows[0].assessmentId, orgId: ctx.orgId, componentNumber: rows[0].componentNumber, auditorId: userId,
      action: 'interview_log_deleted', priorValue: { intervieweeTitle: rows[0].intervieweeTitle },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'kind must be "test" or "interview".' }, { status: 400 });
}
