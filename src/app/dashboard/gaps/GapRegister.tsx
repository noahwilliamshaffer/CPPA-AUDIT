'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';

interface Gap {
  id: string;
  componentNumber: number;
  componentTitle: string | null;
  citation: string;
  riskWeight: string;
  response: string;
  title: string;
  description: string;
  remediationPlan: string | null;
  remediationDue: string | null;
  status: string;
}

const RISK_BADGE: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  low: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};
const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'accepted_risk', label: 'Accepted risk' },
];
const inputCls = 'w-full rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none';

export default function GapRegister() {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await (await fetch('/api/gaps')).json();
      setGaps(d.gaps ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function regenerate() {
    setBusy(true);
    try {
      const d = await (await fetch('/api/gaps/generate', { method: 'POST' })).json();
      setGaps(d.gaps ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, patch: Partial<Gap>) {
    setGaps(prev => prev.map(g => (g.id === id ? { ...g, ...patch } : g)));
    await fetch('/api/gaps/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
    setSavedId(id);
    setTimeout(() => setSavedId(s => (s === id ? null : s)), 2000);
  }

  const open = gaps.filter(g => g.status === 'open').length;
  const resolved = gaps.filter(g => g.status === 'resolved').length;

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-navy-600 bg-navy-600/20 px-4 py-3">
        <p className="text-xs text-slate-400">
          {gaps.length} gap(s) · <span className="text-score-red">{open} open</span> · <span className="text-score-green">{resolved} resolved</span>
        </p>
        <button
          onClick={regenerate}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-400 hover:bg-teal-400/20 transition-colors disabled:opacity-60"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh from answers
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500"><Loader2 size={12} className="inline animate-spin text-teal-400" /> Loading…</p>
      ) : gaps.length === 0 ? (
        <div className="rounded-xl border border-navy-600 bg-navy-600/20 p-8 text-center text-sm text-slate-500">
          No gaps recorded. Click <span className="text-slate-300">Refresh from answers</span> to generate them from your No/Partial responses.
        </div>
      ) : (
        <div className="space-y-3">
          {gaps.map(g => (
            <div key={g.id} className="rounded-xl border border-navy-600 bg-navy-600/20 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${RISK_BADGE[g.riskWeight] ?? RISK_BADGE.low}`}>{g.riskWeight}</span>
                    <span className="font-mono text-[10px] text-slate-600">{g.citation}</span>
                    <span className={`text-[10px] font-medium ${g.response === 'no' ? 'text-score-red' : 'text-score-yellow'}`}>{g.response.toUpperCase()}</span>
                    {savedId === g.id && <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400"><CheckCircle2 size={9} /> saved</span>}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{g.description}</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_140px_140px]">
                <textarea
                  rows={2}
                  defaultValue={g.remediationPlan ?? ''}
                  onBlur={e => update(g.id, { remediationPlan: e.target.value })}
                  placeholder="Remediation plan…"
                  className={`${inputCls} resize-none sm:row-span-2`}
                />
                <label className="block">
                  <span className="mb-1 block text-[10px] text-slate-500">Target date</span>
                  <input type="date" defaultValue={g.remediationDue ?? ''} onBlur={e => update(g.id, { remediationDue: e.target.value })} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] text-slate-500">Status</span>
                  <select value={g.status} onChange={e => update(g.id, { status: e.target.value })} className={inputCls}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
