'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, Upload, Trash2, Download, Loader2, FileText } from 'lucide-react';

interface EvidenceItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  description: string | null;
  uploadedAt: string;
  downloadUrl: string;
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function EvidenceLocker({ componentNumber }: { componentNumber: number }) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/evidence/list?component=${componentNumber}`);
      const d = await r.json();
      setItems(d.items ?? []);
    } catch {
      setError('Could not load evidence.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentNumber]);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('component', String(componentNumber));
    if (desc.trim()) fd.append('description', desc.trim());
    try {
      const r = await fetch('/api/evidence/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? 'Upload failed');
      setDesc('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this evidence file? The removal is recorded in the audit trail.')) return;
    await fetch(`/api/evidence/${id}/delete`, { method: 'POST' });
    await load();
  }

  return (
    <section className="mt-8 max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Paperclip size={16} className="text-teal-400" />
        <h2 className="font-sora text-sm font-semibold text-slate-100">Evidence Locker</h2>
        <span className="text-[11px] text-slate-500">§7123(e) — auditor-observed evidence</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Attach the documents, screenshots, or exports the auditor observed for this component. Files are stored locally
        and retained with the audit (uploads and removals are recorded in the audit trail).
      </p>

      {/* List */}
      {loading ? (
        <p className="text-xs text-slate-500"><Loader2 size={12} className="inline animate-spin text-teal-400" /> Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500 mb-4">No evidence attached to this component yet.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-lg border border-navy-700 bg-navy-700/30 px-3 py-2">
              <FileText size={14} className="text-slate-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <a href={it.downloadUrl} className="text-xs text-slate-200 hover:text-teal-400 truncate block" title={it.fileName}>
                  {it.fileName}
                </a>
                <p className="text-[10px] text-slate-500">
                  {fmtSize(it.fileSizeBytes)}
                  {it.description ? ` · ${it.description}` : ''}
                </p>
              </div>
              <a href={it.downloadUrl} className="text-slate-500 hover:text-teal-400" title="Download" aria-label="Download">
                <Download size={14} />
              </a>
              <button onClick={() => remove(it.id)} className="text-slate-500 hover:text-red-400" title="Remove" aria-label="Remove">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Upload */}
      <div className="space-y-2 border-t border-navy-700 pt-4">
        <input
          ref={fileRef}
          type="file"
          className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-navy-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-navy-500"
        />
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Optional description (what this evidences)"
          className="w-full rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={upload}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-teal-300 transition-colors disabled:opacity-60"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Upload evidence
          </button>
          <span className="text-[10px] text-slate-600">PDF, Office, images, CSV/TXT · max 25 MB</span>
          {error && <span className="text-[11px] text-red-400">{error}</span>}
        </div>
      </div>
    </section>
  );
}
