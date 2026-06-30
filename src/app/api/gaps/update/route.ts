/**
 * POST /api/gaps/update  { id, remediationPlan?, remediationDue?, status? }
 * Records the auditor's remediation plan / target date / status on a gap, and
 * logs the change in the immutable audit trail.
 */
import { NextResponse } from 'next/server';
import { getOrgAndAssessment } from '@/lib/current-assessment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUSES = new Set(['open', 'in_progress', 'resolved', 'accepted_risk']);

export async function POST(req: Request) {
  const userId = 'local-user';
  let body: { id?: string; remediationPlan?: unknown; remediationDue?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const ctx = await getOrgAndAssessment();
  if (!ctx) return NextResponse.json({ error: 'No organization.' }, { status: 404 });
  if (!body.id) return NextResponse.json({ error: 'id required.' }, { status: 400 });

  const { db } = await import('@/db');
  const { gapRecords, auditTrailEntries } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const rows = await db.select().from(gapRecords).where(and(eq(gapRecords.id, body.id), eq(gapRecords.orgId, ctx.orgId))).limit(1);
  if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const set: { updatedAt: Date; remediationPlan?: string; remediationDue?: string | null; status?: string } = { updatedAt: new Date() };
  if (typeof body.remediationPlan === 'string') set.remediationPlan = body.remediationPlan.slice(0, 5000);
  if (typeof body.remediationDue === 'string') set.remediationDue = body.remediationDue.slice(0, 40) || null;
  if (typeof body.status === 'string' && STATUSES.has(body.status)) set.status = body.status;

  await db.update(gapRecords).set(set).where(eq(gapRecords.id, body.id));
  await db.insert(auditTrailEntries).values({
    assessmentId: rows[0].assessmentId, orgId: ctx.orgId, componentNumber: rows[0].componentNumber, questionId: rows[0].questionId,
    auditorId: userId, action: 'gap_updated',
    priorValue: { status: rows[0].status }, newValue: { status: set.status ?? rows[0].status },
  });

  return NextResponse.json({ ok: true });
}
