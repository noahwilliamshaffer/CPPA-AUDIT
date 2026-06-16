/**
 * GET /api/audit-trail/export?format=csv|json
 *
 * Downloads the current assessment's immutable audit-trail entries. Read-only.
 */

import { NextResponse } from 'next/server';
import { loadAuditTrail, auditTrailToCsv, auditTrailToJson } from '@/lib/audit-trail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get('format') === 'json' ? 'json' : 'csv';
  const data = await loadAuditTrail();
  if (!data) return NextResponse.json({ error: 'No organization found.' }, { status: 404 });

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    return new NextResponse(auditTrailToJson(data), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="audit-trail-${stamp}.json"`,
      },
    });
  }
  return new NextResponse(auditTrailToCsv(data.rows), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-trail-${stamp}.csv"`,
    },
  });
}
