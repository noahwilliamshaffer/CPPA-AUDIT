/**
 * GET /api/tickets/export?format=csv|json|md
 *
 * Exports remediation tickets derived from the current assessment's gap findings
 * (answers marked No / Partial) in a format the client's tooling can ingest:
 *   csv  → Jira / Smartsheet / SharePoint import
 *   json → generic API ingestion
 *   md   → Confluence
 */

import { NextResponse } from 'next/server';
import { buildTickets, ticketsToCsv, ticketsToJson, ticketsToMarkdown, type TicketFinding } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

const FORMATS = {
  csv: { ext: 'csv', type: 'text/csv; charset=utf-8' },
  json: { ext: 'json', type: 'application/json; charset=utf-8' },
  md: { ext: 'md', type: 'text/markdown; charset=utf-8' },
} as const;
type Format = keyof typeof FORMATS;

export async function GET(req: Request) {
  const userId = 'local-user';
  const url = new URL(req.url);
  const formatParam = (url.searchParams.get('format') ?? 'csv').toLowerCase();
  const format: Format = formatParam in FORMATS ? (formatParam as Format) : 'csv';

  const { db } = await import('@/db');
  const { userRoles, organizations, assessments, answers, questions } = await import('@/db/schema');
  const { eq, and, desc, inArray } = await import('drizzle-orm');

  const roleRows = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.clerkUserId, userId)).limit(1);
  if (roleRows.length === 0) return NextResponse.json({ error: 'No organization found.' }, { status: 404 });
  const { orgId } = roleRows[0];

  const orgRows = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const orgName = orgRows[0]?.name ?? 'Organization';

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

  let body: string;
  if (format === 'json') body = ticketsToJson(tickets);
  else if (format === 'md') body = ticketsToMarkdown(tickets, orgName);
  else body = ticketsToCsv(tickets);

  const slug = orgName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const fileName = `ShieldAudit-Remediation-Tickets-${slug}.${FORMATS[format].ext}`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': FORMATS[format].type,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
