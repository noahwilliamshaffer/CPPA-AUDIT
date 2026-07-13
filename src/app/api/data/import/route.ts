/**
 * POST /api/data/import
 *
 * Restores a previously exported ShieldAudit backup JSON (see
 * /api/data/export). If an organization already exists on this install, the
 * request must include { confirmReplace: true } to acknowledge that its
 * data will be permanently replaced by the imported backup.
 *
 * Body: { backup: <BackupPayload>, confirmReplace?: boolean }
 */

import { NextResponse } from 'next/server';
import { restoreBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const userId = 'local-user';

  let body: { backup?: unknown; confirmReplace?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.backup) {
    return NextResponse.json({ error: 'Missing "backup" payload.' }, { status: 400 });
  }

  try {
    const result = await restoreBackup(body.backup, { userId, replaceExisting: !!body.confirmReplace });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'CONFIRM_REQUIRED') {
      return NextResponse.json({ error: e.message, code: 'CONFIRM_REQUIRED' }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || 'Import failed.' }, { status: 400 });
  }
}
