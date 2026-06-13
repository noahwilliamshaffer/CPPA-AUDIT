/**
 * POST /api/integrations/jira/push
 *
 * Builds remediation tickets from the current assessment's gap findings and
 * creates them as Jira issues (requires JIRA_* env vars). No-op-safe: returns a
 * clear message when Jira isn't configured or there are no gaps to push.
 */

import { NextResponse } from 'next/server';
import { buildTickets, type TicketFinding } from '@/lib/tickets';
import { getJiraConfig } from '@/lib/integrations/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST() {
  const userId = 'local-user';

  const cfg = getJiraConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: 'Jira is not configured. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY.' },
      { status: 400 }
    );
  }

  const { db } = await import('@/db');
  const { userRoles, assessments, answers, questions } = await import('@/db/schema');
  const { eq, and, desc, inArray } = await import('drizzle-orm');

  const roleRows = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.clerkUserId, userId)).limit(1);
  if (roleRows.length === 0) return NextResponse.json({ error: 'No organization found.' }, { status: 404 });
  const { orgId } = roleRows[0];

  const assessmentRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  if (assessmentRows.length === 0) return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });
  const assessmentId = assessmentRows[0].id;

  const rows = await db
    .select({
      questionId: questions.id,
      componentNumber: questions.componentNumber,
      questionText: questions.questionText,
      riskWeight: questions.riskWeight,
      remediation: questions.remediation,
      response: answers.response,
      auditorNotes: answers.auditorNotes,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(answers.assessmentId, assessmentId), eq(answers.orgId, orgId), inArray(answers.response, ['no', 'partial'])));

  const findings: TicketFinding[] = rows.map(r => ({
    questionId: r.questionId,
    componentNumber: r.componentNumber,
    questionText: r.questionText,
    riskWeight: r.riskWeight,
    response: r.response,
    auditorNotes: r.auditorNotes,
    remediation: r.remediation,
  }));
  const tickets = buildTickets(findings);

  if (tickets.length === 0) {
    return NextResponse.json({ ok: true, created: [], failed: [], message: 'No open remediation items to push.' });
  }

  const { pushTicketsToJira } = await import('@/lib/integrations/jira');
  const result = await pushTicketsToJira(tickets, cfg);

  return NextResponse.json({
    ok: result.failed.length === 0,
    created: result.created,
    failed: result.failed,
    counts: { created: result.created.length, failed: result.failed.length, total: tickets.length },
  });
}
