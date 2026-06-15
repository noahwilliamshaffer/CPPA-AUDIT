/**
 * POST /api/integrations/notion/publish
 *
 * Publishes the current assessment's audit summary as a Notion page under the
 * configured parent page. No-op-safe when Notion isn't configured.
 */

import { NextResponse } from 'next/server';
import { getNotionConfig } from '@/lib/integrations/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST() {
  const cfg = await getNotionConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: 'Notion is not configured. Set the integration token and a parent page ID in Credentials.' },
      { status: 400 }
    );
  }

  const { loadCurrentAudit } = await import('@/lib/integrations/current-audit');
  const audit = await loadCurrentAudit();
  if (!audit) return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });

  const { auditSummaryNotionBlocks } = await import('@/lib/integrations/audit-content');
  const { publishToNotion } = await import('@/lib/integrations/notion');

  const title = `ShieldAudit — Audit Summary — ${audit.orgName} (${new Date().toISOString().slice(0, 10)})`;
  const blocks = auditSummaryNotionBlocks(audit.orgName, audit.tickets);
  const result = await publishToNotion(cfg, title, blocks);

  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Publish failed' }, { status: 502 });
  return NextResponse.json({ ok: true, id: result.id, url: result.url, ticketCount: audit.tickets.length });
}
