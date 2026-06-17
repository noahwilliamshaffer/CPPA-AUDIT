'use client';

/**
 * /dashboard/assessment/document-upload — ADD-17 required step before Module 2.
 * The auditor uploads cybersecurity documentation for AI pre-fill, or explicitly
 * skips to enter the assessment manually. Files are sent to the analyze route,
 * processed in memory, and discarded — nothing is stored.
 */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileText, X, Loader2, Sparkles, AlertTriangle, ChevronRight, ScanSearch,
} from 'lucide-react';

interface ReadabilityResult {
  name: string;
  readability: 'Clear' | 'Dense' | 'Poor';
  relevance: 'High' | 'Medium' | 'Low';
  nistFamilies: string[];
}

type Phase = 'select' | 'checking' | 'reviewed' | 'analyzing';

const REQUIRED = [
  'System Security Plan (SSP) or equivalent cybersecurity program document',
  'Incident Response Plan',
  'Business Continuity / Disaster Recovery Plan',
];

const RECOMMENDED = [
  'Access Control Policy / RBAC documentation',
  'Vulnerability scan reports or penetration test reports',
  'Employee security training records',
  'Third-party vendor contracts or risk assessments',
  'Data retention and disposal policy',
  'Network architecture or segmentation diagrams',
  'Audit log management policy or SIEM documentation',
  'Encryption policy and key management documentation',
  'ADMT inventory or automated decision system documentation (if applicable)',
  'Any other relevant cybersecurity policy, procedure, or evidence document',
];

const ACCEPT = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg';
const READABILITY_BADGE: Record<string, string> = {
  Clear: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  Dense: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  Poor: 'text-red-400 bg-red-400/10 border-red-400/30',
};
const RELEVANCE_BADGE: Record<string, string> = {
  High: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  Medium: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  Low: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

export default function DocumentUploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>('select');
  const [readability, setReadability] = useState<ReadabilityResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [overrideValidation, setOverrideValidation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    setReadability([]);
    setOverrideValidation(false);
    setPhase('select');
    setFiles(prev => {
      const byName = new Map(prev.map(f => [f.name, f]));
      Array.from(list).forEach(f => byName.set(f.name, f));
      return Array.from(byName.values()).slice(0, 10);
    });
  }

  function removeFile(name: string) {
    setFiles(prev => prev.filter(f => f.name !== name));
    setReadability(prev => prev.filter(r => r.name !== name));
  }

  function buildForm(mode: string): FormData {
    const fd = new FormData();
    fd.append('mode', mode);
    files.forEach(f => fd.append('files', f));
    return fd;
  }

  async function runReadability() {
    if (files.length === 0) return;
    setPhase('checking');
    setError(null);
    setOverrideValidation(false);
    try {
      const res = await fetch('/api/ai-autofill/analyze', { method: 'POST', body: buildForm('readability') });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Readability check failed.');
      setReadability(Array.isArray(data.readability) ? data.readability : []);
      setPhase('reviewed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Readability check failed.');
      setPhase('select');
    }
  }

  async function analyze() {
    if (files.length === 0) return;
    setPhase('analyzing');
    setError(null);
    try {
      const res = await fetch('/api/ai-autofill/analyze', { method: 'POST', body: buildForm('analyze') });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed.');
      router.push('/dashboard/assessment');
    } catch (e) {
      // A 'failed' session was recorded, so the auditor can proceed manually.
      setError((e instanceof Error ? e.message : 'AI document analysis failed.') + ' You can complete the assessment manually.');
      setPhase('reviewed');
    }
  }

  async function skip() {
    setError(null);
    try {
      await fetch('/api/ai-autofill/analyze', { method: 'POST', body: buildForm('skip') });
    } catch {
      /* proceed regardless */
    }
    router.push('/dashboard/assessment');
  }

  const busy = phase === 'checking' || phase === 'analyzing';
  // Hard gate: documents that are Poor readability or Low relevance to a CPPA
  // audit are flagged; Analyze is blocked until they're removed or overridden.
  const flagged = readability.filter(r => r.readability === 'Poor' || r.relevance === 'Low');

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <Sparkles size={20} className="text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">AI Document Ingestion</p>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">Upload your documentation</h1>
          </div>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          Before we begin the assessment, upload your cybersecurity documentation. The AI will read these
          documents and pre-fill the assessment with the answers it can support. <span className="text-slate-300">Every
          answer is editable — review and adjust them directly on the question pages.</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] max-w-5xl">
        {/* Left: upload + files */}
        <div className="space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); if (!busy) addFiles(e.dataTransfer.files); }}
            onClick={() => !busy && inputRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-navy-600 bg-navy-600/20 p-8 text-center transition-colors hover:border-teal-400/40 hover:bg-navy-600/40"
          >
            <Upload size={28} className="mx-auto mb-3 text-teal-400" />
            <p className="text-sm font-medium text-slate-200">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-slate-500">PDF, DOCX, TXT, MD, PNG, JPG — up to 10 files, 25 MB each</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-200/90">{error}</p>
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map(f => {
                const r = readability.find(x => x.name === f.name);
                const bad = !!r && (r.readability === 'Poor' || r.relevance === 'Low');
                return (
                  <div key={f.name} className={`rounded-lg border p-3 ${bad ? 'border-amber-400/50 bg-amber-400/5' : 'border-navy-600 bg-navy-600/20'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={15} className="text-slate-500 flex-shrink-0" />
                        <span className="truncate text-sm text-slate-200">{f.name}</span>
                        <span className="text-[10px] text-slate-600 flex-shrink-0">{Math.round(f.size / 1024)} KB</span>
                      </div>
                      {!busy && (
                        <button onClick={() => removeFile(f.name)} className="text-slate-500 hover:text-red-400 flex-shrink-0" aria-label={`Remove ${f.name}`}>
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    {r && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${READABILITY_BADGE[r.readability] ?? READABILITY_BADGE.Dense}`}>
                          {r.readability}
                        </span>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${RELEVANCE_BADGE[r.relevance] ?? RELEVANCE_BADGE.Low}`}>
                          {r.relevance} relevance
                        </span>
                        {r.nistFamilies.slice(0, 8).map(fam => (
                          <span key={fam} className="rounded bg-navy-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{fam}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {phase === 'select' && files.length > 0 && (
              <button
                onClick={runReadability}
                className="inline-flex items-center gap-2 rounded-lg border border-teal-400/30 bg-teal-400/10 px-4 py-2 text-sm font-medium text-teal-400 hover:bg-teal-400/20 transition-colors"
              >
                <ScanSearch size={15} /> Review documents
              </button>
            )}

            {phase === 'checking' && (
              <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                <Loader2 size={15} className="animate-spin text-teal-400" /> Assessing document readability…
              </span>
            )}

            {phase === 'reviewed' && (
              <div className="flex w-full flex-col gap-2">
                {flagged.length > 0 && !overrideValidation && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5">
                    <AlertTriangle size={14} className="mt-0.5 text-amber-400 flex-shrink-0" />
                    <div className="text-xs text-amber-200/90">
                      <p className="font-medium">Some documents may not produce reliable autofill:</p>
                      <ul className="mt-1 space-y-0.5">
                        {flagged.map(r => (
                          <li key={r.name}>
                            • {r.name} —{' '}
                            {[
                              r.readability === 'Poor' ? 'poor readability' : null,
                              r.relevance === 'Low' ? 'low relevance to a CPPA audit' : null,
                            ].filter(Boolean).join(', ')}
                          </li>
                        ))}
                      </ul>
                      <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={overrideValidation}
                          onChange={e => setOverrideValidation(e.target.checked)}
                          className="accent-amber-400"
                        />
                        <span>Analyze anyway</span>
                      </label>
                      <span className="ml-1 text-amber-200/60">— or remove/replace them above.</span>
                    </div>
                  </div>
                )}
                <button
                  onClick={analyze}
                  disabled={flagged.length > 0 && !overrideValidation}
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-teal-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles size={15} /> Analyze Documents
                </button>
              </div>
            )}

            {phase === 'analyzing' && (
              <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                <Loader2 size={16} className="animate-spin text-teal-400" />
                Analyzing documents — this can take up to two minutes…
              </span>
            )}

            {!busy && (
              <button
                onClick={skip}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Skip AI autofill — enter manually <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Right: document checklist */}
        <aside className="rounded-xl border border-navy-600 bg-navy-600/20 p-5 h-fit">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-2">Required — upload at least one</p>
          <ul className="space-y-1.5 mb-4">
            {REQUIRED.map(item => (
              <li key={item} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="mt-0.5 text-slate-600">☐</span>{item}
              </li>
            ))}
          </ul>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Recommended — any that apply</p>
          <ul className="space-y-1.5">
            {RECOMMENDED.map(item => (
              <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="mt-0.5 text-slate-600">☐</span>{item}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
