export const dynamic = 'force-dynamic';

/**
 * Settings — /dashboard/settings
 *
 * Server component. Organization-level settings page accessible to all roles.
 * Role-based editing restrictions are enforced per field (admin-only edits
 * ship in Phase 6 along with the full settings API routes).
 *
 * Sections:
 * 1. Organization Settings — name, legal entity, contact email (read-only in Phase 1)
 * 2. White-Label Branding   — logo, firm name, firm color, subdomain (Phase 6)
 * 3. Billing                — plan type, Stripe portal link (Phase 6)
 *
 * Always accessible regardless of module unlock state — org configuration
 * should never be gated behind audit progress.
 */

import {
  Settings,
  Building2,
  Palette,
  CreditCard,
  ChevronRight,
  Info,
  Mail,
  BadgeCheck,
} from 'lucide-react';
import BrandingForm from './BrandingForm';

// ---------------------------------------------------------------------------
// Fetch org details for the current user
// ---------------------------------------------------------------------------

interface OrgDetails {
  name: string;
  legalEntity: string;
  contactEmail: string;
  plan: 'direct' | 'reseller';
  revenueTier: 'under_50m' | '50m_to_100m' | 'over_100m' | null;
  userRole: 'admin' | 'auditor' | 'business_admin' | 'reseller';
}

async function fetchOrgDetails(clerkUserId: string): Promise<OrgDetails | null> {
  const { db } = await import('@/db');
  const { userRoles, organizations } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const rows = await db
    .select({
      orgName: organizations.name,
      legalEntity: organizations.legalEntity,
      contactEmail: organizations.contactEmail,
      plan: organizations.plan,
      revenueTier: organizations.revenueTier,
      role: userRoles.role,
    })
    .from(userRoles)
    .innerJoin(organizations, eq(userRoles.orgId, organizations.id))
    .where(eq(userRoles.clerkUserId, clerkUserId))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    name: row.orgName,
    legalEntity: row.legalEntity,
    contactEmail: row.contactEmail,
    plan: row.plan as 'direct' | 'reseller',
    revenueTier: (row.revenueTier as OrgDetails['revenueTier']) ?? null,
    userRole: row.role as OrgDetails['userRole'],
  };
}

// ---------------------------------------------------------------------------
// Revenue tier display labels
// ---------------------------------------------------------------------------

const REVENUE_TIER_LABELS: Record<string, string> = {
  under_50m: 'Under $50M annually',
  '50m_to_100m': '$50M – $100M annually',
  over_100m: 'Over $100M annually',
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function SettingsPage() {
  const userId = 'local-user';

  let orgDetails: OrgDetails | null = null;

  try {
    orgDetails = await fetchOrgDetails(userId);
  } catch {
    // DB unavailable — show empty state with placeholder values
  }

  // If no org found (shouldn't happen if layout redirect logic is working,
  // but guard defensively)
  const org = orgDetails ?? {
    name: 'Your Organization',
    legalEntity: '—',
    contactEmail: '—',
    plan: 'direct' as const,
    revenueTier: null,
    userRole: 'auditor' as const,
  };

  const isAdmin = org.userRole === 'admin';

  return (
    <div className="min-h-full px-8 py-8">
      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <Settings size={20} className="text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">
              Settings
            </h1>
            <p className="text-xs text-slate-500">
              Organization configuration and account preferences
            </p>
          </div>
        </div>

        {/* Admin-only note */}
        {!isAdmin && (
          <p className="mt-3 text-xs text-slate-500">
            Settings edits are restricted to org admins. Contact your admin to
            make changes.
          </p>
        )}
      </div>

      <div className="max-w-2xl space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* Section 1: Organization Settings                                 */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="org-settings-heading">
          <div className="mb-3 flex items-center gap-2">
            <Building2 size={15} className="text-teal-400" aria-hidden="true" />
            <h2
              id="org-settings-heading"
              className="font-sora text-sm font-semibold text-slate-300 uppercase tracking-wider"
            >
              Organization Settings
            </h2>
          </div>

          <div className="rounded-xl border border-navy-600 bg-navy-600/50 divide-y divide-navy-600">
            {/* Org name */}
            <SettingsRow
              label="Organization Name"
              value={org.name}
              icon={<Building2 size={14} className="text-slate-500" aria-hidden="true" />}
              editHint={isAdmin ? 'Editing available in Phase 6' : undefined}
            />

            {/* Legal entity */}
            <SettingsRow
              label="Legal Entity"
              value={org.legalEntity}
              icon={<BadgeCheck size={14} className="text-slate-500" aria-hidden="true" />}
              editHint={isAdmin ? 'Editing available in Phase 6' : undefined}
            />

            {/* Contact email */}
            <SettingsRow
              label="Contact Email"
              value={org.contactEmail}
              icon={<Mail size={14} className="text-slate-500" aria-hidden="true" />}
              editHint={isAdmin ? 'Editing available in Phase 6' : undefined}
            />

            {/* Revenue tier */}
            <SettingsRow
              label="Revenue Tier"
              value={
                org.revenueTier
                  ? REVENUE_TIER_LABELS[org.revenueTier] ?? org.revenueTier
                  : 'Not set'
              }
              icon={<ChevronRight size={14} className="text-slate-500" aria-hidden="true" />}
              note="Used to determine CPPA submission deadline (§7120)"
              editHint={isAdmin ? 'Editing available in Phase 6' : undefined}
            />

            {/* Plan */}
            <SettingsRow
              label="Plan"
              value={org.plan === 'reseller' ? 'Reseller' : 'Direct'}
              icon={<ChevronRight size={14} className="text-slate-500" aria-hidden="true" />}
              badge={org.plan === 'reseller' ? 'Reseller' : 'Direct'}
            />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Section 2: White-Label Branding                                  */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="branding-heading">
          <div className="mb-3 flex items-center gap-2">
            <Palette size={15} className="text-teal-400" aria-hidden="true" />
            <h2
              id="branding-heading"
              className="font-sora text-sm font-semibold text-slate-300 uppercase tracking-wider"
            >
              White-Label Branding
            </h2>
          </div>

          <BrandingForm />
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Section 3: Billing                                               */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="billing-heading">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard size={15} className="text-teal-400" aria-hidden="true" />
            <h2
              id="billing-heading"
              className="font-sora text-sm font-semibold text-slate-300 uppercase tracking-wider"
            >
              Billing
            </h2>
          </div>

          <div className="rounded-xl border border-navy-600 bg-navy-600/30 p-5">
            <div className="flex items-start gap-3">
              <Info size={15} className="mt-0.5 flex-shrink-0 text-slate-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-400">
                  Billing management available in Phase 6
                </p>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Per-assessment payments are handled via Stripe at the end of
                  Module 2. A full Stripe Customer Portal integration for
                  managing subscriptions, payment methods, and invoice history
                  ships in Phase 6.
                </p>
                <div className="mt-3 space-y-1">
                  {BILLING_FEATURES.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                      <ChevronRight size={12} className="mt-0.5 flex-shrink-0 text-slate-700" aria-hidden="true" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-navy-700">
              <button
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-500/20 px-4 py-2 text-xs font-semibold text-slate-500"
                aria-disabled="true"
              >
                <CreditCard size={13} aria-hidden="true" />
                Manage Billing
                <span className="ml-0.5 rounded bg-navy-800/60 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                  Phase 6
                </span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsRow — individual setting display row
// ---------------------------------------------------------------------------

function SettingsRow({
  label,
  value,
  icon,
  note,
  editHint,
  badge,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  note?: string;
  editHint?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-slate-200 font-medium truncate">{value}</p>
            {badge && (
              <span className="rounded-full bg-teal-400/15 px-2 py-0.5 text-xs font-semibold text-teal-400">
                {badge}
              </span>
            )}
          </div>
          {note && (
            <p className="mt-0.5 text-xs text-slate-600">{note}</p>
          )}
        </div>
      </div>

      {editHint && (
        <span className="flex-shrink-0 text-xs text-slate-600 italic">
          {editHint}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const BILLING_FEATURES: string[] = [
  'View invoice history for all completed assessment payments',
  'Update payment method on file',
  'Download receipts for accounting purposes',
  'Reseller dashboard: manage per-client billing and commission tracking',
];
