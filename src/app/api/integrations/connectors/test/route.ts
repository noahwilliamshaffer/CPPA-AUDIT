/**
 * POST /api/integrations/connectors/test  { id }
 *
 * Runs a connector's live connectivity/credential check using the stored
 * (encrypted) config. Returns {ok, configured, detail}. These connectors are
 * scaffolds: the test is real, but they are not yet wired into autofill.
 */

import { NextResponse } from 'next/server';
import { getConnectorById, getConnectorConfig } from '@/lib/integrations/connectors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const def = body.id ? getConnectorById(body.id) : undefined;
  if (!def) return NextResponse.json({ error: 'Unknown connector.' }, { status: 404 });

  const cfg = await getConnectorConfig(def);
  if (!cfg) {
    return NextResponse.json(
      { ok: false, configured: false, detail: `${def.name} is not configured — enter all required fields in Credentials.` },
      { status: 400 }
    );
  }

  const result = await def.test(cfg);
  return NextResponse.json({ ok: result.ok, configured: true, detail: result.detail, status: result.status });
}
