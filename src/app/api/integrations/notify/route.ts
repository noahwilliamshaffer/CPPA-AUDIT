/**
 * POST /api/integrations/notify
 *
 * Sends an audit summary to every configured channel (Slack / Teams / generic
 * webhook). Returns a clear message when no notifier is configured.
 */

import { NextResponse } from 'next/server';
import { anyNotifierConfigured } from '@/lib/integrations/config';
import { sendNotifications } from '@/lib/integrations/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const userId = 'local-user';

  if (!anyNotifierConfigured()) {
    return NextResponse.json(
      { error: 'No notifier configured. Set SLACK_WEBHOOK_URL, TEAMS_WEBHOOK_URL, or WEBHOOK_URL.' },
      { status: 400 }
    );
  }

  const { db } = await import('@/db');
  const { userRoles, organizations, assessments, answers, componentScores } = await import('@/db/schema');
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

  const scoreRows = await db
    .select({ score: componentScores.score, status: componentScores.status })
    .from(componentScores)
    .where(eq(componentScores.assessmentId, assessmentId));

  const scored = scoreRows.length;
  const overall = scored > 0 ? Math.round(scoreRows.reduce((s, r) => s + r.score, 0) / scored) : null;
  const green = scoreRows.filter(r => r.status === 'green').length;
  const yellow = scoreRows.filter(r => r.status === 'yellow').length;
  const red = scoreRows.filter(r => r.status === 'red').length;

  const gapRows = await db
    .select({ id: answers.id })
    .from(answers)
    .where(and(eq(answers.assessmentId, assessmentId), eq(answers.orgId, orgId), inArray(answers.response, ['no', 'partial'])));
  const ticketCount = gapRows.length;

  const text =
    `ShieldAudit — ${orgName}: CPPA §7123 cybersecurity audit. ` +
    (overall !== null
      ? `Overall ${overall}/100 — ${green} compliant, ${yellow} partial, ${red} non-compliant across ${scored} components. `
      : `Not yet scored. `) +
    `${ticketCount} open remediation item(s).`;

  const results = await sendNotifications(text, { orgName, overall, green, yellow, red, ticketCount });

  return NextResponse.json({ ok: results.every(r => r.ok), results, text });
}
