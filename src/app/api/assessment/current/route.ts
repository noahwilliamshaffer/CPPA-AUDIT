/**
 * GET  /api/assessment/current — returns the org's most recent draft/in-progress assessment
 * POST /api/assessment/current — creates a new assessment if none exists in draft state
 */

import { NextResponse } from 'next/server';

async function resolveOrg(userId: string) {
  const { db } = await import('@/db');
  const { userRoles } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, userId))
    .limit(1);
  return rows[0]?.orgId ?? null;
}

export async function GET() {
  const userId = 'local-user';
  

  const orgId = await resolveOrg(userId);
  if (!orgId) return NextResponse.json({ error: 'No organization found.' }, { status: 404 });

  const { db } = await import('@/db');
  const { assessments, eligibilityResults } = await import('@/db/schema');
  const { eq, desc, inArray } = await import('drizzle-orm');

  // Get the most recent assessment that is in an active state
  const rows = await db
    .select()
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);

  if (rows.length === 0) return NextResponse.json({ assessment: null });

  // Attach the eligibility result for this assessment
  const assessment = rows[0];
  const eligRows = await db
    .select({ covered: eligibilityResults.covered, triggerFired: eligibilityResults.triggerFired })
    .from(eligibilityResults)
    .where(eq(eligibilityResults.assessmentId, assessment.id))
    .limit(1);

  return NextResponse.json({
    assessment,
    eligibility: eligRows[0] ?? null,
  });
}

export async function POST() {
  const userId = 'local-user';
  

  const orgId = await resolveOrg(userId);
  if (!orgId) return NextResponse.json({ error: 'No organization found.' }, { status: 404 });

  const { db } = await import('@/db');
  const { assessments } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  // Only create if there's no active draft
  const existing = await db
    .select({ id: assessments.id, status: assessments.status })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);

  if (existing.length > 0 && existing[0].status === 'draft') {
    return NextResponse.json({ assessmentId: existing[0].id, created: false });
  }

  const year = new Date().getFullYear();
  const [assessment] = await db
    .insert(assessments)
    .values({
      orgId,
      auditPeriodStart: `${year}-01-01`,
      auditPeriodEnd: `${year}-12-31`,
      status: 'draft',
      auditorId: userId,
    })
    .returning({ id: assessments.id });

  return NextResponse.json({ assessmentId: assessment.id, created: true }, { status: 201 });
}
