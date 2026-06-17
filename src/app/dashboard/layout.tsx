/**
 * Dashboard layout — offline mode.
 * No Clerk auth. Loads org context directly from the local SQLite DB.
 * The local user is always 'local-user'.
 */

import { redirect } from 'next/navigation';
import Sidebar from './Sidebar';
import { getBrandConfig } from '@/lib/branding';

const LOCAL_USER_ID = 'local-user';

interface ModuleUnlockStatus {
  module2Unlocked: boolean;
  module3Unlocked: boolean;
  module4Unlocked: boolean;
  aiReviewAvailable: boolean;
}

interface OrgContext {
  orgId: string;
  orgName: string;
  userRole: 'admin' | 'auditor' | 'business_admin' | 'reseller';
}

async function fetchOrgContext(localUserId: string): Promise<OrgContext | null> {
  const { db } = await import('@/db');
  const { userRoles, organizations } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const rows = await db
    .select({ orgId: userRoles.orgId, role: userRoles.role, orgName: organizations.name })
    .from(userRoles)
    .innerJoin(organizations, eq(userRoles.orgId, organizations.id))
    .where(eq(userRoles.clerkUserId, localUserId))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    orgId: row.orgId,
    orgName: row.orgName,
    userRole: row.role as OrgContext['userRole'],
  };
}

async function fetchModuleUnlockStatus(orgId: string): Promise<ModuleUnlockStatus> {
  const { db } = await import('@/db');
  const { assessments, aiAutofillSessions } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const module2Unlocked = true;

  const assessmentRows = await db
    .select({ id: assessments.id, status: assessments.status })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);

  const latestStatus = assessmentRows[0]?.status ?? null;
  const module3Unlocked =
    latestStatus === 'scoring' || latestStatus === 'complete' || latestStatus === 'locked';

  // AI Review is reachable while the latest autofill session is 'complete' — show
  // a persistent nav entry so the review page is always one click away.
  let aiReviewAvailable = false;
  const assessmentId = assessmentRows[0]?.id;
  if (assessmentId) {
    const sessionRows = await db
      .select({ status: aiAutofillSessions.status })
      .from(aiAutofillSessions)
      .where(eq(aiAutofillSessions.assessmentId, assessmentId))
      .orderBy(desc(aiAutofillSessions.createdAt))
      .limit(1);
    aiReviewAvailable = sessionRows[0]?.status === 'complete';
  }

  return { module2Unlocked, module3Unlocked, module4Unlocked: module3Unlocked, aiReviewAvailable };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let orgName = 'Your Organization';
  let userRole: OrgContext['userRole'] = 'admin';
  let moduleStatus: ModuleUnlockStatus = {
    module2Unlocked: true,
    module3Unlocked: false,
    module4Unlocked: false,
    aiReviewAvailable: false,
  };

  let orgFetchError = false;
  let orgContext: OrgContext | null = null;

  try {
    orgContext = await fetchOrgContext(LOCAL_USER_ID);
  } catch {
    orgFetchError = true;
  }

  if (!orgFetchError && orgContext === null) {
    redirect('/onboarding');
  }

  let brand = { companyName: '', accentColor: '', logoUrl: '', reportFooter: '' };

  if (orgContext) {
    orgName = orgContext.orgName;
    userRole = orgContext.userRole;
    try {
      moduleStatus = await fetchModuleUnlockStatus(orgContext.orgId);
    } catch {}
    try {
      brand = await getBrandConfig(LOCAL_USER_ID);
    } catch {}
  }

  return (
    <div className="flex min-h-screen bg-navy-700">
      <Sidebar
        orgName={orgName}
        userRole={userRole}
        module2Unlocked={moduleStatus.module2Unlocked}
        module3Unlocked={moduleStatus.module3Unlocked}
        module4Unlocked={moduleStatus.module4Unlocked}
        aiReviewAvailable={moduleStatus.aiReviewAvailable}
        userInitials="SA"
        userEmail="local@shieldaudit"
        brandName={brand.companyName}
        accentColor={brand.accentColor}
        logoUrl={brand.logoUrl}
      />
      <main className="ml-64 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
