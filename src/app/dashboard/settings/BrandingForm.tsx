'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, Palette, Save } from 'lucide-react';

interface BrandConfig {
  companyName: string;
  accentColor: string;
  logoUrl: string;
  reportFooter: string;
}

export default function BrandingForm() {
  const router = useRouter();
  const [cfg, setCfg] = useState<BrandConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/branding');
    setCfg(await res.json());
  }

  useEffect(() => {
    load().catch(() => setError('Could not load branding.'));
  }, []);

  function set<K extends keyof BrandConfig>(key: K, value: string) {
    setCfg((c) => (c ? { ...c, [key]: value } : c));
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      router.refresh(); // re-render the sidebar with new branding
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!cfg) {
    return (
      <div className="rounded-xl border border-navy-600 bg-navy-600/30 p-5 text-xs text-slate-500">
        <Loader2 size={14} className="inline animate-spin text-teal-400" /> Loading branding…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-navy-600 bg-navy-600/30 p-5">
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Substitute your firm&apos;s name, logo, accent color, and a report footer throughout the platform and on generated
        documents. Leave a field blank to use the ShieldAudit default.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Firm / company name</span>
          <input
            type="text"
            value={cfg.companyName}
            onChange={(e) => set('companyName', e.target.value)}
            placeholder="ShieldAudit"
            className="w-full rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Accent color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={cfg.accentColor || '#2dd4bf'}
              onChange={(e) => set('accentColor', e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-navy-600 bg-navy-800/60"
              aria-label="Accent color picker"
            />
            <input
              type="text"
              value={cfg.accentColor}
              onChange={(e) => set('accentColor', e.target.value)}
              placeholder="#2dd4bf (default)"
              className="flex-1 rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none"
            />
          </div>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs text-slate-400">Logo URL</span>
          <input
            type="text"
            value={cfg.logoUrl}
            onChange={(e) => set('logoUrl', e.target.value)}
            placeholder="https://yourfirm.example/logo.png (replaces the shield icon)"
            className="w-full rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs text-slate-400">Report footer</span>
          <input
            type="text"
            value={cfg.reportFooter}
            onChange={(e) => set('reportFooter', e.target.value)}
            placeholder="e.g. Prepared by Acme Security LLC · audit@acme.example"
            className="w-full rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-teal-300 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
          {saved ? 'Saved' : 'Save branding'}
        </button>
        {saved && <span className="text-xs text-slate-500 inline-flex items-center gap-1"><Palette size={12} /> Sidebar updated — reports use it on next generation.</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
