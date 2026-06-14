/**
 * GET /api/integrations/status — which integrations are configured (from env).
 */

import { NextResponse } from 'next/server';
import { integrationStatus } from '@/lib/integrations/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await integrationStatus());
}
