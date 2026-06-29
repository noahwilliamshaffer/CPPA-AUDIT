/**
 * Auditor work logs — Testing Log (Action B) and Interview Log (Action C) per
 * §7123(e). The auditor records tests conducted and interviews held for each
 * component; these feed the audit report and demonstrate auditor-observed
 * evidence (not management attestation).
 *
 * GET  /api/auditor-logs?component=N  → { tests:[...], interviews:[...] }
 * POST /api/auditor-logs              → create one (body.kind = 'test'|'interview')
 */

import { NextResponse } from 'next/server';
import { getOrgAndAssessment } from '@/lib/current-assessment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RESULTS = new Set(['pass', 'fail', 'partial']);

export async function GET(req: Request) {
  const component = Number(new URL(req.url).searchParams.get('component'));
  const ctx = await getOrgAndAssessment();
  if (!ctx?.assessmentId) return NextResponse.json({ tests: [], interviews: [] });

  const { db } = await import('@/db');
  const { testLogs, interviewLogs } = await import('@/db/schema');
  const { eq, and, desc } = await import('drizzle-orm');

  const compFilter = Number.isFinite(component) && component > 0;
  const tWhere = compFilter
    ? and(eq(testLogs.assessmentId, ctx.assessmentId), eq(testLogs.componentNumber, component))
    : eq(testLogs.assessmentId, ctx.assessmentId);
  const iWhere = compFilter
    ? and(eq(interviewLogs.assessmentId, ctx.assessmentId), eq(interviewLogs.componentNumber, component))
    : eq(interviewLogs.assessmentId, ctx.assessmentId);

  const [tests, interviews] = await Promise.all([
    db.select().from(testLogs).where(tWhere).orderBy(desc(testLogs.createdAt)),
    db.select().from(interviewLogs).where(iWhere).orderBy(desc(interviewLogs.createdAt)),
  ]);

  return NextResponse.json({ tests, interviews });
}

export async function POST(req: Request) {
  const userId = 'local-user';
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const ctx = await getOrgAndAssessment();
  if (!ctx?.assessmentId) return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });

  const kind = String(body.kind ?? '');
  const component = Number(body.component);
  if (!Number.isFinite(component) || component < 1 || component > 19) {
    return NextResponse.json({ error: 'Invalid component.' }, { status: 400 });
  }
  const str = (v: unknown, n = 2000) => String(v ?? '').trim().slice(0, n);

  const { db } = await import('@/db');
  const { testLogs, interviewLogs, auditTrailEntries } = await import('@/db/schema');

  if (kind === 'test') {
    const testName = str(body.testName, 200);
    const methodology = str(body.methodology);
    const result = str(body.result, 20).toLowerCase();
    const conductedAt = str(body.conductedAt, 40);
    const findings = str(body.findings, 5000);
    if (!testName || !methodology || !RESULTS.has(result) || !conductedAt || !findings) {
      return NextResponse.json({ error: 'Test name, methodology, result (pass/fail/partial), date, and findings are required.' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await db.insert(testLogs).values({
      id, assessmentId: ctx.assessmentId, orgId: ctx.orgId, componentNumber: component,
      testName, methodology, result, conductedAt, findings, auditorId: userId,
    });
    await db.insert(auditTrailEntries).values({
      assessmentId: ctx.assessmentId, orgId: ctx.orgId, componentNumber: component, auditorId: userId,
      action: 'test_log_added', newValue: { testName, result },
    });
    return NextResponse.json({ ok: true, id });
  }

  if (kind === 'interview') {
    // Interviewee TITLE only — never a name (privacy, per spec).
    const intervieweeTitle = str(body.intervieweeTitle, 200);
    const interviewDate = str(body.interviewDate, 40);
    const topics = str(body.topics, 2000);
    const findings = str(body.findings, 5000);
    if (!intervieweeTitle || !interviewDate || !topics || !findings) {
      return NextResponse.json({ error: 'Interviewee title, date, topics, and findings are required.' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await db.insert(interviewLogs).values({
      id, assessmentId: ctx.assessmentId, orgId: ctx.orgId, componentNumber: component,
      intervieweeTitle, interviewDate, topics, findings, auditorId: userId,
    });
    await db.insert(auditTrailEntries).values({
      assessmentId: ctx.assessmentId, orgId: ctx.orgId, componentNumber: component, auditorId: userId,
      action: 'interview_log_added', newValue: { intervieweeTitle },
    });
    return NextResponse.json({ ok: true, id });
  }

  return NextResponse.json({ error: 'kind must be "test" or "interview".' }, { status: 400 });
}
