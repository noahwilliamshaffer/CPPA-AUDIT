'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

export default function ComponentStatusControl({ componentNumber }: { componentNumber: number }) {
  const [applicable, setApplicable] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/component-status?component=${componentNumber}`)
      .then(r => r.json())
      .then(d => {
        const s = (d.statuses ?? [])[0];
        if (s) { setApplicable(!!s.applicable); setCompleted(!!s.completed); }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [componentNumber]);

  async function save(patch: Partial<{ applicable: boolean; completed: boolean }>) {
    const next = { applicable, completed, ...patch };
    setApplicable(next.applicable);
    setCompleted(next.completed);
    setSaving(true);
    try {
      await fetch('/api/component-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ component: componentNumber, ...next }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  const btn = (active: boolean, activeCls: string) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${active ? activeCls : 'border-navy-600 text-slate-500 hover:text-slate-300'}`;

  return (
    <div className="mb-6 max-w-2xl flex flex-wrap items-center gap-3 rounded-xl border border-navy-600 bg-navy-600/20 px-4 py-3">
      <span className="text-xs text-slate-400">Applicability</span>
      <div className="flex gap-1.5">
        <button onClick={() => save({ applicable: true })} className={btn(applicable, 'border-teal-400/50 bg-teal-400/10 text-teal-400')}>Applicable</button>
        <button onClick={() => save({ applicable: false, completed: false })} className={btn(!applicable, 'border-slate-500/50 bg-slate-500/10 text-slate-300')}>Not Applicable</button>
      </div>
      {applicable && (
        <button
          onClick={() => save({ completed: !completed })}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${completed ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-400' : 'border-navy-600 text-slate-400 hover:text-slate-200'}`}
        >
          {completed ? <CheckCircle2 size={13} /> : <Circle size={13} />} {completed ? 'Complete' : 'Mark complete'}
        </button>
      )}
      {saving && <Loader2 size={13} className="animate-spin text-teal-400" />}
    </div>
  );
}
