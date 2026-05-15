/**
 * Dashboard layout — server component that wraps all /dashboard/* routes.
 *
 * Responsibilities:
 * 1. Authenticate the request via Clerk and confirm the user belongs to an org.
 * 2. Determine which modules are unlocked for the org using LINEAR progression:
 *    Module 1 → Module 2 → Module 3 → Module 4 (each gate depends on the prior).
 * 3. Pass unlock state + org metadata to the Sidebar so it can render locked/
 *    unlocked nav items without a client-side DB round-trip.
 *
 * Module unlock rules (§7120–§7123 progression):
 * - Module 1 (Eligibility):  Always unlocked — everyone starts here.
 * - Module 2 (Assessment):   Unlocked when an eligibility_results row exists
 *                            for the org with covered = true. A "not covered"
 *                            result intentionally keeps Module 2 locked because
 *                            the business is not required to complete an audit.
 * - Module 3 (Scoring):      Unlocked when the most recent assessment has a
 *                            status of 'scoring', 'complete', or 'locked'.
 *                            'locked' means Module 2 is done but Stripe payment
 *                            has not cleared; we still show the scoring UI so
 *                            the user can see what they are paying for.
 * - Module 4 (Reports):      Same gate as Module 3 — once scoring is available
 *                            the report generator is also accessible. The actual
 *                            PDF generation requires a fully 'complete' status,
 *                            but the page itself can load and explain this.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Sidebar from './Sidebar';

// ---------------------------------------------------------------------------
// Types for data fetched from the database
// ---------------------------------------------------------------------------

interface ModuleUnlockStatus {
  module1Unlocked: boolean;
  module2Unlocked: boolean;
  module3Unlocked: boolean;
  module4Unlocked: boolean;
}

interface OrgContext {
  orgId: string;
  orgName: string;
  userRole: 'admin' | 'auditor' | 'business_admin' | 'reseller';
}

// ---------------------------------------------------------------------------
// Fetch org membership + module status from the database.
// Returns null if the user has no org membership (triggers redirect).
// Throws on unexpected DB errors so the caller can fall back to safe defaults.
// ---------------------------------------------------------------------------

async function fetchOrgContext(clerkUserId: string): Promise<OrgContext | null> {
  // Dynamic import prevents the module-level DATABASE_URL check from running
  // when DATABASE_URL is absent — the catch block in the layout handles that.
  const { db } = await import('@/db');
  const { userRoles, organizations } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const rows = await db
    .select({
      orgId: userRoles.orgId,
      role: userRoles.role,
      orgName: organizations.name,
    })
    .from(userRoles)
    .innerJoin(organizations, eq(userRoles.orgId, organizations.id))
    .where(eq(userRoles.clerkUserId, clerkUserId))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    orgId: row.orgId,
    orgName: row.orgName,
    // Cast is safe — the DB enum values exactly match the TypeScript union.
    userRole: row.role as OrgContext['userRole'],
  };
}

async function fetchModuleUnlockStatus(
  orgId: string
): Promise<ModuleUnlockStatus> {
  const { db } = await import('@/db');
  const { assessments, eligibilityResults } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  // Module 1 is always unlocked — it's the starting gate for all orgs.
  const module1Unlocked = true;

  // Module 2: an eligibility_results row must exist with covered = true.
  // We join via the org's most recent assessment so we're checking the latest
  // screener run, not a stale historical one.
  const eligibilityRows = await db
    .select({ covered: eligibilityResults.covered })
    .from(eligibilityResults)
    .where(eq(eligibilityResults.orgId, orgId))
    .orderBy(desc(eligibilityResults.createdAt))
    .limit(1);

  const module2Unlocked =
    eligibilityRows.length > 0 && eligibilityRows[0].covered === true;

  // Module 3: the most recent assessment must be in a post-Module-2 status.
  // 'scoring', 'complete', and 'locked' all indicate Module 2 work is done.
  const assessmentRows = await db
    .select({ status: assessments.status })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);

  const latestStatus = assessmentRows[0]?.status ?? null;
  const module3Unlocked =
    latestStatus === 'scoring' ||
    latestStatus === 'complete' ||
    latestStatus === 'locked';

  // Module 4 shares Module 3's gate — reports are available once scoring data
  // exists, even if the final PDF generation requires 'complete' status.
  const module4Unlocked = module3Unlocked;

  return {
    module1Unlocked,
    module2Unlocked,
    module3Unlocked,
    module4Unlocked,
  };
}

// ---------------------------------------------------------------------------
// Layout component
// ---------------------------------------------------------------------------

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, sessionClaims } = await auth();

  // Middleware should have blocked unauthenticated access, but guard here
  // defensively in case the middleware config ever changes.
  if (!userId) {
    redirect('/sign-in');
  }

  // Default unlock state: only Module 1 is open. Used when the DB is
  // unavailable (e.g., DATABASE_URL not configured in a fresh dev environment).
  let orgName = 'Your Organization';
  let userRole: OrgContext['userRole'] = 'auditor';
  let moduleStatus: ModuleUnlockStatus = {
    module1Unlocked: true,
    module2Unlocked: false,
    module3Unlocked: false,
    module4Unlocked: false,
  };

  try {
    const orgContext = await fetchOrgContext(userId);

    // If the user has no org membership they haven't completed onboarding yet.
    if (!orgContext) {
      redirect('/onboarding');
    }

    orgName = orgContext.orgName;
    userRole = orgContext.userRole;

    moduleStatus = await fetchModuleUnlockStatus(orgContext.orgId);
  } catch {
    // DB unavailable or query failed. Safe defaults (module1 only) are already
    // set above. The Sidebar will show accurate lock state once DB is up.
  }

  // Derive user display info from session claims — no extra Clerk API call needed.
  const userEmail =
    (sessionClaims?.email as string | undefined) ?? `${userId.slice(0, 6)}@clerk`;
  const firstName = (sessionClaims?.first_name as string | undefined) ?? '';
  const lastName = (sessionClaims?.last_name as string | undefined) ?? '';
  const userInitials =
    firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : (userEmail[0] ?? 'U').toUpperCase();

  return (
    <div className="flex min-h-screen bg-navy-700">
      {/* Fixed-width sidebar — always present across all dashboard routes */}
      <Sidebar
        orgName={orgName}
        userRole={userRole}
        module1Unlocked={moduleStatus.module1Unlocked}
        module2Unlocked={moduleStatus.module2Unlocked}
        module3Unlocked={moduleStatus.module3Unlocked}
        module4Unlocked={moduleStatus.module4Unlocked}
        userInitials={userInitials}
        userEmail={userEmail}
      />

      {/*
       * Main content area.
       * ml-64 offsets the fixed sidebar (w-64 = 16rem).
       * overflow-y-auto enables independent scrolling of the content area
       * without scrolling the sidebar out of view.
       */}
      <main className="ml-64 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
