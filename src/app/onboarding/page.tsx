/**
 * Onboarding page — offline mode.
 * If the user already has an org, redirect to dashboard.
 * Otherwise show the setup wizard.
 */

import { redirect } from 'next/navigation';
import { db } from '@/db';
import { userRoles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import OnboardingWizard from './OnboardingWizard';

export const dynamic = 'force-dynamic';


const LOCAL_USER_ID = 'local-user';

export default async function OnboardingPage() {
  try {
    const existingRoles = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.clerkUserId, LOCAL_USER_ID))
      .limit(1);

    if (existingRoles.length > 0) {
      redirect('/dashboard');
    }
  } catch {
    // DB not ready yet — show wizard and let the API handle it
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy-800 px-4 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <span className="font-sora text-2xl font-semibold tracking-tight text-teal-400">
            ShieldAudit
          </span>
          <p className="mt-1 text-sm text-slate-400">
            CCPA Cybersecurity Audit — Offline Mode
          </p>
        </div>
        <OnboardingWizard />
      </div>
    </main>
  );
}
