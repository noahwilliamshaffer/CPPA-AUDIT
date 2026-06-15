/**
 * POST /api/integrations/confluence/publish
 *
 * Publishes the current assessment's audit summary as a Confluence page.
 * No-op-safe: returns a clear error when Confluence isn't configured.
 */

import { NextResponse } from 'next/server';
import { getConfluenceConfig } from '@/lib/integrations/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST() {
  const cfg = await getConfluenceConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: 'Confluence is not configured. Set base URL, email, API token, and space key in Credentials.' },
      { status: 400 }
    );
  }

  const { loadCurrentAudit } = await import('@/lib/integrations/current-audit');
  const audit = await loadCurrentAudit();
  if (!audit) return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });

  const { auditSummaryHtml } = await import('@/lib/integrations/audit-content');
  const { publishToConfluence } = await import('@/lib/integrations/confluence');

  const title = `ShieldAudit — Audit Summary — ${audit.orgName} (${new Date().toISOString().slice(0, 10)})`;
  const html = auditSummaryHtml(audit.orgName, audit.tickets);
  const result = await publishToConfluence(cfg, title, html);

  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Publish failed' }, { status: 502 });
  return NextResponse.json({ ok: true, id: result.id, url: result.url, ticketCount: audit.tickets.length });
}
