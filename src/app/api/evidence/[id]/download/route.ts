/**
 * GET /api/evidence/[id]/download — stream an evidence file from the /data
 * volume (org-scoped lookup).
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { getOrgAndAssessment } from '@/lib/current-assessment';
import { resolveEvidencePath } from '@/lib/evidence-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgAndAssessment();
  if (!ctx) return NextResponse.json({ error: 'No organization.' }, { status: 404 });

  const { db } = await import('@/db');
  const { evidenceItems } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const rows = await db
    .select()
    .from(evidenceItems)
    .where(and(eq(evidenceItems.id, id), eq(evidenceItems.orgId, ctx.orgId)))
    .limit(1);
  if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const item = rows[0];

  let buf: Buffer;
  try {
    buf = fs.readFileSync(resolveEvidencePath(item.fileUrl));
  } catch {
    return NextResponse.json({ error: 'File missing on disk.' }, { status: 410 });
  }

  const body = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) as unknown as BodyInit;
  return new NextResponse(body, {
    headers: {
      'Content-Type': item.fileType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${item.fileName.replace(/"/g, '')}"`,
      'Content-Length': String(buf.length),
    },
  });
}
