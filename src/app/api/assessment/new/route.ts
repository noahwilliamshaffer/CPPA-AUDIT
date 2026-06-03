/**
 * POST /api/assessment/new
 *
 * Creates a new draft assessment for the local org.
 * The previous assessment is NOT deleted — it is archived (status stays as-is).
 * The new assessment becomes the active one since queries sort by created_at DESC.
 */

import { NextResponse } from 'next/server';

export async function POST(): Promise<NextResponse> {
  const userId = 'local-user';

  try {
    const { db } = await import('@/db');
    const { userRoles, assessments, eligibilityResults } = await import('@/db/schema');
    const { eq, desc } = await import('drizzle-orm');

    // Find the org for the local user
    const roleRows = await db
      .select({ orgId: userRoles.orgId })
      .from(userRoles)
      .where(eq(userRoles.clerkUserId, userId))
      .limit(1);

    if (roleRows.length === 0) {
      return NextResponse.json({ error: 'No organization found.' }, { status: 404 });
    }

    const { orgId } = roleRows[0];

    // Get existing revenue tier from most recent eligibility result
    const eligRows = await db
      .select({ revenueTier: eligibilityResults.revenueTier })
      .from(eligibilityResults)
      .where(eq(eligibilityResults.orgId, orgId))
      .orderBy(desc(eligibilityResults.createdAt))
      .limit(1);

    const revenueTier = eligRows[0]?.revenueTier ?? null;

    const year = new Date().getFullYear();
    const auditPeriodStart = `${year}-01-01`;
    const auditPeriodEnd   = `${year}-12-31`;

    const deadline = new Date();
    deadline.setFullYear(deadline.getFullYear() + 1);
    const submissionDeadline = deadline.toISOString().split('T')[0];

    // Create the new assessment
    const [newAssessment] = await db
      .insert(assessments)
      .values({
        orgId,
        auditPeriodStart,
        auditPeriodEnd,
        status: 'draft',
        auditorId: userId,
      })
      .returning({ id: assessments.id });

    // Provision a fresh eligibility result for the new assessment
    await db.insert(eligibilityResults).values({
      assessmentId: newAssessment.id,
      orgId,
      covered: true,
      triggerFired: 'revenue',
      revenueTier,
      submissionDeadline,
    });

    return NextResponse.json({ assessmentId: newAssessment.id, success: true }, { status: 201 });
  } catch (err) {
    console.error('[assessment/new] Error:', err);
    return NextResponse.json({ error: 'Failed to create new assessment.' }, { status: 500 });
  }
}
