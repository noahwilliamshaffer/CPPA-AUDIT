'use client';

/**
 * ReportActions — client component for Document A / Document B generation.
 *
 * Calls POST /api/reports/generate with the chosen reportType and format,
 * receives the binary stream, and triggers a browser download.
 * Shows per-button loading and success states.
 */

import { useState } from 'react';
import { Download, Loader2, CheckCircle2, AlertCircle, FileText, FileType2 } from 'lucide-react';

type ReportType = 'audit_report' | 'executive_certification' | 'ssp';
type Format = 'pdf' | 'docx';
type BtnState = 'idle' | 'generating' | 'done' | 'error';

interface ReportFormatButtonProps {
  reportType: ReportType;
  format: Format;
  endpoint?: string;
  disabled?: boolean;
  disabledReason?: string;
}

function ReportFormatButton({
  reportType,
  format,
  endpoint = '/api/reports/generate',
  disabled = false,
  disabledReason,
}: ReportFormatButtonProps) {
  const [state, setState] = useState<BtnState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleGenerate() {
    if (disabled || state === 'generating') return;

    setState('generating');
    setErrorMsg(null);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType, format }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? `Server error ${res.status}`);
      }

      // Extract filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const defaultExt = format === 'pdf' ? 'pdf' : 'docx';
      const filename = match?.[1] ?? `ShieldAudit-${reportType}.${defaultExt}`;

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
  const isPdf = format === 'pdf';

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleGenerate}
        disabled={isDisabled}
        title={disabled ? disabledReason : `Download ${format.toUpperCase()}`}
        aria-disabled={isDisabled}
        className={`
          inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold
          transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400
          ${isDisabled
            ? 'cursor-not-allowed opacity-40 bg-navy-700 text-slate-500'
            : state === 'done'
            ? 'bg-green-500/20 text-green-400 cursor-default'
            : state === 'error'
            ? 'bg-red-500/20 text-red-400 cursor-default'
            : isPdf
            ? 'bg-teal-400/20 text-teal-400 hover:bg-teal-400/30 cursor-pointer border border-teal-400/30'
            : 'bg-slate-600/30 text-slate-300 hover:bg-slate-600/50 cursor-pointer border border-slate-600/50'
          }
        `}
      >
        {state === 'generating' ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : state === 'done' ? (
          <CheckCircle2 size={13} aria-hidden="true" />
        ) : state === 'error' ? (
          <AlertCircle size={13} aria-hidden="true" />
        ) : isPdf ? (
          <FileText size={13} aria-hidden="true" />
        ) : (
          <FileType2 size={13} aria-hidden="true" />
        )}
        {state === 'generating'
          ? 'Generating…'
          : state === 'done'
          ? 'Downloaded!'
          : state === 'error'
          ? 'Failed'
          : `Download ${format.toUpperCase()}`}
      </button>

      {state === 'error' && errorMsg && (
        <p className="text-xs text-red-400 leading-snug max-w-xs">{errorMsg}</p>
      )}
    </div>
  );
}

// ── Public exports ─────────────────────────────────────────────────────────────

interface ReportActionButtonProps {
  reportType: ReportType;
  endpoint?: string;
  label?: string;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Shows PDF + DOCX download buttons for a report type.
 * The PDF button is primary (prominent); DOCX is secondary.
 */
export function ReportActionButton({
  reportType,
  endpoint,
  disabled = false,
  disabledReason,
}: ReportActionButtonProps) {
  return (
    <div className="flex flex-col gap-2">
      <ReportFormatButton
        reportType={reportType}
        format="pdf"
        endpoint={endpoint}
        disabled={disabled}
        disabledReason={disabledReason}
      />
      <ReportFormatButton
        reportType={reportType}
        format="docx"
        endpoint={endpoint}
        disabled={disabled}
        disabledReason={disabledReason}
      />
    </div>
  );
}

/**
 * Legacy single-format button (kept for backwards compat).
 */
export function SingleFormatButton({
  reportType,
  format,
  disabled = false,
  disabledReason,
}: {
  reportType: ReportType;
  format: Format;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <ReportFormatButton
      reportType={reportType}
      format={format}
      disabled={disabled}
      disabledReason={disabledReason}
    />
  );
}
