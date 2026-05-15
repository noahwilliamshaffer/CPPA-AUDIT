'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Calculator } from 'lucide-react';

interface Props {
  hasScores: boolean;
  assessmentId: string;
}

export default function ScoreActions({ hasScores }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCalculate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scoring/calculate', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Calculation failed');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleCalculate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-400/10 border border-teal-400/30 px-4 py-2 text-sm font-medium text-teal-400 transition-all hover:bg-teal-400/20 hover:border-teal-400/60 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : hasScores ? (
          <RefreshCw size={14} />
        ) : (
          <Calculator size={14} />
        )}
        {loading ? 'Calculating…' : hasScores ? 'Recalculate Scores' : 'Calculate Scores'}
      </button>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
