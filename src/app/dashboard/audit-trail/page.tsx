export const dynamic = 'force-dynamic';

/**
 * Audit Trail — /dashboard/audit-trail
 *
 * Read-only view of the immutable audit_trail_entries log for the current
 * assessment (§7123 record-keeping). Every answer change and AI-autofill
 * accept/override is recorded append-only; this page surfaces it with CSV/JSON
 * export for the auditor's working papers and regulator requests.
 */

import { History, Download, ShieldCheck } from 'lucide-react';
import { loadAuditTrail } from '@/lib/audit-trail';

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function actionClasses(action: string): string {
  if (action.includes('accept')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
  if (action.includes('overrid')) return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
  if (action.includes('delete') || action.includes('remove')) return 'text-red-400 bg-red-400/10 border-red-400/30';
  return 'text-teal-400 bg-teal-400/10 border-teal-400/30';
}

export default async function AuditTrailPage() {
  const data = await loadAuditTrail();
  const rows = data?.rows ?? [];

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <History size={20} className="text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">Records</p>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">Audit Trail</h1>
          </div>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <a
              href="/api/audit-trail/export?format=csv"
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 bg-navy-600/40 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-teal-400 hover:border-teal-400/30 transition-colors"
            >
              <Download size={12} /> CSV
            </a>
            <a
              href="/api/audit-trail/export?format=json"
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 bg-navy-600/40 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-teal-400 hover:border-teal-400/30 transition-colors"
            >
              <Download size={12} /> JSON
            </a>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2 max-w-5xl rounded-lg border border-navy-700 bg-navy-700/30 px-4 py-2.5">
        <ShieldCheck size={14} className="text-teal-400 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          Append-only and immutable (enforced by a database trigger). {rows.length} entr{rows.length === 1 ? 'y' : 'ies'} for the
          current assessment. Retain for 5 years per §7123.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="max-w-5xl rounded-xl border border-navy-600 bg-navy-600/20 p-8 text-center text-sm text-slate-500">
          No audit-trail entries yet. Answering questions and applying AI autofill will record entries here.
        </div>
      ) : (
        <div className="max-w-5xl overflow-x-auto rounded-xl border border-navy-600">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-700/50 text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Component / Question</th>
                <th className="px-3 py-2 font-medium">Prior → New</th>
                <th className="px-3 py-2 font-medium">Auditor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-navy-700/20">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-400">
                    {r.timestamp instanceof Date ? r.timestamp.toISOString().replace('T', ' ').slice(0, 19) : String(r.timestamp)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${actionClasses(r.action)}`}>
                      {r.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-300 max-w-xs">
                    {r.componentNumber && (
                      <span className="text-slate-500">
                        §7123(c)({r.componentNumber}){r.componentTitle ? ` ${r.componentTitle}` : ''}
                      </span>
                    )}
                    {r.questionId && (
                      <div className="text-slate-400 truncate" title={r.questionText ?? r.questionId}>
                        {r.questionId}: {r.questionText ?? ''}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    <span className="text-slate-500">{fmtVal(r.priorValue)}</span>
                    <span className="mx-1 text-slate-600">→</span>
                    <span className="text-slate-200">{fmtVal(r.newValue)}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-400">{r.auditorId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
