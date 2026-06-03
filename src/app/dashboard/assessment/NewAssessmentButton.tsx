'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Loader2 } from 'lucide-react';

export default function NewAssessmentButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!confirm('Start a new assessment? Your current answers and scores will be archived — this cannot be undone.')) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/assessment/new', { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setError(j.error ?? 'Failed to create new assessment.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-navy-500 bg-navy-600/40 px-4 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-teal-400/40 hover:text-teal-400 disabled:opacity-40"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <PlusCircle size={13} />}
        New Assessment
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
