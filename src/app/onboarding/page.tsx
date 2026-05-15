/**
 * Onboarding page — server component entry point.
 *
 * Runs on the server so we can check whether the authenticated user already
 * belongs to an org before shipping any JS to the client. If they do, we
 * redirect immediately to /dashboard — no client round-trip needed.
 *
 * The DB check is wrapped in try/catch so that a missing DATABASE_URL (common
 * in fresh dev environments) never blocks the wizard from rendering.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { userRoles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import OnboardingWizard from './OnboardingWizard';

export default async function OnboardingPage() {
  const { userId } = await auth();

  // Unauthenticated visitors should not reach this page (middleware handles
  // it), but guard here defensively in case middleware config changes.
  if (!userId) {
    redirect('/sign-in');
  }

  try {
    /**
     * Check whether this Clerk user already has a role in any org.
     * If yes, they completed onboarding previously — send them to the dashboard
     * so they don't accidentally create a duplicate org.
     */
    const existingRoles = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.clerkUserId, userId))
      .limit(1);

    if (existingRoles.length > 0) {
      redirect('/dashboard');
    }
  } catch {
    /**
     * DB check failed (e.g., DATABASE_URL not set in dev, or network error).
     * Fall through and render the wizard anyway — the API route will surface
     * any real errors when the user submits.
     */
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy-800 px-4 py-16">
      {/* Outer card provides a readable max-width on wide viewports */}
      <div className="w-full max-w-2xl">
        {/* Logo / wordmark */}
        <div className="mb-10 text-center">
          <span className="font-sora text-2xl font-semibold tracking-tight text-teal-400">
            ShieldAudit
          </span>
          <p className="mt-1 text-sm text-slate-400">
            CCPA Cybersecurity Audit Platform
          </p>
        </div>

        {/* Wizard renders all interactive state client-side */}
        <OnboardingWizard />
      </div>
    </main>
  );
}
