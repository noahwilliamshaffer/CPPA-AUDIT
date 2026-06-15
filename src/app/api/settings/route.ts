/**
 * GET  /api/settings — current integration/AI config. Secrets are never
 *                      returned, only `…Set` booleans. Non-secret values
 *                      (URLs, email, keys, model) reflect store→env. Also
 *                      returns the connector catalog (metadata + per-field set
 *                      state, no secret values).
 * POST /api/settings — save provided fields. Secrets are encrypted at rest.
 *                      A field that's absent is left unchanged; an empty string
 *                      clears it.
 */

import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/settings/store';
import { SETTING_KEYS } from '@/lib/integrations/config';
import { connectorCatalog, getConnectorById, connectorStoreKey } from '@/lib/integrations/connectors';

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
    confluence: {
      baseUrl: await effVal(SETTING_KEYS.confluenceBaseUrl, 'CONFLUENCE_BASE_URL'),
      email: await effVal(SETTING_KEYS.confluenceEmail, 'CONFLUENCE_EMAIL'),
      spaceKey: await effVal(SETTING_KEYS.confluenceSpaceKey, 'CONFLUENCE_SPACE_KEY'),
      parentPageId: await effVal(SETTING_KEYS.confluenceParentPageId, 'CONFLUENCE_PARENT_PAGE_ID'),
      apiTokenSet: await effSet(SETTING_KEYS.confluenceApiToken, 'CONFLUENCE_API_TOKEN'),
    },
    notion: {
      parentPageId: await effVal(SETTING_KEYS.notionParentPageId, 'NOTION_PARENT_PAGE_ID'),
      tokenSet: await effSet(SETTING_KEYS.notionToken, 'NOTION_TOKEN'),
    },
    s3: {
      endpoint: await effVal(SETTING_KEYS.s3Endpoint, 'S3_ENDPOINT'),
      region: await effVal(SETTING_KEYS.s3Region, 'S3_REGION'),
      bucket: await effVal(SETTING_KEYS.s3Bucket, 'S3_BUCKET'),
      prefix: await effVal(SETTING_KEYS.s3Prefix, 'S3_PREFIX'),
      accessKeyId: await effVal(SETTING_KEYS.s3AccessKeyId, 'S3_ACCESS_KEY_ID'),
      secretAccessKeySet: await effSet(SETTING_KEYS.s3SecretAccessKey, 'S3_SECRET_ACCESS_KEY'),
    },
    connectors: await connectorCatalog(),
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
    [SETTING_KEYS.confluenceBaseUrl, body?.confluence?.baseUrl, false],
    [SETTING_KEYS.confluenceEmail, body?.confluence?.email, false],
    [SETTING_KEYS.confluenceApiToken, body?.confluence?.apiToken, true],
    [SETTING_KEYS.confluenceSpaceKey, body?.confluence?.spaceKey, false],
    [SETTING_KEYS.confluenceParentPageId, body?.confluence?.parentPageId, false],
    [SETTING_KEYS.notionToken, body?.notion?.token, true],
    [SETTING_KEYS.notionParentPageId, body?.notion?.parentPageId, false],
    [SETTING_KEYS.s3Endpoint, body?.s3?.endpoint, false],
    [SETTING_KEYS.s3Region, body?.s3?.region, false],
    [SETTING_KEYS.s3Bucket, body?.s3?.bucket, false],
    [SETTING_KEYS.s3AccessKeyId, body?.s3?.accessKeyId, false],
    [SETTING_KEYS.s3SecretAccessKey, body?.s3?.secretAccessKey, true],
    [SETTING_KEYS.s3Prefix, body?.s3?.prefix, false],
  ];

  for (const [key, value, secret] of ops) {
    if (value === undefined) continue; // field not provided → leave unchanged
    await setSetting(key, typeof value === 'string' ? value : String(value ?? ''), secret);
  }

  // Connectors: body.connectors = { [connectorId]: { [fieldKey]: value } }
  const connectors = body?.connectors as Record<string, Record<string, unknown>> | undefined;
  if (connectors && typeof connectors === 'object') {
    for (const [id, fields] of Object.entries(connectors)) {
      const def = getConnectorById(id);
      if (!def || !fields || typeof fields !== 'object') continue;
      for (const f of def.fields) {
        const value = (fields as Record<string, unknown>)[f.key];
        if (value === undefined) continue;
        await setSetting(connectorStoreKey(id, f.key), typeof value === 'string' ? value : String(value ?? ''), f.secret);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
