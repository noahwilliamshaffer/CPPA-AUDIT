'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, KeyRound, Save } from 'lucide-react';

interface Settings {
  jira: { baseUrl: string; email: string; projectKey: string; apiTokenSet: boolean };
  slack: { webhookUrlSet: boolean };
  teams: { webhookUrlSet: boolean };
  webhook: { urlSet: boolean };
  anthropic: { apiKeySet: boolean; model: string };
}

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

  // Non-secret (prefilled) + secret (entered, never prefilled) inputs.
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [jiraApiToken, setJiraApiToken] = useState('');
  const [slack, setSlack] = useState('');
  const [teams, setTeams] = useState('');
  const [webhook, setWebhook] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [anthropicModel, setAnthropicModel] = useState('');

  async function load() {
    const res = await fetch('/api/settings');
    const data: Settings = await res.json();
    setCfg(data);
    setJiraBaseUrl(data.jira.baseUrl);
    setJiraEmail(data.jira.email);
    setJiraProjectKey(data.jira.projectKey);
    setAnthropicModel(data.anthropic.model);
  }

  useEffect(() => {
    load().catch(() => setError('Could not load settings.'));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    // Non-secrets always sent (empty clears); secrets only when typed.
    const body: Record<string, Record<string, string>> = {
      jira: { baseUrl: jiraBaseUrl, email: jiraEmail, projectKey: jiraProjectKey },
      anthropic: { model: anthropicModel },
      slack: {},
      teams: {},
      webhook: {},
    };
    if (jiraApiToken) body.jira.apiToken = jiraApiToken;
    if (anthropicKey) body.anthropic.apiKey = anthropicKey;
    if (slack) body.slack.webhookUrl = slack;
    if (teams) body.teams.webhookUrl = teams;
    if (webhook) body.webhook.url = webhook;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      // Clear secret inputs, refresh masked state + server status cards.
      setJiraApiToken(''); setAnthropicKey(''); setSlack(''); setTeams(''); setWebhook('');
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

  if (!cfg) {
    return (
      <div className="rounded-xl border border-navy-600 bg-navy-600/20 p-5 text-xs text-slate-500">
        <Loader2 size={14} className="inline animate-spin text-teal-400" /> Loading configuration…
      </div>
    );
  }

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
          <Field label={`API key ${cfg.anthropic.apiKeySet ? '(saved)' : ''}`} type="password" mono value={anthropicKey} onChange={setAnthropicKey} placeholder={secretPlaceholder(cfg.anthropic.apiKeySet)} />
          <Field label="Model" value={anthropicModel} onChange={setAnthropicModel} placeholder="claude-sonnet-4-5" mono />
        </div>

        {/* Jira */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Jira</p>
          <Field label="Base URL" value={jiraBaseUrl} onChange={setJiraBaseUrl} placeholder="https://your-site.atlassian.net" mono />
          <Field label="Email" value={jiraEmail} onChange={setJiraEmail} placeholder="you@example.com" mono />
          <Field label={`API token ${cfg.jira.apiTokenSet ? '(saved)' : ''}`} type="password" mono value={jiraApiToken} onChange={setJiraApiToken} placeholder={secretPlaceholder(cfg.jira.apiTokenSet)} />
          <Field label="Project key" value={jiraProjectKey} onChange={setJiraProjectKey} placeholder="SEC" mono />
        </div>

        {/* Notifications */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notifications (webhook URLs)</p>
          <Field label={`Slack ${cfg.slack.webhookUrlSet ? '(saved)' : ''}`} type="password" mono value={slack} onChange={setSlack} placeholder={secretPlaceholder(cfg.slack.webhookUrlSet)} />
          <Field label={`Microsoft Teams ${cfg.teams.webhookUrlSet ? '(saved)' : ''}`} type="password" mono value={teams} onChange={setTeams} placeholder={secretPlaceholder(cfg.teams.webhookUrlSet)} />
          <Field label={`Generic webhook ${cfg.webhook.urlSet ? '(saved)' : ''}`} type="password" mono value={webhook} onChange={setWebhook} placeholder={secretPlaceholder(cfg.webhook.urlSet)} />
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
    </section>
  );
}
