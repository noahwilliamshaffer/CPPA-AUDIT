'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, ArrowUpRight, Send, FileText, UploadCloud } from 'lucide-react';

type BtnState = 'idle' | 'busy' | 'done' | 'error';

function useAction(endpoint: string, onMessage: (data: Record<string, unknown>) => string) {
  const [state, setState] = useState<BtnState>('idle');
  const [msg, setMsg] = useState('');
  async function run() {
    setState('busy');
    setMsg('');
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
      setState('done');
      setMsg(onMessage(data));
      setTimeout(() => setState('idle'), 6000);
    } catch (e) {
      setState('error');
      setMsg(e instanceof Error ? e.message : 'Request failed');
      setTimeout(() => setState('idle'), 8000);
    }
  }
  return { state, msg, run };
}

function ActionResult({ state, msg }: { state: BtnState; msg: string }) {
  if (!msg) return null;
  const color = state === 'error' ? 'text-red-300' : 'text-emerald-300';
  return <p className={`mt-2 text-xs ${color} leading-relaxed`}>{msg}</p>;
}

export function JiraPushButton({ ticketCount }: { ticketCount: number }) {
  const { state, msg, run } = useAction('/api/integrations/jira/push', (d) => {
    const c = (d.counts as { created?: number; failed?: number }) ?? {};
    if (typeof d.message === 'string') return d.message;
    return `Created ${c.created ?? 0} Jira issue(s)${c.failed ? `, ${c.failed} failed` : ''}.`;
  });
  return (
    <div>
      <button
        onClick={run}
        disabled={state === 'busy'}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-teal-300 transition-colors disabled:opacity-60"
      >
        {state === 'busy' ? <Loader2 size={14} className="animate-spin" /> : state === 'done' ? <CheckCircle2 size={14} /> : <ArrowUpRight size={14} />}
        Push {ticketCount > 0 ? `${ticketCount} ` : ''}ticket{ticketCount === 1 ? '' : 's'} to Jira
      </button>
      <ActionResult state={state} msg={msg} />
    </div>
  );
}

function PublishButton({ endpoint, label, icon }: { endpoint: string; label: string; icon: React.ReactNode }) {
  const { state, msg, run } = useAction(endpoint, (d) => {
    if (typeof d.url === 'string') return `Published — ${d.url}`;
    if (typeof d.count === 'number') return `Uploaded ${d.count} file(s).`;
    return 'Done.';
  });
  return (
    <div>
      <button
        onClick={run}
        disabled={state === 'busy'}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-teal-300 transition-colors disabled:opacity-60"
      >
        {state === 'busy' ? <Loader2 size={14} className="animate-spin" /> : state === 'done' ? <CheckCircle2 size={14} /> : icon}
        {label}
      </button>
      <ActionResult state={state} msg={msg} />
    </div>
  );
}

export function ConfluencePublishButton() {
  return <PublishButton endpoint="/api/integrations/confluence/publish" label="Publish audit summary" icon={<FileText size={14} />} />;
}

export function NotionPublishButton() {
  return <PublishButton endpoint="/api/integrations/notion/publish" label="Publish audit summary" icon={<FileText size={14} />} />;
}

export function S3UploadButton() {
  return <PublishButton endpoint="/api/integrations/s3/upload" label="Upload to evidence locker" icon={<UploadCloud size={14} />} />;
}

export function NotifyButton() {
  const { state, msg, run } = useAction('/api/integrations/notify', (d) => {
    const results = (d.results as { channel: string; ok: boolean }[]) ?? [];
    const sent = results.filter(r => r.ok).map(r => r.channel);
    return sent.length ? `Sent to ${sent.join(', ')}.` : 'No channels accepted the message.';
  });
  return (
    <div>
      <button
        onClick={run}
        disabled={state === 'busy'}
        className="inline-flex items-center gap-2 rounded-lg border border-teal-400/30 bg-teal-400/10 px-4 py-2 text-sm font-medium text-teal-400 hover:bg-teal-400/20 transition-colors disabled:opacity-60"
      >
        {state === 'busy' ? <Loader2 size={14} className="animate-spin" /> : state === 'done' ? <CheckCircle2 size={14} /> : <Send size={14} />}
        Send audit summary
      </button>
      <ActionResult state={state} msg={msg} />
    </div>
  );
}
