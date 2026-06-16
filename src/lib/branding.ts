/**
 * White-label branding (Phase 6). Per-org brand stored in
 * organizations.brand_config (JSON). Empty fields fall back to ShieldAudit
 * defaults, so an unbranded org looks exactly as before.
 */

import 'server-only';

export interface BrandConfig {
  companyName: string; // '' → "ShieldAudit"
  accentColor: string; // '' → built-in teal; else hex like #2dd4bf
  logoUrl: string; // '' → built-in shield icon
  reportFooter: string; // '' → no extra footer line on reports
}

const DEFAULTS: BrandConfig = { companyName: '', accentColor: '', logoUrl: '', reportFooter: '' };

export function parseBrand(raw: unknown): BrandConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const o = raw as Record<string, unknown>;
  const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  return {
    companyName: s(o.companyName, 80),
    accentColor: s(o.accentColor, 9),
    logoUrl: s(o.logoUrl, 500),
    reportFooter: s(o.reportFooter, 300),
  };
}

export async function getBrandConfig(userId = 'local-user'): Promise<BrandConfig> {
  try {
    const { db } = await import('@/db');
    const { userRoles, organizations } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db
      .select({ brand: organizations.brandConfig })
      .from(userRoles)
      .innerJoin(organizations, eq(userRoles.orgId, organizations.id))
      .where(eq(userRoles.clerkUserId, userId))
      .limit(1);
    return parseBrand(rows[0]?.brand);
  } catch {
    return { ...DEFAULTS };
  }
}
