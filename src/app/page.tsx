/**
 * Root page — offline mode. Redirects directly to dashboard.
 */

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
