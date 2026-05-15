'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ClipboardCheck,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Question bank — §7120(b)(1)–(5), OR logic
// ---------------------------------------------------------------------------

const QUESTIONS = [
  {
    cite: '§7120(b)(1)',
    text: 'Did your business have annual gross revenues exceeding $25 million (adjusted for inflation) in the preceding calendar year?',
    detail:
      'Includes all revenues attributable to business conducted in California, regardless of where headquarters are located.',
  },
  {
    cite: '§7120(b)(2)',
    text: 'Did your business buy, sell, or share for commercial purposes the personal information of 100,000 or more consumers or households annually?',
    detail:
      '"Share" includes disclosure for cross-context behavioral advertising. Household data counts separately from individual consumer data.',
  },
  {
    cite: '§7120(b)(3)',
    text: 'Does your business derive 50% or more of its annual revenues from selling consumers’ personal information?',
    detail:
      '"Sell" means disclosing personal information for monetary or other valuable consideration to a third party.',
  },
  {
    cite: '§7120(b)(4)',
    text: 'Does your business annually buy, sell, or share the personal information of 25,000 or more consumers AND derive 25% or more of its annual revenues from that data?',
    detail:
      'Both conditions must be true simultaneously. Meeting only one of the two sub-conditions does not trigger this threshold.',
  },
  {
    cite: '§7120(b)(5)',
    text: 'Did your business annually buy or receive for commercial purposes the personal information of 10,000 or more consumers?',
    detail:
      '"Receive" includes obtaining personal information in exchange for any valuable consideration, including non-monetary.',
  },
];

// ---------------------------------------------------------------------------
// Result screen
// ---------------------------------------------------------------------------

function ResultScreen({
  covered,
  onRestart,
}: {
  covered: boolean;
  onRestart: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center text-center py-8">
      {covered ? (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/15 mb-5">
            <AlertTriangle size={32} className="text-amber-400" />
          </div>
          <h2 className="font-sora text-2xl font-semibold text-slate-100 mb-2">
            Covered Under §7120
          </h2>
          <p className="text-sm text-slate-400 max-w-md mb-2">
            Your organization meets at least one coverage threshold and is required to
            complete a CPPA cybersecurity audit.
          </p>
          <p className="text-xs text-slate-500 max-w-md mb-8">
            Module 2 (Audit Assessment) is now unlocked. Your submission deadline has been
            calculated based on your revenue tier.
          </p>
          <button
            onClick={() => router.push('/dashboard/assessment')}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-6 py-2.5 text-sm font-semibold text-navy-800 transition-colors hover:bg-teal-300"
          >
            <ClipboardCheck size={16} />
            Proceed to Audit Assessment
          </button>
          <button
            onClick={() => router.push('/dashboard/eligibility')}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Back to Eligibility Overview
          </button>
        </>
      ) : (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-score-green/15 mb-5">
            <ShieldCheck size={32} className="text-score-green" />
          </div>
          <h2 className="font-sora text-2xl font-semibold text-slate-100 mb-2">
            Not Covered Under §7120
          </h2>
          <p className="text-sm text-slate-400 max-w-md mb-2">
            Your organization does not meet any of the five coverage thresholds and is
            not required to complete a CPPA cybersecurity audit at this time.
          </p>
          <p className="text-xs text-slate-500 max-w-md mb-8">
            If your business circumstances change — such as revenue growth or increased
            data processing — re-run the screener to update your determination.
          </p>
          <button
            onClick={() => router.push('/dashboard/eligibility')}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-6 py-2.5 text-sm font-semibold text-navy-800 transition-colors hover:bg-teal-300"
          >
            Back to Eligibility Overview
          </button>
          <button
            onClick={onRestart}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Re-run Screener
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export default function ScreenerWizard() {
  const [step, setStep] = useState(0); // 0–4 = questions, 5 = submitting, 6 = result
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [covered, setCovered] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentQuestion = QUESTIONS[step];
  const totalQuestions = QUESTIONS.length;
  const isOnQuestion = step < totalQuestions;

  async function handleAnswer(answer: boolean) {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    // Short-circuit: if "yes" and OR logic fires, we can stop early but
    // regulations require all 5 questions to be answered for complete
    // documentation. Continue through all questions.
    if (step < totalQuestions - 1) {
      setStep(step + 1);
      return;
    }

    // All 5 answered — submit
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/eligibility/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: newAnswers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to save result.');
      }
      const data = await res.json();
      setCovered(data.covered);
      setStep(totalQuestions + 1); // result screen
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setStep(step); // stay on last question
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (step > 0) {
      setAnswers(answers.slice(0, -1));
      setStep(step - 1);
    }
  }

  function handleRestart() {
    setStep(0);
    setAnswers([]);
    setCovered(null);
    setError(null);
  }

  // Result screen
  if (step > totalQuestions) {
    return <ResultScreen covered={covered!} onRestart={handleRestart} />;
  }

  // Submitting overlay
  if (submitting) {
    return (
      <div className="flex flex-col items-center py-16 gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
        <p className="text-sm text-slate-400">Saving your determination&hellip;</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">
            Question {step + 1} of {totalQuestions}
          </span>
          <span className="text-xs text-slate-500">
            {Math.round(((step) / totalQuestions) * 100)}% complete
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-navy-600">
          <div
            className="h-1.5 rounded-full bg-teal-400 transition-all duration-300"
            style={{ width: `${(step / totalQuestions) * 100}%` }}
          />
        </div>
        {/* Step dots */}
        <div className="flex items-center justify-between mt-2">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i < step
                  ? 'bg-teal-400'
                  : i === step
                  ? 'bg-teal-400/60'
                  : 'bg-navy-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-xl bg-navy-600/50 border border-navy-600 p-6 mb-6">
        <p className="text-xs font-mono text-teal-400 mb-3">{currentQuestion.cite}</p>
        <p className="font-sora text-lg font-semibold text-slate-100 leading-snug mb-4">
          {currentQuestion.text}
        </p>
        <p className="text-xs text-slate-500 leading-relaxed border-t border-navy-600 pt-4">
          {currentQuestion.detail}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson/10 px-4 py-3 text-sm text-crimson">
          {error}
        </div>
      )}

      {/* Answer buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => handleAnswer(true)}
          className="flex-1 flex items-center justify-center gap-2.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-5 py-3.5 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-400/20 hover:border-amber-400/50"
        >
          <CheckCircle2 size={16} />
          Yes
        </button>
        <button
          onClick={() => handleAnswer(false)}
          className="flex-1 flex items-center justify-center gap-2.5 rounded-lg border border-navy-600 bg-navy-600/50 px-5 py-3.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-navy-600 hover:text-slate-100"
        >
          <XCircle size={16} />
          No
        </button>
      </div>

      {/* Back */}
      {step > 0 && (
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronLeft size={14} />
          Back to previous question
        </button>
      )}
    </div>
  );
}
