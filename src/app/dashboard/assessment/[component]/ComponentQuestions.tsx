'use client';

import { useState, useRef } from 'react';
import { CheckCircle2, AlertCircle, MinusCircle, XCircle, Loader2, Save, type LucideIcon } from 'lucide-react';

type ResponseValue = 'yes' | 'partial' | 'no' | 'not_applicable';
type RiskWeight = 'critical' | 'high' | 'medium' | 'low';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Question {
  id: string;
  questionText: string;
  riskWeight: RiskWeight;
  nistCsfMapping: string | null;
  cisControlMapping: string | null;
  displayOrder: number;
}

interface ExistingAnswer {
  questionId: string;
  response: ResponseValue;
  auditorNotes: string | null;
}

interface Props {
  componentNumber: number;
  componentTitle: string;
  questions: Question[];
  existingAnswers: ExistingAnswer[];
  assessmentId: string | null;
}

const RESPONSE_OPTIONS: {
  value: ResponseValue;
  label: string;
  active: string;
  inactive: string;
  Icon: LucideIcon;
}[] = [
  {
    value: 'yes',
    label: 'Yes',
    active: 'border-emerald-400 bg-emerald-400/15 text-emerald-400',
    inactive: 'border-navy-600 bg-navy-600/30 text-slate-500 hover:border-emerald-400/40 hover:text-emerald-400/60',
    Icon: CheckCircle2,
  },
  {
    value: 'partial',
    label: 'Partial',
    active: 'border-amber-400 bg-amber-400/15 text-amber-400',
    inactive: 'border-navy-600 bg-navy-600/30 text-slate-500 hover:border-amber-400/40 hover:text-amber-400/60',
    Icon: AlertCircle,
  },
  {
    value: 'no',
    label: 'No',
    active: 'border-red-400 bg-red-400/15 text-red-400',
    inactive: 'border-navy-600 bg-navy-600/30 text-slate-500 hover:border-red-400/40 hover:text-red-400/60',
    Icon: XCircle,
  },
  {
    value: 'not_applicable',
    label: 'N/A',
    active: 'border-slate-500 bg-slate-500/15 text-slate-400',
    inactive: 'border-navy-600 bg-navy-600/30 text-slate-500 hover:border-slate-500/40',
    Icon: MinusCircle,
  },
];

const RISK_BADGE: Record<RiskWeight, string> = {
  critical: 'text-red-400 bg-red-400/10 border border-red-400/30',
  high: 'text-orange-400 bg-orange-400/10 border border-orange-400/30',
  medium: 'text-amber-400 bg-amber-400/10 border border-amber-400/30',
  low: 'text-slate-400 bg-slate-500/10 border border-slate-500/30',
};

export default function ComponentQuestions({
  questions,
  existingAnswers,
  assessmentId: initialAssessmentId,
}: Props) {
  const [responses, setResponses] = useState<Record<string, ResponseValue>>(() =>
    Object.fromEntries(existingAnswers.map(a => [a.questionId, a.response]))
  );

  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      existingAnswers
        .filter(a => a.auditorNotes)
        .map(a => [a.questionId, a.auditorNotes!])
    )
  );

  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});

  const assessmentIdRef = useRef<string | null>(initialAssessmentId);
  const createAssessmentRef = useRef<Promise<string | null> | null>(null);

  async function ensureAssessment(): Promise<string | null> {
    if (assessmentIdRef.current) return assessmentIdRef.current;
    if (!createAssessmentRef.current) {
      createAssessmentRef.current = fetch('/api/assessment/current', { method: 'POST' })
        .then(r => r.json())
        .then((data: { assessmentId?: string }) => {
          assessmentIdRef.current = data.assessmentId ?? null;
          return assessmentIdRef.current;
        })
        .catch(() => null);
    }
    return createAssessmentRef.current;
  }

  async function saveAnswer(questionId: string, response: ResponseValue, auditorNotes?: string) {
    setSaveStatuses(prev => ({ ...prev, [questionId]: 'saving' }));

    const assessmentId = await ensureAssessment();
    if (!assessmentId) {
      setSaveStatuses(prev => ({ ...prev, [questionId]: 'error' }));
      return;
    }

    try {
      const res = await fetch('/api/assessment/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId, questionId, response, auditorNotes }),
      });
      if (!res.ok) throw new Error('save failed');
      setSaveStatuses(prev => ({ ...prev, [questionId]: 'saved' }));
      setTimeout(() => setSaveStatuses(prev => ({ ...prev, [questionId]: 'idle' })), 2500);
    } catch {
      setSaveStatuses(prev => ({ ...prev, [questionId]: 'error' }));
    }
  }

  function handleResponseClick(questionId: string, value: ResponseValue) {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    const currentNotes = notes[questionId];
    saveAnswer(questionId, value, currentNotes);
  }

  function handleNotesBlur(questionId: string) {
    const response = responses[questionId];
    if (!response) return;
    const currentNotes = notes[questionId];
    saveAnswer(questionId, response, currentNotes);
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-6 text-sm text-slate-400">
        No questions defined for this component.
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {questions.map((q, idx) => {
        const response = responses[q.id];
        const status = saveStatuses[q.id] ?? 'idle';
        const needsNotes = response === 'partial' || response === 'no';

        return (
          <div
            key={q.id}
            className="rounded-xl border border-navy-600 bg-navy-600/20 p-5"
          >
            {/* Question header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 font-mono text-xs text-slate-600 flex-shrink-0">
                  Q{idx + 1}
                </span>
                <p className="text-sm text-slate-200 leading-relaxed">{q.questionText}</p>
              </div>
              {/* Save status indicator */}
              <div className="flex-shrink-0 mt-0.5">
                {status === 'saving' && (
                  <Loader2 size={13} className="text-teal-400 animate-spin" />
                )}
                {status === 'saved' && (
                  <CheckCircle2 size={13} className="text-emerald-400" />
                )}
                {status === 'error' && (
                  <XCircle size={13} className="text-red-400" aria-label="Save failed — check connection" />
                )}
              </div>
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${RISK_BADGE[q.riskWeight]}`}>
                {q.riskWeight}
              </span>
              {q.nistCsfMapping && (
                <span className="font-mono text-[10px] text-slate-600">{q.nistCsfMapping}</span>
              )}
              {q.cisControlMapping && (
                <span className="font-mono text-[10px] text-slate-600">{q.cisControlMapping}</span>
              )}
            </div>

            {/* Response buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {RESPONSE_OPTIONS.map(opt => {
                const selected = response === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleResponseClick(q.id, opt.value)}
                    disabled={status === 'saving'}
                    className={`
                      flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium
                      transition-all duration-150 disabled:opacity-50
                      ${selected ? opt.active : opt.inactive}
                    `}
                  >
                    <opt.Icon size={14} />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Notes textarea — shown when partial or no */}
            {needsNotes && (
              <div className="mt-2">
                <label className="mb-1 block text-xs text-slate-500">
                  Auditor notes <span className="text-slate-600">(required for partial/no)</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={notes[q.id] ?? ''}
                  onChange={e => setNotes(prev => ({ ...prev, [q.id]: e.target.value }))}
                  onBlur={() => handleNotesBlur(q.id)}
                  placeholder="Describe the gap, compensating control, or remediation plan..."
                  className="w-full rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/20 resize-none"
                />
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[10px] text-slate-600">
                    {(notes[q.id] ?? '').length}/2000
                  </p>
                  {(notes[q.id] ?? '').length > 0 && status === 'idle' && (
                    <button
                      onClick={() => handleNotesBlur(q.id)}
                      className="flex items-center gap-1 text-[10px] text-teal-400 hover:text-teal-300"
                    >
                      <Save size={10} />
                      Save notes
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Summary footer */}
      <div className="pt-2 pb-4">
        <p className="text-xs text-slate-600">
          {Object.keys(responses).length} of {questions.length} questions answered
        </p>
      </div>
    </div>
  );
}
