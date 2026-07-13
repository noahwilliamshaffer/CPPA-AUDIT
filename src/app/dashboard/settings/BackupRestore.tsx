'use client';

import { useRef, useState } from 'react';
import { Download, Upload, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ImportResult {
  assessmentCount: number;
  answerCount: number;
  evidenceFileCount: number;
  replacedExisting: boolean;
}

export default function BackupRestore() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/data/export');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Export failed (HTTP ${res.status}).`);
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const filename = /filename="([^"]+)"/.exec(cd)?.[1] ?? 'shieldaudit-backup.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function doImport(backup: unknown, confirmReplace: boolean): Promise<ImportResult | 'needs-confirm'> {
    const res = await fetch('/api/data/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup, confirmReplace }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (json.code === 'CONFIRM_REQUIRED') return 'needs-confirm';
      throw new Error(json.error ?? `Import failed (HTTP ${res.status}).`);
    }
    return json as ImportResult;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const text = await file.text();
      let backup: unknown;
      try {
        backup = JSON.parse(text);
      } catch {
        throw new Error('That file is not valid JSON.');
      }

      let result = await doImport(backup, false);
      if (result === 'needs-confirm') {
        const ok = window.confirm(
          'An organization already exists on this install. Importing this backup will PERMANENTLY REPLACE all current assessments, answers, evidence, and reports with the contents of this file. This cannot be undone.\n\nContinue?'
        );
        if (!ok) {
          setImporting(false);
          return;
        }
        result = await doImport(backup, true);
      }
      if (result === 'needs-confirm') throw new Error('Import could not be confirmed.');

      setSuccess(
        `Import complete — ${result.assessmentCount} assessment(s), ${result.answerCount} answer(s), ${result.evidenceFileCount} evidence file(s) restored. Reloading…`
      );
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-xl border border-navy-600 bg-navy-600/30 p-5">
      <p className="text-sm text-slate-300 mb-1">
        Download your entire audit dataset as a single JSON file, or restore
        a previously downloaded backup onto this install.
      </p>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Includes assessments, answers, evidence files, test/interview logs,
        scores, gaps, reports, and the audit trail. Integration credentials
        and the question bank are not included.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleExport}
          disabled={exporting || importing}
          className="inline-flex items-center gap-2 rounded-lg border border-teal-400/30 bg-teal-400/10 px-4 py-2 text-xs font-medium text-teal-400 transition-colors hover:bg-teal-400/20 disabled:opacity-40"
        >
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          Download Backup (JSON)
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing || exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-navy-500 bg-navy-600/40 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-amber-400/40 hover:text-amber-400 disabled:opacity-40"
        >
          {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          Restore from Backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-red-400">
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {error}
        </p>
      )}
      {success && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-score-green">
          <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" /> {success}
        </p>
      )}
    </div>
  );
}
