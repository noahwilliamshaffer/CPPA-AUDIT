import { NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  answers: z.array(z.boolean()).length(5),
});

// Maps question index (0–4) to the triggerFired enum value
const TRIGGER_MAP = [
  'revenue',          // Q1 §7120(b)(1) — gross revenue > $25M
  'consumer_volume',  // Q2 §7120(b)(2) — 100K+ consumers
  'data_sales',       // Q3 §7120(b)(3) — 50%+ revenue from PI sales
  'data_sales',       // Q4 §7120(b)(4) — 25K+ consumers AND 25%+ revenue
  'consumer_volume',  // Q5 §7120(b)(5) — 10K+ consumers
] as const;

export async function POST(req: Request) {
  const userId = 'local-user';
  

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues.map(e => e.message).join('; ') : 'Invalid request body.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { userRoles, organizations, assessments, eligibilityResults } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  // Resolve org
  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, userId))
    .limit(1);

  if (roleRows.length === 0) {
    return NextResponse.json({ error: 'No organization found for this user.' }, { status: 404 });
  }
  const { orgId } = roleRows[0];

  // Get org for revenue tier
  const orgRows = await db
    .select({ revenueTier: organizations.revenueTier })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const revenueTier = orgRows[0]?.revenueTier ?? null;

  // Determine coverage (OR logic — any "yes" = covered)
  const covered = body.answers.some(a => a);
  const firstTrueIndex = body.answers.findIndex(a => a);
  const triggerFired = covered ? TRIGGER_MAP[firstTrueIndex] : 'not_covered';

  // Submission deadline: 1 year from today
  const deadline = new Date();
  deadline.setFullYear(deadline.getFullYear() + 1);
  const submissionDeadline = deadline.toISOString().split('T')[0];

  // Audit period: current calendar year
  const year = new Date().getFullYear();
  const auditPeriodStart = `${year}-01-01`;
  const auditPeriodEnd = `${year}-12-31`;

  // Insert draft assessment
  const [assessment] = await db
    .insert(assessments)
    .values({
      orgId,
      auditPeriodStart,
      auditPeriodEnd,
      status: 'draft',
      auditorId: userId,
    })
    .returning({ id: assessments.id });

  // Insert eligibility result
  await db.insert(eligibilityResults).values({
    assessmentId: assessment.id,
    orgId,
    covered,
    triggerFired,
    revenueTier,
    submissionDeadline,
  });

  return NextResponse.json({ covered, assessmentId: assessment.id }, { status: 201 });
}
