/**
 * GET  /api/branding — current org brand config.
 * POST /api/branding — save brand config (company name, accent color, logo URL,
 *                      report footer). Offline: saved to organizations.brand_config.
 */

import { NextResponse } from 'next/server';
import { getBrandConfig, parseBrand } from '@/lib/branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(await getBrandConfig());
}

export async function POST(req: Request) {
  const userId = 'local-user';
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const brand = parseBrand(body);
  if (brand.accentColor && !/^#[0-9a-fA-F]{3,8}$/.test(brand.accentColor)) {
    return NextResponse.json({ error: 'accentColor must be a hex color like #2dd4bf.' }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { userRoles, organizations } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const roleRows = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.clerkUserId, userId)).limit(1);
  if (roleRows.length === 0) return NextResponse.json({ error: 'No organization found.' }, { status: 404 });

  await db.update(organizations).set({ brandConfig: brand }).where(eq(organizations.id, roleRows[0].orgId));
  return NextResponse.json({ ok: true });
}
