/**
 * /dashboard — immediate redirect to Module 1 (Eligibility Screener).
 *
 * This keeps the URL surface clean: /dashboard itself is never a destination
 * users land on. All entry points (post-login, post-onboarding) land here
 * and are immediately forwarded to the first step in the linear workflow.
 *
 * Server-side redirect means no flash of an empty layout before navigation.
 */

import { redirect } from 'next/navigation';

export default function DashboardPage(): never {
  redirect('/dashboard/eligibility');
}
