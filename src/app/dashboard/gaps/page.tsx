export const dynamic = 'force-dynamic';

/**
 * Gap & Remediation Register — /dashboard/gaps
 *
 * Persistent gaps generated from no/partial answers, with the auditor's
 * remediation plan, target date, and status (§7123(d) Document A elements 4 & 6).
 */

import { ClipboardCheck } from 'lucide-react';
import GapRegister from './GapRegister';

export default function GapsPage() {
  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <ClipboardCheck size={20} className="text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">Remediation</p>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">Gap &amp; Remediation Register</h1>
          </div>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          Every gap (a No or Partial answer) with its remediation plan, target date, and status. This register feeds
          the §7123(d) audit report&apos;s gaps and remediation-plan sections.
        </p>
      </div>
      <GapRegister />
    </div>
  );
}
