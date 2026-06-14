/**
 * Notifications — post audit events to Slack, Microsoft Teams, or a generic
 * webhook via incoming-webhook URLs (no OAuth). Slack and classic Teams
 * connectors both accept a simple `{ text }` payload; the generic webhook
 * receives the full structured payload.
 */

import 'server-only';
import { getSlackWebhook, getTeamsWebhook, getGenericWebhook } from './config';

export interface NotifyResult {
  channel: 'slack' | 'teams' | 'webhook';
  ok: boolean;
  error?: string;
}

async function post(url: string, payload: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'request failed' };
  }
}

/** Send a plain-text message to every configured channel. */
export async function sendNotifications(text: string, extra?: Record<string, unknown>): Promise<NotifyResult[]> {
  const results: NotifyResult[] = [];

  const slack = await getSlackWebhook();
  if (slack) results.push({ channel: 'slack', ...(await post(slack, { text })) });

  const teams = await getTeamsWebhook();
  if (teams) results.push({ channel: 'teams', ...(await post(teams, { text })) });

  const webhook = await getGenericWebhook();
  if (webhook) results.push({ channel: 'webhook', ...(await post(webhook, { source: 'ShieldAudit', text, ...extra })) });

  return results;
}
