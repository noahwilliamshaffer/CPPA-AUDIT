/**
 * POST /api/integrations/s3/upload
 *
 * Uploads the current assessment's remediation tickets (JSON + CSV) to the
 * configured S3 / S3-compatible bucket — the evidence-locker + retention target.
 * No-op-safe when S3 isn't configured.
 */

import { NextResponse } from 'next/server';
import { getS3Config } from '@/lib/integrations/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST() {
  const cfg = await getS3Config();
  if (!cfg) {
    return NextResponse.json(
      { error: 'S3 is not configured. Set bucket, region, and access keys in Credentials.' },
      { status: 400 }
    );
  }

  const { loadCurrentAudit } = await import('@/lib/integrations/current-audit');
  const audit = await loadCurrentAudit();
  if (!audit) return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });

  const { ticketsToJson, ticketsToCsv } = await import('@/lib/tickets');
  const { uploadToS3 } = await import('@/lib/integrations/s3');

  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${audit.assessmentId}/remediation-tickets-${stamp}`;
  const results = await Promise.all([
    uploadToS3(cfg, `${base}.json`, ticketsToJson(audit.tickets), 'application/json'),
    uploadToS3(cfg, `${base}.csv`, ticketsToCsv(audit.tickets), 'text/csv'),
  ]);

  const uploaded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  if (uploaded.length === 0) {
    return NextResponse.json({ error: failed[0]?.error ?? 'Upload failed' }, { status: 502 });
  }
  return NextResponse.json({
    ok: failed.length === 0,
    uploaded: uploaded.map((r) => ({ key: r.key, url: r.url })),
    failed: failed.map((r) => ({ key: r.key, error: r.error })),
    count: uploaded.length,
  });
}
