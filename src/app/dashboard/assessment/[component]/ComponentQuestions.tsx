'use client';

import { useState, useRef, useMemo } from 'react';
import {
  CheckCircle2, AlertCircle, MinusCircle, XCircle, Loader2, Save, Sparkles, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type AnswerType = 'yes_partial_no_na' | 'yes_no' | 'yes_no_na' | 'open_text' | 'choice';

interface QuestionOption { value: string; label: string }

interface Question {
  id: string;
  questionText: string;
  riskWeight: string;
  nistCsfMapping: string | null;
  nist80053Mapping: string | null;
  cisControlMapping: string | null;
  displayOrder: number;
  answerType: AnswerType;
  options: QuestionOption[] | null;
  parentQuestionId: string | null;
  triggerCondition: { showWhen?: string[] } | null;
}

interface ExistingAnswer {
  questionId: string;
  response: string;
  responseText: string | null;
  auditorNotes: string | null;
  aiGenerated?: boolean;
  aiConfidence?: string | null;
  aiReasoning?: string | null;
  needsClientReview?: boolean;
}

/** Per-question AI suggestion metadata from the autofill session (may exist without a saved answer). */
interface AiResult {
  needsReview: boolean;
  confidence: string | null;
  reasoning: string | null;
  sourceDocuments: string[];
  suggestedAnswer: string | null;
}

interface Props {
  componentNumber: number;
  componentTitle: string;
  questions: Question[];
  existingAnswers: ExistingAnswer[];
  assessmentId: string | null;
  aiResults?: Record<string, AiResult>;
}

// ── Option styling ──────────────────────────────────────────────────────────
const OPTION_STYLES: Record<string, { active: string; inactive: string; Icon: LucideIcon }> = {
  yes: {
    active: 'border-emerald-400 bg-emerald-400/15 text-emerald-400',
    inactive: 'border-navy-600 bg-navy-600/30 text-slate-500 hover:border-emerald-400/40 hover:text-emerald-400/60',
    Icon: CheckCircle2,
  },
  partial: {
    active: 'border-amber-400 bg-amber-400/15 text-amber-400',
    inactive: 'border-navy-600 bg-navy-600/30 text-slate-500 hover:border-amber-400/40 hover:text-amber-400/60',
    Icon: AlertCircle,
  },
  no: {
    active: 'border-red-400 bg-red-400/15 text-red-400',
    inactive: 'border-navy-600 bg-navy-600/30 text-slate-500 hover:border-red-400/40 hover:text-red-400/60',
    Icon: XCircle,
  },
  not_applicable: {
    active: 'border-slate-500 bg-slate-500/15 text-slate-400',
    inactive: 'border-navy-600 bg-navy-600/30 text-slate-500 hover:border-slate-500/40',
    Icon: MinusCircle,
  },
};

const NEUTRAL_STYLE = {
  active: 'border-teal-400 bg-teal-400/15 text-teal-400',
  inactive: 'border-navy-600 bg-navy-600/30 text-slate-500 hover:border-teal-400/40 hover:text-teal-400/60',
  Icon: CheckCircle2 as LucideIcon,
};

const STANDARD_OPTIONS: Record<string, QuestionOption[]> = {
  yes_partial_no_na: [
    { value: 'yes', label: 'Yes' },
    { value: 'partial', label: 'Partial' },
    { value: 'no', label: 'No' },
    { value: 'not_applicable', label: 'N/A' },
  ],
  yes_no: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ],
  yes_no_na: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'not_applicable', label: 'N/A' },
  ],
};

function optionsFor(q: Question): QuestionOption[] {
  if (q.answerType === 'choice') return q.options ?? [];
  return STANDARD_OPTIONS[q.answerType] ?? STANDARD_OPTIONS.yes_partial_no_na;
}

const RISK_BADGE: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10 border border-red-400/30',
  high: 'text-orange-400 bg-orange-400/10 border border-orange-400/30',
  medium: 'text-amber-400 bg-amber-400/10 border border-amber-400/30',
  low: 'text-slate-400 bg-slate-500/10 border border-slate-500/30',
};

const CONFIDENCE_BADGE: Record<string, string> = {
  high: 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/30',
  medium: 'text-amber-400 bg-amber-400/10 border border-amber-400/30',
  low: 'text-orange-400 bg-orange-400/10 border border-orange-400/30',
  insufficient: 'text-slate-400 bg-slate-500/10 border border-slate-500/30',
};

export default function ComponentQuestions({
  questions,
  existingAnswers,
  assessmentId: initialAssessmentId,
  aiResults = {},
}: Props) {
  const questionsById = useMemo(
    () => Object.fromEntries(questions.map(q => [q.id, q])),
    [questions]
  );

  const [responses, setResponses] = useState<Record<string, string>>(() =>
    Object.fromEntries(existingAnswers.map(a => [a.questionId, a.response]))
  );
  const [responseTexts, setResponseTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      existingAnswers.filter(a => a.responseText).map(a => [a.questionId, a.responseText!])
    )
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      existingAnswers.filter(a => a.auditorNotes).map(a => [a.questionId, a.auditorNotes!])
    )
  );
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});

  // Track which answers were AI-applied so we can show the "AI assisted" tag
  // until the auditor changes them.
  const [aiApplied, setAiApplied] = useState<Record<string, ExistingAnswer>>(() =>
    Object.fromEntries(
      existingAnswers.filter(a => a.aiGenerated).map(a => [a.questionId, a])
    )
  );

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

  // ── Conditional visibility ─────────────────────────────────────────────────
  function isVisible(q: Question, state: Record<string, string>): boolean {
    if (!q.parentQuestionId) return true;
    const parent = questionsById[q.parentQuestionId];
    if (parent && !isVisible(parent, state)) return false;
    const showWhen = q.triggerCondition?.showWhen ?? [];
    const parentResp = state[q.parentQuestionId];
    return parentResp != null && showWhen.includes(parentResp);
  }

  async function persistAnswer(
    questionId: string,
    response: string,
    opts: { responseText?: string; auditorNotes?: string } = {}
  ) {
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
        body: JSON.stringify({ assessmentId, questionId, response, ...opts }),
      });
      if (!res.ok) throw new Error('save failed');
      setSaveStatuses(prev => ({ ...prev, [questionId]: 'saved' }));
      setTimeout(() => setSaveStatuses(prev => ({ ...prev, [questionId]: 'idle' })), 2500);
    } catch {
      setSaveStatuses(prev => ({ ...prev, [questionId]: 'error' }));
    }
  }

  async function clearAnswer(questionId: string) {
    const assessmentId = assessmentIdRef.current;
    if (!assessmentId) return;
    try {
      await fetch('/api/assessment/answer', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId, questionId }),
      });
    } catch {
      /* best-effort */
    }
  }

  /** After a response change, clear any now-hidden descendant answers. */
  function clearHiddenDescendants(nextResponses: Record<string, string>) {
    const toClear = questions.filter(
      q => responses[q.id] != null && !isVisible(q, nextResponses)
    );
    if (toClear.length === 0) return;
    setResponses(prev => {
      const n = { ...prev };
      toClear.forEach(q => delete n[q.id]);
      return n;
    });
    setResponseTexts(prev => {
      const n = { ...prev };
      toClear.forEach(q => delete n[q.id]);
      return n;
    });
    setAiApplied(prev => {
      const n = { ...prev };
      toClear.forEach(q => delete n[q.id]);
      return n;
    });
    toClear.forEach(q => clearAnswer(q.id));
  }

  function handleResponseClick(question: Question, value: string) {
    const next = { ...responses, [question.id]: value };
    setResponses(next);
    // A manual click means this is no longer the AI's answer.
    setAiApplied(prev => {
      if (!prev[question.id]) return prev;
      const n = { ...prev };
      delete n[question.id];
      return n;
    });
    if (question.answerType === 'open_text') {
      persistAnswer(question.id, 'open_text', {
        responseText: responseTexts[question.id] ?? '',
        auditorNotes: notes[question.id],
      });
    } else {
      persistAnswer(question.id, value, { auditorNotes: notes[question.id] });
    }
    clearHiddenDescendants(next);
  }

  function handleOpenTextBlur(question: Question) {
    const text = (responseTexts[question.id] ?? '').trim();
    if (!text) return;
    const next = { ...responses, [question.id]: 'open_text' };
    setResponses(next);
    setAiApplied(prev => {
      if (!prev[question.id]) return prev;
      const n = { ...prev };
      delete n[question.id];
      return n;
    });
    persistAnswer(question.id, 'open_text', {
      responseText: text,
      auditorNotes: notes[question.id],
    });
  }

  function handleNotesBlur(question: Question) {
    const response = responses[question.id];
    if (!response) return;
    if (question.answerType === 'open_text') {
      persistAnswer(question.id, 'open_text', {
        responseText: responseTexts[question.id] ?? '',
        auditorNotes: notes[question.id],
      });
    } else {
      persistAnswer(question.id, response, { auditorNotes: notes[question.id] });
    }
  }

  const visibleQuestions = questions
    .filter(q => isVisible(q, responses))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-6 text-sm text-slate-400">
        No questions defined for this component.
      </div>
    );
  }

  const answeredCount = visibleQuestions.filter(q => responses[q.id] != null).length;

  return (
    <div className="max-w-2xl space-y-4">
      {visibleQuestions.map(q => {
        const response = responses[q.id];
        const status = saveStatuses[q.id] ?? 'idle';
        const needsNotes = response === 'partial' || response === 'no';
        const opts = optionsFor(q);
        const isConditional = q.parentQuestionId != null;

        const ai = aiResults[q.id];
        const applied = aiApplied[q.id];
        const showNeedsReview = !!ai?.needsReview && response == null;

        return (
          <div
            key={q.id}
            className={`rounded-xl border bg-navy-600/20 p-5 ${
              isConditional ? 'border-navy-600 border-l-2 border-l-teal-400/40 ml-4' : 'border-navy-600'
            }`}
          >
            {/* Question header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 font-mono text-xs text-slate-600 flex-shrink-0">{q.id}</span>
                <p className="text-sm text-slate-200 leading-relaxed">{q.questionText}</p>
              </div>
              <div className="flex-shrink-0 mt-0.5">
                {status === 'saving' && <Loader2 size={13} className="text-teal-400 animate-spin" />}
                {status === 'saved' && <CheckCircle2 size={13} className="text-emerald-400" />}
                {status === 'error' && (
                  <XCircle size={13} className="text-red-400" aria-label="Save failed — check connection" />
                )}
              </div>
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${RISK_BADGE[q.riskWeight] ?? RISK_BADGE.low}`}>
                {q.riskWeight}
              </span>
              {q.nistCsfMapping && (
                <span className="font-mono text-[10px] text-slate-600">{q.nistCsfMapping}</span>
              )}
              {q.nist80053Mapping && (
                <span className="font-mono text-[10px] text-slate-600">{q.nist80053Mapping}</span>
              )}
              {applied && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-teal-400 bg-teal-400/10 border border-teal-400/30">
                  <Sparkles size={9} /> AI assisted
                  {applied.aiConfidence && <span className="text-teal-400/70">· {applied.aiConfidence}</span>}
                </span>
              )}
            </div>

            {/* Needs-review banner (AI could not confidently answer) */}
            {showNeedsReview && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
                <AlertTriangle size={13} className="mt-0.5 text-amber-400 flex-shrink-0" />
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  AI could not confidently answer this question from your documents. Please answer manually.
                  {ai?.reasoning && <span className="block mt-0.5 text-amber-200/60">{ai.reasoning}</span>}
                </p>
              </div>
            )}

            {/* AI reasoning for an applied answer */}
            {applied?.aiReasoning && !showNeedsReview && (
              <p className="mb-3 text-[11px] text-slate-500 leading-relaxed border-l border-teal-400/30 pl-2">
                {applied.aiReasoning}
              </p>
            )}

            {/* Controls */}
            {q.answerType === 'open_text' ? (
              <textarea
                rows={3}
                maxLength={5000}
                value={responseTexts[q.id] ?? ''}
                onChange={e => setResponseTexts(prev => ({ ...prev, [q.id]: e.target.value }))}
                onBlur={() => handleOpenTextBlur(q)}
                placeholder="Describe in detail..."
                className="w-full rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/20 resize-none"
              />
            ) : (
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.min(opts.length, 4)}, minmax(0, 1fr))` }}
              >
                {opts.map(opt => {
                  const selected = response === opt.value;
                  const style = OPTION_STYLES[opt.value] ?? NEUTRAL_STYLE;
                  const Icon = style.Icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleResponseClick(q, opt.value)}
                      disabled={status === 'saving'}
                      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all duration-150 disabled:opacity-50 ${
                        selected ? style.active : style.inactive
                      }`}
                    >
                      <Icon size={14} />
                      <span className="text-center leading-tight">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Notes textarea — shown when partial or no */}
            {needsNotes && (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-slate-500">
                  Auditor notes <span className="text-slate-600">(required for partial/no)</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={notes[q.id] ?? ''}
                  onChange={e => setNotes(prev => ({ ...prev, [q.id]: e.target.value }))}
                  onBlur={() => handleNotesBlur(q)}
                  placeholder="Describe the gap, compensating control, or remediation plan..."
                  className="w-full rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/20 resize-none"
                />
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[10px] text-slate-600">{(notes[q.id] ?? '').length}/2000</p>
                  {(notes[q.id] ?? '').length > 0 && status === 'idle' && (
                    <button
                      onClick={() => handleNotesBlur(q)}
                      className="flex items-center gap-1 text-[10px] text-teal-400 hover:text-teal-300"
                    >
                      <Save size={10} /> Save notes
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
          {answeredCount} of {visibleQuestions.length} questions answered
        </p>
      </div>
    </div>
  );
}
