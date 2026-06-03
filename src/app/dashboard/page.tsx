/**
 * /dashboard — immediate redirect to the Audit Assessment (Module 2).
 *
 * Eligibility screening happens before clients are provisioned; by the time
 * a user reaches this dashboard their coverage is already confirmed. The
 * assessment is therefore the first destination after login / onboarding.
 */

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';


export default function DashboardPage(): never {
  redirect('/dashboard/assessment');
}
