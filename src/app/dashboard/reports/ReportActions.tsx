'use client';

/**
 * ReportActions — client component for Document A / Document B generation.
 *
 * Calls POST /api/reports/generate with the chosen reportType, receives the
 * DOCX binary stream, and triggers a browser download. Shows per-button
 * loading and success states.
 */

import { useState } from 'react';
import { Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type ReportType = 'audit_report' | 'executive_certification';
type BtnState = 'idle' | 'generating' | 'done' | 'error';

interface ReportActionButtonProps {
  reportType: ReportType;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function ReportActionButton({
  reportType,
  label,
  disabled = false,
  disabledReason,
}: ReportActionButtonProps) {
  const [state, setState] = useState<BtnState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleGenerate() {
    if (disabled || state === 'generating') return;

    setState('generating');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? `Server error ${res.status}`);
      }

      // Extract filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `ShieldAudit-${reportType}.docx`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setState('done');
      // Reset back to idle after 3 seconds so user can regenerate
      setTimeout(() => setState('idle'), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed. Please try again.';
      setErrorMsg(msg);
      setState('error');
      setTimeout(() => setState('idle'), 5000);
    }
  }

  const isDisabled = disabled || state === 'generating';

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleGenerate}
        disabled={isDisabled}
        title={disabled ? disabledReason : undefined}
        aria-disabled={isDisabled}
        className={`
          inline-flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold
          transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400
          ${isDisabled
            ? 'cursor-not-allowed bg-teal-400/10 text-teal-400/40'
            : state === 'done'
            ? 'bg-score-green/20 text-score-green cursor-default'
            : state === 'error'
            ? 'bg-score-red/20 text-score-red cursor-default'
            : 'bg-teal-400/20 text-teal-400 hover:bg-teal-400/30 cursor-pointer'
          }
        `}
      >
        {state === 'generating' ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : state === 'done' ? (
          <CheckCircle2 size={13} aria-hidden="true" />
        ) : state === 'error' ? (
          <AlertCircle size={13} aria-hidden="true" />
        ) : (
          <Download size={13} aria-hidden="true" />
        )}
        {state === 'generating'
          ? 'Generating…'
          : state === 'done'
          ? 'Downloaded!'
          : state === 'error'
          ? 'Failed'
          : label}
      </button>

      {state === 'error' && errorMsg && (
        <p className="text-xs text-score-red leading-snug max-w-xs">{errorMsg}</p>
      )}
    </div>
  );
}
