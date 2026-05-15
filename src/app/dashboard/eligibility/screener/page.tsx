import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import ScreenerWizard from './ScreenerWizard';

export default async function ScreenerPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="min-h-full px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <ClipboardCheck size={20} className="text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">
              Module 1 — Screener
            </p>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">
              Eligibility Screener
            </h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl">
          Answer all five threshold questions. Coverage is determined by{' '}
          <span className="font-semibold text-slate-300">OR logic</span> — a single
          &ldquo;Yes&rdquo; is sufficient to trigger a Covered determination. All answers
          are recorded for your audit file.
        </p>
      </div>

      <ScreenerWizard />
    </div>
  );
}
