/**
 * Jira integration — create issues from remediation tickets via the Jira Cloud
 * REST API (v2, basic auth with email + API token — no OAuth dance).
 *
 * Uses the plain-text v2 `description` field (v3 requires Atlassian Document
 * Format). The Jira `priority` field is intentionally omitted — it's commonly
 * restricted by project screens and would fail the create; severity is conveyed
 * via labels + the description instead.
 */

import 'server-only';
import type { RemediationTicket } from '@/lib/tickets';
import type { JiraConfig } from './config';

export interface JiraPushResult {
  created: { key: string; url: string; summary: string }[];
  failed: { summary: string; error: string }[];
}

// Jira labels may not contain spaces.
function sanitizeLabel(l: string): string {
  return l.replace(/\s+/g, '_').replace(/[^\w.\-:]/g, '');
}

export async function pushTicketsToJira(
  tickets: RemediationTicket[],
  cfg: JiraConfig
): Promise<JiraPushResult> {
  const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString('base64');
  const created: JiraPushResult['created'] = [];
  const failed: JiraPushResult['failed'] = [];

  for (const t of tickets) {
    const body = {
      fields: {
        project: { key: cfg.projectKey },
        summary: t.summary.slice(0, 254),
        description: t.description,
        issuetype: { name: 'Task' },
        labels: t.labels.map(sanitizeLabel),
      },
    };
    try {
      const res = await fetch(`${cfg.baseUrl}/rest/api/2/issue`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        failed.push({ summary: t.summary, error: `HTTP ${res.status}: ${text.slice(0, 200)}` });
        continue;
      }
      const data = (await res.json()) as { key: string };
      created.push({ key: data.key, url: `${cfg.baseUrl}/browse/${data.key}`, summary: t.summary });
    } catch (e) {
      failed.push({ summary: t.summary, error: e instanceof Error ? e.message : 'request failed' });
    }
  }

  return { created, failed };
}
