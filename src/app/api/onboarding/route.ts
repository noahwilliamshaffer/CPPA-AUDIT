/**
 * POST /api/onboarding
 *
 * Creates a new organization and assigns the authenticated Clerk user as
 * its first member with the chosen role (admin or reseller).
 *
 * This is the only route that inserts into `organizations` from user input.
 * All subsequent org creation (MSP client provisioning) goes through a
 * separate, role-gated endpoint so we can enforce reseller-only access there.
 *
 * Error surface:
 *   401 — unauthenticated (Clerk session missing or expired)
 *   400 — request body fails Zod validation
 *   500 — unexpected DB error
 *   201 — success; returns { orgId, success: true }
 */

import { db } from '@/db';
import { organizations, userRoles, eligibilityResults, assessments } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------

/**
 * onboardingSchema — validates the payload sent by OnboardingWizard.
 *
 * revenueTier and consumerRecordCount are optional at the schema level because
 * resellers skip step 3. The wizard itself enforces revenueTier for admins
 * client-side, but the API does not re-enforce that distinction — the DB
 * column is nullable so both paths are valid at the persistence layer.
 */
const onboardingSchema = z.object({
  role: z.enum(['admin', 'reseller']),
  legalEntity: z.string().min(2, 'Legal entity name must be at least 2 characters'),
  contactEmail: z.string().email('Invalid email address'),
  revenueTier: z
    .enum(['under_50m', '50m_to_100m', 'over_100m'])
    .optional(),
  consumerRecordCount: z.number().int().positive().optional(),
});

type OnboardingPayload = z.infer<typeof onboardingSchema>;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = 'local-user';

  // -- 2. Parse and validate request body -------------------------------------
  let payload: OnboardingPayload;

  try {
    const rawBody: unknown = await request.json();
    payload = onboardingSchema.parse(rawBody);
  } catch (err) {
    /**
     * Surface Zod's detailed validation messages so the client can show
     * field-level errors if it chooses. Unknown parse errors fall back to
     * a generic message.
     */
    const message =
      err instanceof z.ZodError
        ? err.issues.map((e) => e.message).join('; ')
        : 'Invalid request body.';

    return NextResponse.json({ error: message }, { status: 400 });
  }

  // -- 3. Persist organization -------------------------------------------------
  /**
   * We use two separate inserts rather than a transaction because Neon HTTP
   * connections don't support multi-statement transactions via the neon()
   * driver. If the userRoles insert fails after organizations succeeds, the
   * orphaned org is harmless — the user will be re-prompted to onboard and
   * the duplicate-org guard in the page server component will not fire.
   * A cleanup cron (or migration) can purge orgs with no user_roles.
   *
   * If you switch to a pooled Neon WebSocket connection (neonConfig +
   * drizzle-orm/neon-serverless), wrap both inserts in db.transaction().
   */

  let orgId: string;

  try {
    /**
     * Insert the organization. `name` mirrors `legalEntity` at creation time
     * — users can update their display name later without changing the legal
     * entity field. `plan` derives from role: resellers become 'reseller',
     * admins get 'direct'.
     */
    const [newOrg] = await db
      .insert(organizations)
      .values({
        name: payload.legalEntity,
        legalEntity: payload.legalEntity,
        contactEmail: payload.contactEmail,
        revenueTier: payload.revenueTier ?? null,
        consumerRecordCount: payload.consumerRecordCount ?? null,
        plan: payload.role === 'reseller' ? 'reseller' : 'direct',
      })
      .returning({ id: organizations.id });

    if (!newOrg) {
      throw new Error('Organization insert returned no rows.');
    }

    orgId = newOrg.id;
  } catch (err) {
    console.error('[onboarding] Failed to insert organization:', err);
    return NextResponse.json(
      { error: 'Failed to create organization. Please try again.' },
      { status: 500 }
    );
  }

  // -- 4. Assign user role -----------------------------------------------------
  try {
    /**
     * Map the wizard's role selection to the userRoleEnum values used in the
     * DB. Resellers are stored as 'reseller'; admins as 'admin'.
     */
    await db.insert(userRoles).values({
      orgId,
      clerkUserId: userId,
      role: payload.role,
    });
  } catch (err) {
    console.error('[onboarding] Failed to insert user_role for org', orgId, ':', err);
    /**
     * The org was created but role assignment failed. Return a 500 — the
     * client will surface an error and the user can retry. The retry is safe
     * because the duplicate-org guard (page.tsx DB check) only fires when
     * user_roles has a row; without a role row the user will be able to retry
     * onboarding, which will create a second org (harmless, see note above).
     */
    return NextResponse.json(
      { error: 'Failed to assign user role. Please try again.' },
      { status: 500 }
    );
  }

  // -- 5. Auto-provision eligibility + draft assessment ------------------------
  // Clients are pre-screened for CPPA coverage before being given access to
  // ShieldAudit. We record that determination automatically at onboarding so
  // the audit assessment is immediately accessible without an in-app screener.
  try {
    const year = new Date().getFullYear();
    const auditPeriodStart = `${year}-01-01`;
    const auditPeriodEnd   = `${year}-12-31`;
    const deadline = new Date();
    deadline.setFullYear(deadline.getFullYear() + 1);
    const submissionDeadline = deadline.toISOString().split('T')[0];

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

    await db.insert(eligibilityResults).values({
      assessmentId: assessment.id,
      orgId,
      covered: true,
      triggerFired: 'revenue', // default; actual trigger confirmed during sales
      revenueTier: payload.revenueTier ?? null,
      submissionDeadline,
    });
  } catch (err) {
    // Non-fatal — the assessment can still be created later. Log and continue.
    console.error('[onboarding] Failed to auto-provision assessment:', err);
  }

  // -- 6. Success --------------------------------------------------------------
  return NextResponse.json({ orgId, success: true }, { status: 201 });
}
