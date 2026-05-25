'use client';

/**
 * PaymentCTA — triggers the Stripe checkout flow (or mock advancement).
 *
 * Shown on the Scoring Dashboard when assessment status is 'scoring' (scores
 * calculated, payment not yet initiated). On click, posts to
 * /api/stripe/checkout. In mock mode the API immediately advances the
 * assessment to 'complete'; in live mode it returns a Stripe checkout URL.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, CheckCircle2 } from 'lucide-react';

export default function PaymentCTA() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handlePay() {
    if (status === 'loading') return;
    setStatus('loading');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const json = await res.json() as { ok?: boolean; mock?: boolean; url?: string; error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? `Server error ${res.status}`);
      }

      if (json.mock) {
        // Mock mode — assessment is already advanced to complete
        setStatus('done');
        setTimeout(() => router.refresh(), 800);
        return;
      }

      if (json.url) {
        // Live Stripe — redirect to Stripe checkout
        window.location.href = json.url;
        return;
      }

      throw new Error('Unexpected response from checkout endpoint.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment initiation failed. Please try again.';
      setErrorMsg(msg);
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-score-green">
        <CheckCircle2 size={16} aria-hidden="true" />
        Payment confirmed — refreshing…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handlePay}
        disabled={status === 'loading'}
        aria-disabled={status === 'loading'}
        className={`
          inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold
          transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400
          ${status === 'loading'
            ? 'cursor-not-allowed bg-teal-400/10 text-teal-400/40'
            : 'bg-teal-400 text-navy-800 hover:bg-teal-300 cursor-pointer'
          }
        `}
      >
        {status === 'loading' ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <CreditCard size={15} aria-hidden="true" />
        )}
        {status === 'loading' ? 'Processing…' : 'Submit & Complete Payment'}
      </button>

      {status === 'error' && errorMsg && (
        <p className="text-xs text-score-red">{errorMsg}</p>
      )}
    </div>
  );
}
