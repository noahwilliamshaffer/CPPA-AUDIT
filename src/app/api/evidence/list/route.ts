/**
 * GET /api/evidence/list?component=N — evidence items for the current
 * assessment, optionally filtered to one component.
 */

import { NextResponse } from 'next/server';
import { getOrgAndAssessment } from '@/lib/current-assessment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const component = Number(new URL(req.url).searchParams.get('component'));
  const ctx = await getOrgAndAssessment();
  if (!ctx?.assessmentId) return NextResponse.json({ items: [] });

  const { db } = await import('@/db');
  const { evidenceItems } = await import('@/db/schema');
  const { eq, and, desc } = await import('drizzle-orm');

  const filters = [eq(evidenceItems.assessmentId, ctx.assessmentId), eq(evidenceItems.orgId, ctx.orgId)];
  if (Number.isFinite(component) && component > 0) filters.push(eq(evidenceItems.componentNumber, component));

  const rows = await db.select().from(evidenceItems).where(and(...filters)).orderBy(desc(evidenceItems.uploadedAt));
  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      fileType: r.fileType,
      fileSizeBytes: r.fileSizeBytes,
      description: r.description,
      componentNumber: r.componentNumber,
      uploadedAt: r.uploadedAt,
      downloadUrl: `/api/evidence/${r.id}/download`,
    })),
  });
}
