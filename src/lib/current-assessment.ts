/**
 * Lightweight lookup of the current org + latest assessment id (offline
 * local-user). Shared by routes that don't need the full ticket load.
 */

import 'server-only';

export interface OrgAssessment {
  orgId: string;
  assessmentId: string | null;
}

export async function getOrgAndAssessment(userId = 'local-user'): Promise<OrgAssessment | null> {
  const { db } = await import('@/db');
  const { userRoles, assessments } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const roleRows = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.clerkUserId, userId)).limit(1);
  if (roleRows.length === 0) return null;
  const { orgId } = roleRows[0];

  const aRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  return { orgId, assessmentId: aRows[0]?.id ?? null };
}
