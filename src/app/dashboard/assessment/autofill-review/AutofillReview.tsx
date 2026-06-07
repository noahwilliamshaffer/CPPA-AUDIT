'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, ChevronDown, ChevronRight, Download, Loader2, AlertTriangle,
  CheckCircle2, FileText,
} from 'lucide-react';

interface ReviewItem {
  questionId: string;
  componentNumber: number;
  questionText: string;
  riskWeight: string;
  answerType: string;
  options: { value: string; label: string }[] | null;
  displayOrder: number;
  suggestedAnswer: string | null;
  confidence: string | null;
  reasoning: string | null;
  sourceDocuments: string[];
  needsReview: boolean;
}

interface ComponentMeta { number: number; title: string; citation: string }
interface NistSummary {
  controlFamilySummaries: Record<string, string | null>;
  documentCoverage: Record<string, string[]>;
  overallReadabilityAssessment: string;
}

interface Props {
  items: ReviewItem[];
  nistSummary: NistSummary | null;
  components: ComponentMeta[];
}

interface Decision {
  response: string;
  responseText: string;
  notes: string;
  included: boolean;
  overridden: boolean;
}

type Tab = 'all' | 'needs_review' | 'filled' | 'no_evidence';

const STANDARD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  yes_partial_no_na: [
    { value: 'yes', label: 'Yes' }, { value: 'partial', label: 'Partial' },
    { value: 'no', label: 'No' }, { value: 'not_applicable', label: 'N/A' },
  ],
  yes_no: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
  yes_no_na: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'not_applicable', label: 'N/A' }],
};

function getOptions(item: ReviewItem): { value: string; label: string }[] {
  if (item.answerType === 'choice') return item.options ?? [];
  if (item.answerType === 'open_text') return [];
  return STANDARD_OPTIONS[item.answerType] ?? STANDARD_OPTIONS.yes_partial_no_na;
}

const ANSWER_COLOR: Record<string, string> = {
  yes: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  partial: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  no: 'text-red-400 bg-red-400/10 border-red-400/30',
  not_applicable: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};
const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  low: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  insufficient: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

function answerLabel(value: string | null): string {
  if (value == null) return 'No evidence';
  const map: Record<string, string> = { yes: 'Yes', partial: 'Partial', no: 'No', not_applicable: 'N/A', open_text: 'Open text' };
  return map[value] ?? value;
}

export default function AutofillReview({ items, nistSummary, components }: Props) {
  const router = useRouter();
  const componentsById = useMemo(() => new Map(components.map(c => [c.number, c])), [components]);

  const [decisions, setDecisions] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(
      items.map(it => [
        it.questionId,
        {
          response: it.suggestedAnswer ?? '',
          responseText: '',
          notes: '',
          included: it.suggestedAnswer != null && it.confidence === 'high',
          overridden: false,
        } as Decision,
      ])
    )
  );

  const counts = useMemo(() => ({
    total: items.length,
    filled: items.filter(i => i.suggestedAnswer != null).length,
    needsReview: items.filter(i => i.needsReview).length,
    highConfidence: items.filter(i => i.confidence === 'high' && i.suggestedAnswer != null).length,
    noEvidence: items.filter(i => i.suggestedAnswer == null).length,
  }), [items]);

  const [tab, setTab] = useState<Tab>(counts.needsReview > 0 ? 'needs_review' : 'all');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setDecision(qid: string, patch: Partial<Decision>) {
    setDecisions(prev => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }

  function chooseOption(item: ReviewItem, value: string) {
    setDecision(item.questionId, {
      response: value,
      included: true,
      overridden: value !== item.suggestedAnswer,
    });
  }

  function setOpenText(item: ReviewItem, text: string) {
    setDecision(item.questionId, {
      responseText: text,
      response: text.trim() ? 'open_text' : '',
      included: !!text.trim(),
      overridden: true,
    });
  }

  const appliedCount = useMemo(
    () => items.filter(it => {
      const d = decisions[it.questionId];
      if (!d?.included || !d.response) return false;
      if (d.response === 'open_text') return d.responseText.trim().length > 0;
      return true;
    }).length,
    [items, decisions]
  );

  const filtered = useMemo(() => {
    const match = (i: ReviewItem) => {
      if (tab === 'needs_review') return i.needsReview;
      if (tab === 'filled') return i.suggestedAnswer != null;
      if (tab === 'no_evidence') return i.suggestedAnswer == null;
      return true;
    };
    return items.filter(match).sort(
      (a, b) => Number(b.needsReview) - Number(a.needsReview) || a.displayOrder - b.displayOrder
    );
  }, [items, tab]);

  async function applyToAssessment() {
    setApplying(true);
    setError(null);
    const payload = items
      .filter(it => {
        const d = decisions[it.questionId];
        if (!d?.included || !d.response) return false;
        if (d.response === 'open_text') return d.responseText.trim().length > 0;
        return true;
      })
      .map(it => {
        const d = decisions[it.questionId];
        return {
          questionId: it.questionId,
          response: d.response,
          responseText: d.response === 'open_text' ? d.responseText : undefined,
          auditorNotes: d.notes.trim() || undefined,
          overridden: d.overridden,
        };
      });

    if (payload.length === 0) {
      router.push('/dashboard/assessment');
      return;
    }

    try {
      const res = await fetch('/api/ai-autofill/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to apply answers.');
      }
      router.push('/dashboard/assessment');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply answers.');
      setApplying(false);
    }
  }

  async function startOver() {
    setApplying(true);
    const fd = new FormData();
    fd.append('mode', 'skip');
    try {
      await fetch('/api/ai-autofill/analyze', { method: 'POST', body: fd });
    } catch { /* proceed */ }
    router.push('/dashboard/assessment');
  }

  const familyEntries = nistSummary
    ? Object.entries(nistSummary.controlFamilySummaries).filter(([, v]) => v != null)
    : [];

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'needs_review', label: 'Needs Review', count: counts.needsReview },
    { key: 'filled', label: 'AI Filled', count: counts.filled },
    { key: 'no_evidence', label: 'No Evidence', count: counts.noEvidence },
  ];

  return (
    <div className="min-h-full px-8 py-8">
      {/* Header */}
      <div className="mb-5 max-w-4xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <Sparkles size={20} className="text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">AI Autofill Review</p>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">Review AI suggestions</h1>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          Accept or override each AI-generated answer. Nothing is saved until you apply — you retain full
          authority over every answer.
        </p>
      </div>

      {/* Summary banner */}
      <div className="mb-5 max-w-4xl flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-navy-600 bg-navy-600/30 px-5 py-3 text-sm">
        <span className="text-slate-200">
          AI pre-filled <span className="font-semibold text-teal-400">{counts.filled}</span> of {counts.total} questions
        </span>
        <span className="text-slate-400"><span className="font-semibold text-amber-400">{counts.needsReview}</span> need your review</span>
        <span className="text-slate-400"><span className="font-semibold text-emerald-400">{counts.highConfidence}</span> high confidence</span>
      </div>

      {/* NIST summary (collapsible) */}
      {nistSummary && (
        <div className="mb-5 max-w-4xl rounded-xl border border-navy-600 bg-navy-600/20">
          <button
            onClick={() => setSummaryOpen(o => !o)}
            className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              {summaryOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              What we found in your documents
            </span>
            <a
              href="/api/ai-autofill/nist-summary"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-400 hover:bg-teal-400/20 transition-colors"
            >
              <Download size={12} /> Download NIST Summary PDF
            </a>
          </button>
          {summaryOpen && (
            <div className="border-t border-navy-600 px-5 py-4 space-y-4">
              {nistSummary.overallReadabilityAssessment && (
                <p className="text-xs text-slate-400 italic">{nistSummary.overallReadabilityAssessment}</p>
              )}
              {Object.keys(nistSummary.documentCoverage ?? {}).length > 0 && (
                <div className="space-y-1.5">
                  {Object.entries(nistSummary.documentCoverage).map(([doc, fams]) => (
                    <div key={doc} className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-300"><FileText size={11} /> {doc}</span>
                      {fams.map(f => (
                        <span key={f} className="rounded bg-navy-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{f}</span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {familyEntries.map(([code, text]) => (
                  <div key={code} className="rounded-lg border border-navy-600 bg-navy-800/40 p-3">
                    <p className="font-mono text-[11px] font-semibold text-teal-400 mb-1">{code}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 max-w-4xl flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'border-teal-400/50 bg-teal-400/10 text-teal-400'
                : 'border-navy-600 bg-navy-600/30 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label} <span className="text-slate-500">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Question list */}
      <div className="max-w-4xl space-y-3">
        {filtered.map(item => {
          const d = decisions[item.questionId];
          const comp = componentsById.get(item.componentNumber);
          const opts = getOptions(item);

          return (
            <div key={item.questionId} className="rounded-xl border border-navy-600 bg-navy-600/20 p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-slate-500">{item.questionId}</span>
                    {comp && <span className="text-[10px] text-slate-600">{comp.citation} · {comp.title}</span>}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{item.questionText}</p>
                </div>
                {d?.included && d.response && (
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 flex-shrink-0">
                    <CheckCircle2 size={10} /> Will apply
                  </span>
                )}
              </div>

              {/* AI suggestion */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                  item.suggestedAnswer ? (ANSWER_COLOR[item.suggestedAnswer] ?? 'text-teal-400 bg-teal-400/10 border-teal-400/30') : 'text-orange-400 bg-orange-400/10 border-orange-400/30'
                }`}>
                  AI: {answerLabel(item.suggestedAnswer)}
                </span>
                {item.confidence && (
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${CONFIDENCE_COLOR[item.confidence] ?? CONFIDENCE_COLOR.insufficient}`}>
                    {item.confidence}
                  </span>
                )}
                {item.needsReview && (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    <AlertTriangle size={9} /> Needs review
                  </span>
                )}
              </div>

              {item.reasoning && (
                <p className="mb-3 text-xs text-slate-500 leading-relaxed border-l border-navy-600 pl-2">{item.reasoning}</p>
              )}
              {item.sourceDocuments.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-600">Sources:</span>
                  {item.sourceDocuments.map(s => (
                    <span key={s} className="inline-flex items-center gap-1 rounded bg-navy-800 px-1.5 py-0.5 text-[10px] text-slate-400"><FileText size={9} /> {s}</span>
                  ))}
                </div>
              )}

              {/* Decision controls */}
              {item.answerType === 'open_text' ? (
                <textarea
                  rows={2}
                  value={d?.responseText ?? ''}
                  onChange={e => setOpenText(item, e.target.value)}
                  placeholder="Enter the answer to apply (optional — or leave for manual entry)…"
                  className="w-full rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none resize-none"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {opts.map(opt => {
                    const selected = d?.response === opt.value;
                    const color = ANSWER_COLOR[opt.value] ?? 'text-teal-400 bg-teal-400/10 border-teal-400/30';
                    return (
                      <button
                        key={opt.value}
                        onClick={() => chooseOption(item, opt.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          selected ? color : 'border-navy-600 bg-navy-600/30 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {opt.label}
                        {item.suggestedAnswer === opt.value && <span className="ml-1 text-[9px] opacity-70">(AI)</span>}
                      </button>
                    );
                  })}
                  {d?.included && (
                    <button
                      onClick={() => setDecision(item.questionId, { included: false })}
                      className="rounded-lg border border-navy-600 px-2.5 py-1.5 text-[10px] text-slate-500 hover:text-slate-300"
                    >
                      Don&apos;t apply
                    </button>
                  )}
                </div>
              )}

              {/* Optional notes */}
              <input
                type="text"
                value={d?.notes ?? ''}
                onChange={e => setDecision(item.questionId, { notes: e.target.value })}
                maxLength={2000}
                placeholder="Add a note (optional)…"
                className="mt-2 w-full rounded-lg border border-navy-600 bg-navy-800/40 px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:border-teal-400/40 focus:outline-none"
              />
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 max-w-4xl flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-200/90">{error}</p>
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-6 max-w-4xl flex flex-wrap items-center gap-4">
        <button
          onClick={applyToAssessment}
          disabled={applying}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-5 py-2.5 text-sm font-semibold text-navy-900 hover:bg-teal-300 transition-colors disabled:opacity-60"
        >
          {applying ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
          Apply {appliedCount > 0 ? `${appliedCount} ` : ''}to Assessment
        </button>
        <button
          onClick={startOver}
          disabled={applying}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-60"
        >
          Start Over — Enter Manually
        </button>
      </div>
    </div>
  );
}
