/**
 * Landing page — redirects authenticated users to /dashboard,
 * shows a minimal splash for unauthenticated visitors.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Shield, ClipboardCheck } from 'lucide-react';

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
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/qualify"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-teal-500 hover:bg-teal-400 text-navy-700 font-semibold rounded-lg transition-colors text-base"
          >
            <ClipboardCheck size={18} />
            Check Your Eligibility
          </Link>
          <div className="flex gap-4">
            <Link
              href="/sign-in"
              className="px-5 py-2.5 border border-navy-500 hover:border-teal-500 text-slate-400 hover:text-white font-medium rounded-lg transition-colors text-sm"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="px-5 py-2.5 border border-navy-500 hover:border-teal-500 text-slate-400 hover:text-white font-medium rounded-lg transition-colors text-sm"
            >
              Create Account
            </Link>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Not sure if you need an audit?{' '}
            <Link href="/qualify" className="text-teal-400/70 hover:text-teal-400 transition-colors underline underline-offset-2">
              Find out in 2 minutes
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
