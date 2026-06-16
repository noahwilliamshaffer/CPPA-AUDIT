/**
 * POST /api/evidence/[id]/delete — remove an evidence file + row, and record the
 * removal in the immutable audit trail (the deletion itself is audited).
 */

import { NextResponse } from 'next/server';
import { getOrgAndAssessment } from '@/lib/current-assessment';
import { deleteEvidence } from '@/lib/evidence-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgAndAssessment();
  if (!ctx) return NextResponse.json({ error: 'No organization.' }, { status: 404 });

  const { db } = await import('@/db');
  const { evidenceItems, auditTrailEntries } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const rows = await db
    .select()
    .from(evidenceItems)
    .where(and(eq(evidenceItems.id, id), eq(evidenceItems.orgId, ctx.orgId)))
    .limit(1);
  if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const item = rows[0];

  await db.delete(evidenceItems).where(eq(evidenceItems.id, id));
  deleteEvidence(item.fileUrl);

  await db.insert(auditTrailEntries).values({
    assessmentId: item.assessmentId,
    orgId: ctx.orgId,
    componentNumber: item.componentNumber,
    questionId: item.questionId,
    auditorId: 'local-user',
    action: 'evidence_deleted',
    priorValue: { fileName: item.fileName },
    evidenceIds: JSON.stringify([id]),
  });

  return NextResponse.json({ ok: true });
}
