/**
 * Notion integration — publish the audit summary / SSP as a page under a parent
 * page via the Notion REST API (integration token = Bearer auth).
 *
 * Children blocks are built in audit-content.ts. Notion caps a page-create at
 * 100 child blocks, so we slice defensively.
 */

import 'server-only';
import type { NotionConfig } from './config';

const NOTION_VERSION = '2022-06-28';
// Override only for testing or a Notion-compatible proxy; defaults to the real API.
const NOTION_API_BASE = (process.env.NOTION_API_BASE || 'https://api.notion.com').replace(/\/+$/, '');

export interface NotionBlock {
  object: 'block';
  type: string;
  [k: string]: unknown;
}

export interface NotionPublishResult {
  ok: boolean;
  id?: string;
  url?: string;
  status: number;
  error?: string;
}

export async function publishToNotion(
  cfg: NotionConfig,
  title: string,
  blocks: NotionBlock[]
): Promise<NotionPublishResult> {
  const body = {
    parent: { page_id: cfg.parentPageId },
    properties: { title: { title: [{ text: { content: title.slice(0, 2000) } }] } },
    children: blocks.slice(0, 100),
  };

  try {
    const res = await fetch(`${NOTION_API_BASE}/v1/pages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id: string; url?: string };
    return { ok: true, id: data.id, url: data.url, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'request failed' };
  }
}
