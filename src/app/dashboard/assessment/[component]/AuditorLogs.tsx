'use client';

import { useEffect, useState } from 'react';
import { FlaskConical, MessagesSquare, Plus, Trash2, Loader2, X } from 'lucide-react';

interface TestLog {
  id: string;
  testName: string;
  methodology: string;
  result: string;
  conductedAt: string;
  findings: string;
}
interface InterviewLog {
  id: string;
  intervieweeTitle: string;
  interviewDate: string;
  topics: string;
  findings: string;
}

const RESULT_BADGE: Record<string, string> = {
  pass: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  partial: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  fail: 'text-red-400 bg-red-400/10 border-red-400/30',
};

const inputCls =
  'w-full rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none';

export default function AuditorLogs({ componentNumber }: { componentNumber: number }) {
  const [tests, setTests] = useState<TestLog[]>([]);
  const [interviews, setInterviews] = useState<InterviewLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTest, setShowTest] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [t, setT] = useState({ testName: '', methodology: '', result: 'pass', conductedAt: '', findings: '' });
  const [iv, setIv] = useState({ intervieweeTitle: '', interviewDate: '', topics: '', findings: '' });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/auditor-logs?component=${componentNumber}`);
      const d = await r.json();
      setTests(d.tests ?? []);
      setInterviews(d.interviews ?? []);
    } catch {
      setError('Could not load auditor logs.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentNumber]);

  async function create(kind: 'test' | 'interview') {
    setSaving(true);
    setError(null);
    const payload = kind === 'test' ? { kind, component: componentNumber, ...t } : { kind, component: componentNumber, ...iv };
    try {
      const r = await fetch('/api/auditor-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? 'Save failed');
      if (kind === 'test') { setT({ testName: '', methodology: '', result: 'pass', conductedAt: '', findings: '' }); setShowTest(false); }
      else { setIv({ intervieweeTitle: '', interviewDate: '', topics: '', findings: '' }); setShowInterview(false); }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(kind: 'test' | 'interview', id: string) {
    if (!window.confirm('Remove this log entry? The removal is recorded in the audit trail.')) return;
    await fetch('/api/auditor-logs/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id }) });
    await load();
  }

  return (
    <section className="mt-6 max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-5">
      <p className="text-[11px] text-slate-500 mb-4">§7123(e) — auditor-observed evidence: record the tests you ran and the interviews you held for this component.</p>

      {/* Testing Log */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FlaskConical size={15} className="text-teal-400" />
            <h3 className="font-sora text-sm font-semibold text-slate-100">Testing Log</h3>
            <span className="text-[10px] text-slate-600">{tests.length}</span>
          </div>
          <button onClick={() => setShowTest(s => !s)} className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300">
            {showTest ? <X size={11} /> : <Plus size={11} />} {showTest ? 'Cancel' : 'Add test'}
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500"><Loader2 size={12} className="inline animate-spin text-teal-400" /> Loading…</p>
        ) : tests.length === 0 && !showTest ? (
          <p className="text-xs text-slate-500">No tests logged for this component yet.</p>
        ) : (
          <ul className="space-y-2">
            {tests.map(x => (
              <li key={x.id} className="rounded-lg border border-navy-700 bg-navy-700/30 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200">{x.testName}</span>
                  <div className="flex items-center gap-2">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${RESULT_BADGE[x.result] ?? RESULT_BADGE.partial}`}>{x.result}</span>
                    <button onClick={() => remove('test', x.id)} className="text-slate-500 hover:text-red-400" aria-label="Remove"><Trash2 size={12} /></button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{x.conductedAt} · {x.methodology}</p>
                <p className="text-[11px] text-slate-400 mt-1">{x.findings}</p>
              </li>
            ))}
          </ul>
        )}

        {showTest && (
          <div className="mt-2 space-y-2 rounded-lg border border-navy-700 bg-navy-800/40 p-3">
            <input className={inputCls} placeholder="Test name" value={t.testName} onChange={e => setT({ ...t, testName: e.target.value })} />
            <input className={inputCls} placeholder="Methodology (how the test was performed)" value={t.methodology} onChange={e => setT({ ...t, methodology: e.target.value })} />
            <div className="flex gap-2">
              <select className={inputCls} value={t.result} onChange={e => setT({ ...t, result: e.target.value })}>
                <option value="pass">Pass</option><option value="partial">Partial</option><option value="fail">Fail</option>
              </select>
              <input className={inputCls} type="date" value={t.conductedAt} onChange={e => setT({ ...t, conductedAt: e.target.value })} />
            </div>
            <textarea rows={2} className={`${inputCls} resize-none`} placeholder="Findings" value={t.findings} onChange={e => setT({ ...t, findings: e.target.value })} />
            <button onClick={() => create('test')} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-400 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-teal-300 disabled:opacity-60">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save test
            </button>
          </div>
        )}
      </div>

      {/* Interview Log */}
      <div className="border-t border-navy-700 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessagesSquare size={15} className="text-teal-400" />
            <h3 className="font-sora text-sm font-semibold text-slate-100">Interview Log</h3>
            <span className="text-[10px] text-slate-600">{interviews.length}</span>
          </div>
          <button onClick={() => setShowInterview(s => !s)} className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300">
            {showInterview ? <X size={11} /> : <Plus size={11} />} {showInterview ? 'Cancel' : 'Add interview'}
          </button>
        </div>

        {!loading && interviews.length === 0 && !showInterview ? (
          <p className="text-xs text-slate-500">No interviews logged for this component yet.</p>
        ) : (
          <ul className="space-y-2">
            {interviews.map(x => (
              <li key={x.id} className="rounded-lg border border-navy-700 bg-navy-700/30 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200">{x.intervieweeTitle}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">{x.interviewDate}</span>
                    <button onClick={() => remove('interview', x.id)} className="text-slate-500 hover:text-red-400" aria-label="Remove"><Trash2 size={12} /></button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Topics: {x.topics}</p>
                <p className="text-[11px] text-slate-400 mt-1">{x.findings}</p>
              </li>
            ))}
          </ul>
        )}

        {showInterview && (
          <div className="mt-2 space-y-2 rounded-lg border border-navy-700 bg-navy-800/40 p-3">
            <input className={inputCls} placeholder="Interviewee title (e.g. CISO) — no names" value={iv.intervieweeTitle} onChange={e => setIv({ ...iv, intervieweeTitle: e.target.value })} />
            <input className={inputCls} type="date" value={iv.interviewDate} onChange={e => setIv({ ...iv, interviewDate: e.target.value })} />
            <input className={inputCls} placeholder="Topics discussed" value={iv.topics} onChange={e => setIv({ ...iv, topics: e.target.value })} />
            <textarea rows={2} className={`${inputCls} resize-none`} placeholder="Findings" value={iv.findings} onChange={e => setIv({ ...iv, findings: e.target.value })} />
            <button onClick={() => create('interview')} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-400 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-teal-300 disabled:opacity-60">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save interview
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-[11px] text-red-400">{error}</p>}
    </section>
  );
}
