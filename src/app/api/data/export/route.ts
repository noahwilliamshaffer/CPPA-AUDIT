/**
 * GET /api/data/export
 *
 * Downloads the entire audit dataset (org, assessments, answers, evidence
 * files, test/interview logs, scores, gaps, reports, and audit trail) as a
 * single portable JSON file. See src/lib/backup.ts for what's excluded and why.
 */

import { NextResponse } from 'next/server';
import { orgExistsForUser, buildBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const userId = 'local-user';

  const existing = await orgExistsForUser(userId);
  if (!existing) {
    return NextResponse.json({ error: 'No organization found to export.' }, { status: 404 });
  }

  const payload = await buildBackup(existing.orgId);

  const { db } = await import('@/db');
  const { auditTrailEntries } = await import('@/db/schema');
  await db.insert(auditTrailEntries).values({
    orgId: existing.orgId,
    auditorId: userId,
    action: 'data_exported',
    newValue: {
      assessmentCount: payload.assessments.length,
      answerCount: payload.answers.length,
      evidenceItemCount: payload.evidenceItems.length,
    },
  });

  const json = JSON.stringify(payload, null, 2);
  const slug = (existing.orgName || 'organization').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="shieldaudit-backup-${slug}-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
