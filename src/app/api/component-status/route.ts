/**
 * Component applicability + completion (§7123(c): the auditor marks each
 * component Applicable / Not Applicable, and may mark it complete).
 *
 * GET  /api/component-status[?component=N] → [{ componentNumber, applicable, completed }]
 * POST /api/component-status { component, applicable?, completed? } → upsert
 */

import { NextResponse } from 'next/server';
import { getOrgAndAssessment } from '@/lib/current-assessment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const component = Number(new URL(req.url).searchParams.get('component'));
  const ctx = await getOrgAndAssessment();
  if (!ctx?.assessmentId) return NextResponse.json({ statuses: [] });

  const { db } = await import('@/db');
  const { componentApplicability } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const where = Number.isFinite(component) && component > 0
    ? and(eq(componentApplicability.assessmentId, ctx.assessmentId), eq(componentApplicability.componentNumber, component))
    : eq(componentApplicability.assessmentId, ctx.assessmentId);

  const rows = await db
    .select({ componentNumber: componentApplicability.componentNumber, applicable: componentApplicability.applicable, completed: componentApplicability.completed })
    .from(componentApplicability)
    .where(where);

  return NextResponse.json({ statuses: rows });
}

export async function POST(req: Request) {
  const userId = 'local-user';
  let body: { component?: number; applicable?: boolean; completed?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const component = Number(body.component);
  if (!Number.isFinite(component) || component < 1 || component > 19) {
    return NextResponse.json({ error: 'Invalid component.' }, { status: 400 });
  }

  const ctx = await getOrgAndAssessment();
  if (!ctx?.assessmentId) return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });

  const { db } = await import('@/db');
  const { componentApplicability, auditTrailEntries } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const existing = await db
    .select()
    .from(componentApplicability)
    .where(and(eq(componentApplicability.assessmentId, ctx.assessmentId), eq(componentApplicability.componentNumber, component)))
    .limit(1);

  const applicable = body.applicable ?? existing[0]?.applicable ?? true;
  const completed = body.completed ?? existing[0]?.completed ?? false;

  if (existing.length > 0) {
    await db
      .update(componentApplicability)
      .set({ applicable, completed, markedAt: new Date() })
      .where(eq(componentApplicability.id, existing[0].id));
  } else {
    await db.insert(componentApplicability).values({
      assessmentId: ctx.assessmentId, componentNumber: component, applicable, completed, auditorId: userId,
    });
  }

  await db.insert(auditTrailEntries).values({
    assessmentId: ctx.assessmentId, orgId: ctx.orgId, componentNumber: component, auditorId: userId,
    action: 'component_status_set', newValue: { applicable, completed },
  });

  return NextResponse.json({ ok: true, applicable, completed });
}
