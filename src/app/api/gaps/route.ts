/** GET /api/gaps — persistent gap register for the current assessment. */
import { NextResponse } from 'next/server';
import { getOrgAndAssessment } from '@/lib/current-assessment';
import { loadGaps } from '@/lib/gaps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const ctx = await getOrgAndAssessment();
  if (!ctx?.assessmentId) return NextResponse.json({ gaps: [] });
  return NextResponse.json({ gaps: await loadGaps(ctx.assessmentId) });
}
