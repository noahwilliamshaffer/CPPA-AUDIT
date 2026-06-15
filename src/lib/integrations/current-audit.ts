/**
 * Loads the current org's latest assessment and its open remediation tickets —
 * the shared data source for the publish/upload integrations (Confluence,
 * Notion, S3). Mirrors the data-loading in /api/integrations/jira/push.
 */

import 'server-only';
import { buildTickets, type RemediationTicket, type TicketFinding } from '@/lib/tickets';

export interface CurrentAudit {
  orgId: string;
  orgName: string;
  assessmentId: string;
  tickets: RemediationTicket[];
}

export async function loadCurrentAudit(userId = 'local-user'): Promise<CurrentAudit | null> {
  const { db } = await import('@/db');
  const { organizations, userRoles, assessments, answers, questions } = await import('@/db/schema');
  const { eq, and, desc, inArray } = await import('drizzle-orm');

  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, userId))
    .limit(1);
  if (roleRows.length === 0) return null;
  const { orgId } = roleRows[0];

  const orgRows = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const orgName = orgRows[0]?.name ?? 'Organization';

  const aRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  if (aRows.length === 0) return null;
  const assessmentId = aRows[0].id;

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

  const findings: TicketFinding[] = rows.map((r) => ({
    questionId: r.questionId,
    componentNumber: r.componentNumber,
    questionText: r.questionText,
    riskWeight: r.riskWeight,
    response: r.response,
    auditorNotes: r.auditorNotes,
    remediation: r.remediation,
  }));

  return { orgId, orgName, assessmentId, tickets: buildTickets(findings) };
}
