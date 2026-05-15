/**
 * Landing page — redirects authenticated users to /dashboard,
 * shows a minimal splash for unauthenticated visitors.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Shield } from 'lucide-react';

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy-700 px-6">
      <div className="text-center max-w-xl">
        <div className="flex justify-center mb-6">
          <Shield className="h-16 w-16 text-teal-400" strokeWidth={1.5} />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">ShieldAudit</h1>
        <p className="text-lg text-slate-400 mb-2">
          CCPA Cybersecurity Audit Platform
        </p>
        <p className="text-sm text-slate-500 mb-10">
          Cal. Code Regs. tit. 11, §§ 7120–7124
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-in"
            className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-navy-700 font-semibold rounded-lg transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="px-6 py-3 border border-navy-500 hover:border-teal-500 text-slate-300 hover:text-white font-semibold rounded-lg transition-colors"
          >
            Create Account
          </Link>
        </div>
      </div>
    </main>
  );
}
