/**
 * GET  /api/settings — current integration/AI config. Secrets are never
 *                      returned, only `…Set` booleans. Non-secret values
 *                      (URLs, email, project key, model) reflect store→env.
 * POST /api/settings — save provided fields. Secrets are encrypted at rest.
 *                      A field that's absent is left unchanged; an empty string
 *                      clears it.
 */

import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/settings/store';
import { SETTING_KEYS } from '@/lib/integrations/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function effVal(key: string, env: string): Promise<string> {
  return (await getSetting(key)) ?? (process.env[env]?.trim() || '');
}
async function effSet(key: string, env: string): Promise<boolean> {
  return !!(await getSetting(key)) || !!process.env[env]?.trim();
}

export async function GET() {
  return NextResponse.json({
    jira: {
      baseUrl: await effVal(SETTING_KEYS.jiraBaseUrl, 'JIRA_BASE_URL'),
      email: await effVal(SETTING_KEYS.jiraEmail, 'JIRA_EMAIL'),
      projectKey: await effVal(SETTING_KEYS.jiraProjectKey, 'JIRA_PROJECT_KEY'),
      apiTokenSet: await effSet(SETTING_KEYS.jiraApiToken, 'JIRA_API_TOKEN'),
    },
    slack: { webhookUrlSet: await effSet(SETTING_KEYS.slackWebhookUrl, 'SLACK_WEBHOOK_URL') },
    teams: { webhookUrlSet: await effSet(SETTING_KEYS.teamsWebhookUrl, 'TEAMS_WEBHOOK_URL') },
    webhook: { urlSet: await effSet(SETTING_KEYS.genericWebhookUrl, 'WEBHOOK_URL') },
    anthropic: {
      apiKeySet: await effSet(SETTING_KEYS.anthropicApiKey, 'ANTHROPIC_API_KEY'),
      model: await effVal(SETTING_KEYS.anthropicModel, 'ANTHROPIC_MODEL'),
    },
  });
}

export async function POST(req: Request) {
  let body: Record<string, Record<string, unknown>>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const ops: [string, unknown, boolean][] = [
    [SETTING_KEYS.jiraBaseUrl, body?.jira?.baseUrl, false],
    [SETTING_KEYS.jiraEmail, body?.jira?.email, false],
    [SETTING_KEYS.jiraApiToken, body?.jira?.apiToken, true],
    [SETTING_KEYS.jiraProjectKey, body?.jira?.projectKey, false],
    [SETTING_KEYS.slackWebhookUrl, body?.slack?.webhookUrl, true],
    [SETTING_KEYS.teamsWebhookUrl, body?.teams?.webhookUrl, true],
    [SETTING_KEYS.genericWebhookUrl, body?.webhook?.url, true],
    [SETTING_KEYS.anthropicApiKey, body?.anthropic?.apiKey, true],
    [SETTING_KEYS.anthropicModel, body?.anthropic?.model, false],
  ];

  for (const [key, value, secret] of ops) {
    if (value === undefined) continue; // field not provided → leave unchanged
    await setSetting(key, typeof value === 'string' ? value : String(value ?? ''), secret);
  }

  return NextResponse.json({ ok: true });
}
