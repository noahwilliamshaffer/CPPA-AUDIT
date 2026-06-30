/** POST /api/gaps/generate — sync the gap register from current no/partial answers. */
import { NextResponse } from 'next/server';
import { getOrgAndAssessment } from '@/lib/current-assessment';
import { syncGaps, loadGaps } from '@/lib/gaps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  const ctx = await getOrgAndAssessment();
  if (!ctx?.assessmentId) return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });
  const count = await syncGaps(ctx.assessmentId, ctx.orgId);
  return NextResponse.json({ ok: true, count, gaps: await loadGaps(ctx.assessmentId) });
}
