'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, KeyRound, Save, Plug } from 'lucide-react';

interface ConnectorFieldMeta {
  key: string;
  label: string;
  secret: boolean;
  placeholder: string;
  set: boolean;
  value: string;
}
interface ConnectorMeta {
  id: string;
  name: string;
  category: string;
  blurb: string;
  evidence: string;
  docsHint: string;
  configured: boolean;
  fields: ConnectorFieldMeta[];
}
interface Settings {
  jira: { baseUrl: string; email: string; projectKey: string; apiTokenSet: boolean };
  slack: { webhookUrlSet: boolean };
  teams: { webhookUrlSet: boolean };
  webhook: { urlSet: boolean };
  anthropic: { apiKeySet: boolean; model: string };
  confluence: { baseUrl: string; email: string; spaceKey: string; parentPageId: string; apiTokenSet: boolean };
  notion: { parentPageId: string; tokenSet: boolean };
  s3: { endpoint: string; region: string; bucket: string; prefix: string; accessKeyId: string; secretAccessKeySet: boolean };
  connectors: ConnectorMeta[];
}

const CATEGORY_LABELS: Record<string, string> = {
  sso: 'SSO — identity & MFA evidence',
  evidence: 'Evidence connectors',
  grc: 'GRC / privacy',
  esign: 'e-Signature',
};
const CATEGORY_ORDER = ['sso', 'evidence', 'grc', 'esign'];

const secretPlaceholder = (set: boolean) => (set ? '•••••••• saved — leave blank to keep' : 'not set');

function Field({
  label, value, onChange, placeholder, type = 'text', mono = false,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full rounded-lg border border-navy-600 bg-navy-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/20 ${mono ? 'font-mono' : ''}`}
      />
    </label>
  );
}

export default function SettingsForm() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generic state: non-secret values (prefilled) and secret inputs (write-only).
  const [values, setValues] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const v = (path: string) => values[path] ?? '';
  const setV = (path: string) => (val: string) => setValues((s) => ({ ...s, [path]: val }));
  const sec = (path: string) => secrets[path] ?? '';
  const setSec = (path: string) => (val: string) => setSecrets((s) => ({ ...s, [path]: val }));

  // Per-connector test state.
  const [tests, setTests] = useState<Record<string, { state: 'idle' | 'busy' | 'ok' | 'err'; msg: string }>>({});

  async function load() {
    const res = await fetch('/api/settings');
    const data: Settings = await res.json();
    setCfg(data);
    const nv: Record<string, string> = {
      'jira.baseUrl': data.jira.baseUrl,
      'jira.email': data.jira.email,
      'jira.projectKey': data.jira.projectKey,
      'anthropic.model': data.anthropic.model,
      'confluence.baseUrl': data.confluence.baseUrl,
      'confluence.email': data.confluence.email,
      'confluence.spaceKey': data.confluence.spaceKey,
      'confluence.parentPageId': data.confluence.parentPageId,
      'notion.parentPageId': data.notion.parentPageId,
      's3.endpoint': data.s3.endpoint,
      's3.region': data.s3.region,
      's3.bucket': data.s3.bucket,
      's3.prefix': data.s3.prefix,
      's3.accessKeyId': data.s3.accessKeyId,
    };
    for (const c of data.connectors) {
      for (const f of c.fields) if (!f.secret) nv[`conn.${c.id}.${f.key}`] = f.value;
    }
    setValues(nv);
    setSecrets({});
  }

  useEffect(() => {
    load().catch(() => setError('Could not load settings.'));
  }, []);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    const body: Record<string, unknown> = {
      jira: { baseUrl: v('jira.baseUrl'), email: v('jira.email'), projectKey: v('jira.projectKey') },
      anthropic: { model: v('anthropic.model') },
      confluence: {
        baseUrl: v('confluence.baseUrl'), email: v('confluence.email'),
        spaceKey: v('confluence.spaceKey'), parentPageId: v('confluence.parentPageId'),
      },
      notion: { parentPageId: v('notion.parentPageId') },
      s3: {
        endpoint: v('s3.endpoint'), region: v('s3.region'), bucket: v('s3.bucket'),
        prefix: v('s3.prefix'), accessKeyId: v('s3.accessKeyId'),
      },
      slack: {}, teams: {}, webhook: {},
      connectors: {} as Record<string, Record<string, string>>,
    };
    const put = (group: string, key: string, path: string) => {
      if (sec(path)) (body[group] as Record<string, string>)[key] = sec(path);
    };
    put('jira', 'apiToken', 'jira.apiToken');
    put('anthropic', 'apiKey', 'anthropic.apiKey');
    put('confluence', 'apiToken', 'confluence.apiToken');
    put('notion', 'token', 'notion.token');
    put('s3', 'secretAccessKey', 's3.secretAccessKey');
    put('slack', 'webhookUrl', 'slack.webhookUrl');
    put('teams', 'webhookUrl', 'teams.webhookUrl');
    put('webhook', 'url', 'webhook.url');

    const connectors = body.connectors as Record<string, Record<string, string>>;
    for (const c of cfg.connectors) {
      const obj: Record<string, string> = {};
      for (const f of c.fields) {
        const path = `conn.${c.id}.${f.key}`;
        if (f.secret) {
          if (sec(path)) obj[f.key] = sec(path);
        } else {
          obj[f.key] = v(path);
        }
      }
      if (Object.keys(obj).length) connectors[c.id] = obj;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      setSecrets({});
      await load();
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function testConnector(id: string) {
    setTests((t) => ({ ...t, [id]: { state: 'busy', msg: '' } }));
    try {
      const res = await fetch('/api/integrations/connectors/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = !!data.ok;
      setTests((t) => ({ ...t, [id]: { state: ok ? 'ok' : 'err', msg: data.detail ?? data.error ?? (ok ? 'Connected.' : 'Failed.') } }));
    } catch (e) {
      setTests((t) => ({ ...t, [id]: { state: 'err', msg: e instanceof Error ? e.message : 'Request failed' } }));
    }
  }

  if (!cfg) {
    return (
      <div className="rounded-xl border border-navy-600 bg-navy-600/20 p-5 text-xs text-slate-500">
        <Loader2 size={14} className="inline animate-spin text-teal-400" /> Loading configuration…
      </div>
    );
  }

  const byCategory = (cat: string) => cfg.connectors.filter((c) => c.category === cat);

  return (
    <section className="rounded-xl border border-navy-600 bg-navy-600/20 p-5">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} className="text-teal-400" />
        <h2 className="font-sora text-sm font-semibold text-slate-100">Credentials</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Tokens are encrypted at rest. Leave a secret field blank to keep the saved value.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* AI */}
        <div className="space-y-2 sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">AI (Anthropic)</p>
          <Field label={`API key ${cfg.anthropic.apiKeySet ? '(saved)' : ''}`} type="password" mono value={sec('anthropic.apiKey')} onChange={setSec('anthropic.apiKey')} placeholder={secretPlaceholder(cfg.anthropic.apiKeySet)} />
          <Field label="Model" value={v('anthropic.model')} onChange={setV('anthropic.model')} placeholder="claude-sonnet-4-5" mono />
        </div>

        {/* Jira */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Jira</p>
          <Field label="Base URL" value={v('jira.baseUrl')} onChange={setV('jira.baseUrl')} placeholder="https://your-site.atlassian.net" mono />
          <Field label="Email" value={v('jira.email')} onChange={setV('jira.email')} placeholder="you@example.com" mono />
          <Field label={`API token ${cfg.jira.apiTokenSet ? '(saved)' : ''}`} type="password" mono value={sec('jira.apiToken')} onChange={setSec('jira.apiToken')} placeholder={secretPlaceholder(cfg.jira.apiTokenSet)} />
          <Field label="Project key" value={v('jira.projectKey')} onChange={setV('jira.projectKey')} placeholder="SEC" mono />
        </div>

        {/* Notifications */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notifications (webhook URLs)</p>
          <Field label={`Slack ${cfg.slack.webhookUrlSet ? '(saved)' : ''}`} type="password" mono value={sec('slack.webhookUrl')} onChange={setSec('slack.webhookUrl')} placeholder={secretPlaceholder(cfg.slack.webhookUrlSet)} />
          <Field label={`Microsoft Teams ${cfg.teams.webhookUrlSet ? '(saved)' : ''}`} type="password" mono value={sec('teams.webhookUrl')} onChange={setSec('teams.webhookUrl')} placeholder={secretPlaceholder(cfg.teams.webhookUrlSet)} />
          <Field label={`Generic webhook ${cfg.webhook.urlSet ? '(saved)' : ''}`} type="password" mono value={sec('webhook.url')} onChange={setSec('webhook.url')} placeholder={secretPlaceholder(cfg.webhook.urlSet)} />
        </div>

        {/* Confluence */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Confluence</p>
          <Field label="Base URL" value={v('confluence.baseUrl')} onChange={setV('confluence.baseUrl')} placeholder="https://your-site.atlassian.net" mono />
          <Field label="Email" value={v('confluence.email')} onChange={setV('confluence.email')} placeholder="you@example.com" mono />
          <Field label={`API token ${cfg.confluence.apiTokenSet ? '(saved)' : ''}`} type="password" mono value={sec('confluence.apiToken')} onChange={setSec('confluence.apiToken')} placeholder={secretPlaceholder(cfg.confluence.apiTokenSet)} />
          <Field label="Space key" value={v('confluence.spaceKey')} onChange={setV('confluence.spaceKey')} placeholder="SEC" mono />
          <Field label="Parent page ID (optional)" value={v('confluence.parentPageId')} onChange={setV('confluence.parentPageId')} placeholder="123456" mono />
        </div>

        {/* Notion */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notion</p>
          <Field label={`Integration token ${cfg.notion.tokenSet ? '(saved)' : ''}`} type="password" mono value={sec('notion.token')} onChange={setSec('notion.token')} placeholder={secretPlaceholder(cfg.notion.tokenSet)} />
          <Field label="Parent page ID" value={v('notion.parentPageId')} onChange={setV('notion.parentPageId')} placeholder="32-char page id" mono />
        </div>

        {/* S3 */}
        <div className="space-y-2 sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Evidence locker (S3 / S3-compatible)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Bucket" value={v('s3.bucket')} onChange={setV('s3.bucket')} placeholder="shieldaudit-evidence" mono />
            <Field label="Region" value={v('s3.region')} onChange={setV('s3.region')} placeholder="us-east-1" mono />
            <Field label="Access key ID" value={v('s3.accessKeyId')} onChange={setV('s3.accessKeyId')} placeholder="AKIA…" mono />
            <Field label={`Secret access key ${cfg.s3.secretAccessKeySet ? '(saved)' : ''}`} type="password" mono value={sec('s3.secretAccessKey')} onChange={setSec('s3.secretAccessKey')} placeholder={secretPlaceholder(cfg.s3.secretAccessKeySet)} />
            <Field label="Endpoint (optional — S3-compatible)" value={v('s3.endpoint')} onChange={setV('s3.endpoint')} placeholder="https://minio.example.com" mono />
            <Field label="Key prefix (optional)" value={v('s3.prefix')} onChange={setV('s3.prefix')} placeholder="audits/" mono />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-teal-300 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
          {saved ? 'Saved' : 'Save credentials'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>

      {/* Scaffolded connectors */}
      <div className="mt-7 border-t border-navy-700 pt-5">
        <div className="flex items-center gap-2 mb-1">
          <Plug size={15} className="text-amber-300/80" />
          <h3 className="font-sora text-sm font-semibold text-slate-100">Connectors</h3>
          <span className="rounded px-2 py-0.5 text-[10px] font-medium text-amber-300 bg-amber-400/10 border border-amber-400/30">Scaffold · connect your account</span>
        </div>
        <p className="text-xs text-slate-500 mb-4 max-w-2xl">
          Real API clients targeting each provider&apos;s auth endpoint. Enter credentials, <strong>Save</strong>, then{' '}
          <strong>Test connection</strong>. Not yet wired into autofill — these verify connectivity and store credentials
          encrypted for the evidence-ingestion step.
        </p>

        <div className="space-y-5">
          {CATEGORY_ORDER.filter((cat) => byCategory(cat).length > 0).map((cat) => (
            <div key={cat}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">{CATEGORY_LABELS[cat]}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {byCategory(cat).map((c) => {
                  const t = tests[c.id] ?? { state: 'idle' as const, msg: '' };
                  return (
                    <div key={c.id} className="rounded-lg border border-navy-700 bg-navy-700/30 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-200">{c.name}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${c.configured ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/30' : 'text-slate-500 bg-slate-500/10 border border-slate-600/30'}`}>
                          {c.configured ? 'Configured' : 'Not set'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-1">{c.blurb}</p>
                      <p className="text-[10px] text-slate-600 mb-2">{c.docsHint}</p>
                      <div className="space-y-2">
                        {c.fields.map((f) => {
                          const path = `conn.${c.id}.${f.key}`;
                          return f.secret ? (
                            <Field key={f.key} label={`${f.label} ${f.set ? '(saved)' : ''}`} type="password" mono value={sec(path)} onChange={setSec(path)} placeholder={secretPlaceholder(f.set)} />
                          ) : (
                            <Field key={f.key} label={f.label} value={v(path)} onChange={setV(path)} placeholder={f.placeholder} mono />
                          );
                        })}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => testConnector(c.id)}
                          disabled={t.state === 'busy'}
                          className="inline-flex items-center gap-1.5 rounded-md border border-navy-600 bg-navy-600/40 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-teal-400 hover:border-teal-400/30 transition-colors disabled:opacity-60"
                        >
                          {t.state === 'busy' ? <Loader2 size={11} className="animate-spin" /> : t.state === 'ok' ? <CheckCircle2 size={11} className="text-emerald-400" /> : t.state === 'err' ? <XCircle size={11} className="text-red-400" /> : <Plug size={11} />}
                          Test connection
                        </button>
                        {t.msg && <span className={`text-[10px] leading-tight ${t.state === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{t.msg}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
