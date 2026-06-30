'use client';

/**
 * Sidebar — client component for the dashboard shell.
 *
 * Must be 'use client' because it uses:
 * - usePathname() to highlight the active route
 * - useClerk().signOut() for the sign-out button
 *
 * Unlock gates (mirrors layout.tsx logic):
 * - Module 2 (Assessment):  Always unlocked — eligibility pre-screened at provisioning.
 * - Module 3 (Scoring):     Requires assessment answers submitted.
 * - Module 4 (Reports):     Requires scoring data to exist.
 * - Settings:               Always unlocked.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  ClipboardList,
  BarChart3,
  FileText,
  Ticket,
  ClipboardCheck,
  Plug,
  History,
  Settings,
  Lock,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SidebarProps {
  orgName: string;
  userRole: 'admin' | 'auditor' | 'business_admin' | 'reseller';
  module2Unlocked: boolean; // Always true — eligibility pre-screened at provisioning
  module3Unlocked: boolean;
  module4Unlocked: boolean;
  userInitials: string;
  userEmail: string;
  // White-label branding (Phase 6) — empty values fall back to ShieldAudit defaults.
  brandName?: string;
  accentColor?: string;
  logoUrl?: string;
}

// ---------------------------------------------------------------------------
// Role display map — converts DB enum values to human-readable badge labels
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<SidebarProps['userRole'], string> = {
  admin: 'Admin',
  auditor: 'Auditor',
  business_admin: 'Business Admin',
  reseller: 'Reseller',
};

// Role badge color — auditors are teal (primary users), admins amber,
// resellers get a distinct purple-ish slate, business_admin gets navy.
const ROLE_BADGE_CLASSES: Record<SidebarProps['userRole'], string> = {
  admin: 'bg-amber-400/20 text-amber-400',
  auditor: 'bg-teal-400/20 text-teal-400',
  business_admin: 'bg-navy-600 text-slate-300',
  reseller: 'bg-slate-500/20 text-slate-300',
};

// ---------------------------------------------------------------------------
// Nav item definitions
// Each item declares which unlock prop gates it. Null = always unlocked.
// ---------------------------------------------------------------------------

interface NavItemDef {
  label: string;
  href: string;
  // The lucide-react icon component to render when unlocked
  Icon: LucideIcon;
  // Which prop key controls the lock state; null means always unlocked
  unlockedPropKey: keyof Pick<
    SidebarProps,
    | 'module2Unlocked'
    | 'module3Unlocked'
    | 'module4Unlocked'
  > | null;
  // Message shown on hover when the item is locked
  lockedTooltip: string | null;
}

const NAV_ITEMS: NavItemDef[] = [
  {
    label: 'Audit Assessment',
    href: '/dashboard/assessment',
    Icon: ClipboardList,
    unlockedPropKey: 'module2Unlocked',
    lockedTooltip: null,
  },
  {
    label: 'Scoring Dashboard',
    href: '/dashboard/scoring',
    Icon: BarChart3,
    unlockedPropKey: 'module3Unlocked',
    lockedTooltip: 'Complete the Audit Assessment first',
  },
  {
    label: 'Report Generator',
    href: '/dashboard/reports',
    Icon: FileText,
    unlockedPropKey: 'module4Unlocked',
    lockedTooltip: 'Complete the Scoring Dashboard first',
  },
  {
    label: 'Remediation Tickets',
    href: '/dashboard/tickets',
    Icon: Ticket,
    unlockedPropKey: 'module4Unlocked',
    lockedTooltip: 'Complete the Scoring Dashboard first',
  },
  {
    label: 'Gaps & Remediation',
    href: '/dashboard/gaps',
    Icon: ClipboardCheck,
    unlockedPropKey: null,
    lockedTooltip: null,
  },
  {
    label: 'Audit Trail',
    href: '/dashboard/audit-trail',
    Icon: History,
    unlockedPropKey: null,
    lockedTooltip: null,
  },
  {
    label: 'Integrations',
    href: '/dashboard/integrations',
    Icon: Plug,
    unlockedPropKey: null,
    lockedTooltip: null,
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    // Settings is always accessible — no audit gate on org configuration
    Icon: Settings,
    unlockedPropKey: null,
    lockedTooltip: null,
  },
];

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

export default function Sidebar({
  orgName,
  userRole,
  module2Unlocked,
  module3Unlocked,
  module4Unlocked,
  userInitials,
  userEmail,
  brandName,
  accentColor,
  logoUrl,
}: SidebarProps) {
  const pathname = usePathname();

  const wordmark = brandName?.trim() || 'ShieldAudit';
  const accentStyle = accentColor?.trim() ? { color: accentColor.trim() } : undefined;

  // Build a lookup so nav item rendering can check unlock state by prop key.
  const unlockMap: Record<string, boolean> = {
    module2Unlocked,
    module3Unlocked,
    module4Unlocked,
  };

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-navy-800 border-r border-navy-600"
      aria-label="Main navigation"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Logo + org identity                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3 px-5 py-6 border-b border-navy-600">
        {/* Wordmark — white-label logo + firm name override the defaults */}
        <div className="flex items-center gap-2">
          {logoUrl?.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary white-label URL; next/image needs static domains
            <img
              src={logoUrl.trim()}
              alt={wordmark}
              className="h-6 w-auto max-w-[150px] flex-shrink-0 object-contain"
            />
          ) : (
            <Shield
              size={22}
              className={`flex-shrink-0 ${accentStyle ? '' : 'text-teal-400'}`}
              style={accentStyle}
              aria-hidden="true"
            />
          )}
          <span
            className={`font-sora text-lg font-semibold tracking-tight ${accentStyle ? '' : 'text-teal-400'}`}
            style={accentStyle}
          >
            {wordmark}
          </span>
        </div>

        {/* Org name — truncated to one line with ellipsis on long names */}
        <p
          className="text-xs text-slate-400 truncate leading-tight"
          title={orgName}
        >
          {orgName}
        </p>

        {/* Role badge */}
        <span
          className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASSES[userRole]}`}
        >
          {ROLE_LABELS[userRole]}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Navigation items                                                     */}
      {/* ------------------------------------------------------------------ */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1" role="list">
          {NAV_ITEMS.map((item) => {
            // Determine if this item is unlocked.
            // null unlockedPropKey means "always unlocked" (Settings).
            const isUnlocked =
              item.unlockedPropKey === null
                ? true
                : (unlockMap[item.unlockedPropKey] ?? false);

            // Active if the current pathname starts with the item's href.
            // startsWith handles nested routes under each module.
            const isActive = pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <NavItem
                  item={item}
                  isUnlocked={isUnlocked}
                  isActive={isActive}
                />
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom section: user avatar + sign out                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-t border-navy-600 px-4 py-4">
        <div className="flex items-center gap-3">
          {/* User initials avatar */}
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-400/20 text-teal-400 font-sora text-xs font-semibold select-none"
            aria-hidden="true"
          >
            {userInitials}
          </div>

          {/* Email — truncated */}
          <p
            className="flex-1 truncate text-xs text-slate-400"
            title={userEmail}
          >
            {userEmail}
          </p>
        </div>

        {/* Sign out button */}
        <button
          onClick={() => window.location.href = '/'}
          className="mt-3 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-navy-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          aria-label="Return to home"
        >
          <LogOut size={15} aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// NavItem sub-component — handles locked vs. unlocked rendering
// ---------------------------------------------------------------------------

function NavItem({
  item,
  isUnlocked,
  isActive,
}: {
  item: NavItemDef;
  isUnlocked: boolean;
  isActive: boolean;
}) {
  const { Icon, label, href, lockedTooltip } = item;

  // Base classes shared between locked and unlocked states
  const baseClasses =
    'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors';

  if (!isUnlocked) {
    // Locked state: visually muted, completely non-interactive.
    // pointer-events-none prevents click and tab-focus bypasses.
    // aria-disabled communicates the state to screen readers.
    return (
      <div
        className={`${baseClasses} cursor-not-allowed text-slate-500 pointer-events-none select-none`}
        aria-disabled="true"
        role="menuitem"
        title={lockedTooltip ?? undefined}
      >
        {/* Lock icon replaces the module icon to signal unavailability */}
        <Lock size={16} className="flex-shrink-0 text-slate-600" aria-hidden="true" />
        <span className="flex-1">{label}</span>

        {/* Hover tooltip — visible via group-hover even though pointer-events
            are none on the container; we rely on the title attribute for this.
            The tooltip below is for visual-only users who might see it during
            a momentary hover before pointer-events-none takes full effect. */}
        {lockedTooltip && (
          <span
            className="
              absolute left-full ml-2 z-50 hidden whitespace-nowrap
              rounded bg-navy-900 px-2 py-1 text-xs text-slate-300
              shadow-lg group-hover:block
            "
            role="tooltip"
          >
            {lockedTooltip}
          </span>
        )}
      </div>
    );
  }

  // Unlocked state: fully interactive link
  return (
    <Link
      href={href}
      className={`
        ${baseClasses}
        ${
          isActive
            ? 'bg-navy-600 text-teal-400'
            : 'text-slate-300 hover:bg-navy-600 hover:text-slate-100'
        }
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon
        size={16}
        className={`flex-shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-slate-200'}`}
        aria-hidden="true"
      />
      <span className="flex-1">{label}</span>
    </Link>
  );
}
