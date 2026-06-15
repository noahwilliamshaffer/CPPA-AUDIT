/**
 * Confluence Cloud integration — publish the audit summary / SSP as a page via
 * the REST API (v1 content endpoint, Basic auth with email + API token, same
 * Atlassian credential model as Jira — no OAuth dance).
 *
 * Body is sent in Confluence "storage format" (XHTML). See audit-content.ts for
 * the summary builder.
 */

import 'server-only';
import type { ConfluenceConfig } from './config';

export interface ConfluencePublishResult {
  ok: boolean;
  id?: string;
  url?: string;
  status: number;
  error?: string;
}

export async function publishToConfluence(
  cfg: ConfluenceConfig,
  title: string,
  storageHtml: string
): Promise<ConfluencePublishResult> {
  const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString('base64');
  const body = {
    type: 'page',
    title,
    space: { key: cfg.spaceKey },
    ...(cfg.parentPageId ? { ancestors: [{ id: cfg.parentPageId }] } : {}),
    body: { storage: { value: storageHtml, representation: 'storage' } },
  };

  try {
    const res = await fetch(`${cfg.baseUrl}/wiki/rest/api/content`, {
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
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id: string; _links?: { base?: string; webui?: string } };
    const url =
      data._links?.base && data._links?.webui
        ? `${data._links.base}${data._links.webui}`
        : `${cfg.baseUrl}/wiki/spaces/${cfg.spaceKey}`;
    return { ok: true, id: data.id, url, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'request failed' };
  }
}
