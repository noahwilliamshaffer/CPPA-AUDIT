'use client';

/**
 * OnboardingWizard — multi-step form that collects the minimum information
 * required to create an org and assign the authenticated user's role.
 *
 * Step structure:
 *   Step 1 — Role selection (admin vs. reseller)
 *   Step 2 — Organization details (legal name + contact email)
 *   Step 3 — Assessment details (admin only; resellers skip directly to submit)
 *
 * Resellers have a 2-step flow (steps 1→2→submit), admins have 3 steps.
 * The progress indicator adapts to the effective step count.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schemas — one per step so validation is scoped to visible fields only
// ---------------------------------------------------------------------------

/** Step 2: organization identity fields */
const orgSchema = z.object({
  legalEntity: z
    .string()
    .min(2, 'Legal entity name must be at least 2 characters'),
  contactEmail: z.string().email('Enter a valid email address'),
});

/** Step 3: assessment-specific fields (admin only) */
const assessmentSchema = z.object({
  revenueTier: z.enum(['under_50m', '50m_to_100m', 'over_100m'] as const, {
    error: 'Select a revenue tier',
  }),
  consumerRecordCount: z
    .number({ error: 'Enter a number' })
    .int()
    .positive()
    .optional(),
});

type OrgFields = z.infer<typeof orgSchema>;
type AssessmentFields = z.infer<typeof assessmentSchema>;

type RoleValue = 'admin' | 'reseller';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RoleCardProps {
  title: string;
  subtitle: string;
  value: RoleValue;
  selected: boolean;
  onSelect: (value: RoleValue) => void;
}

/**
 * RoleCard — large clickable tile for role selection.
 * Uses a card pattern instead of a radio button so the entire surface area
 * is the hit target, making the choice feel intentional and clear.
 */
function RoleCard({ title, subtitle, value, selected, onSelect }: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={[
        'w-full rounded-xl border-2 p-6 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
        selected
          ? 'border-teal-500 bg-navy-600 shadow-lg shadow-teal-500/10'
          : 'border-navy-600 bg-navy-600 hover:border-navy-400',
      ].join(' ')}
      aria-pressed={selected}
    >
      <p className="font-sora text-base font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
    </button>
  );
}

interface ProgressBarProps {
  current: number;
  total: number;
}

/**
 * ProgressBar — communicates position in the wizard clearly.
 * Uses step dots rather than a filled bar so the step count reads at a glance.
 */
function ProgressBar({ current, total }: ProgressBarProps) {
  return (
    <div className="mb-8 flex items-center gap-3">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div
            className={[
              'h-2 w-2 rounded-full transition-all duration-200',
              i + 1 < current
                ? 'bg-teal-400'
                : i + 1 === current
                  ? 'h-2.5 w-2.5 bg-teal-400'
                  : 'bg-navy-600',
            ].join(' ')}
          />
          {i < total - 1 && (
            <div
              className={[
                'h-px w-8 transition-all duration-200',
                i + 1 < current ? 'bg-teal-400' : 'bg-navy-600',
              ].join(' ')}
            />
          )}
        </div>
      ))}
      <span className="ml-2 font-mono text-xs text-slate-500">
        Step {current} of {total}
      </span>
    </div>
  );
}

interface FieldErrorProps {
  message?: string;
}

/**
 * FieldError — consistent error display beneath form inputs.
 */
function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-crimson-400">{message}</p>;
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export default function OnboardingWizard() {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<RoleValue | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Collected values across steps — assembled at submission time
  const [orgData, setOrgData] = useState<OrgFields | null>(null);

  // Step 2 form
  const orgForm = useForm<OrgFields>({
    resolver: zodResolver(orgSchema),
    defaultValues: { legalEntity: '', contactEmail: '' },
  });

  // Step 3 form (admin only)
  const assessmentForm = useForm<AssessmentFields>({
    resolver: zodResolver(assessmentSchema),
  });

  /**
   * totalSteps — resellers have no step 3 (no revenue tier required because
   * they bill clients separately and aren't the covered business themselves).
   */
  const totalSteps = selectedRole === 'reseller' ? 2 : 3;

  // ---------------------------------------------------------------------------
  // Step handlers
  // ---------------------------------------------------------------------------

  /** Advance from step 1 → 2 after a role is chosen */
  function handleStep1Next() {
    if (!selectedRole) return;
    setStep(2);
  }

  /**
   * Validate step 2 fields, persist the values, then either:
   * - Submit immediately (reseller — no step 3 needed)
   * - Advance to step 3 (admin)
   */
  const handleStep2Next = orgForm.handleSubmit((values) => {
    setOrgData(values);
    if (selectedRole === 'reseller') {
      void submitOnboarding({ ...values, assessmentData: undefined });
    } else {
      setStep(3);
    }
  });

  /**
   * Validate step 3 fields and submit the full payload.
   */
  const handleStep3Submit = assessmentForm.handleSubmit(async (values) => {
    if (!orgData) return; // should never happen — orgData set in step 2
    await submitOnboarding({ ...orgData, assessmentData: values });
  });

  /**
   * submitOnboarding — sends the collected wizard data to the API route,
   * then redirects to /dashboard on success or surfaces an error message.
   *
   * Extracted as a shared function so both the reseller (2-step) and admin
   * (3-step) paths can call through the same submission logic.
   */
  async function submitOnboarding({
    legalEntity,
    contactEmail,
    assessmentData,
  }: OrgFields & { assessmentData?: AssessmentFields }) {
    if (!selectedRole) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const body = {
        role: selectedRole,
        legalEntity,
        contactEmail,
        revenueTier: assessmentData?.revenueTier,
        consumerRecordCount: assessmentData?.consumerRecordCount,
      };

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(
          json.error ?? `Submission failed (HTTP ${res.status}). Please try again.`
        );
        return;
      }

      // Success — redirect to the main app
      router.push('/dashboard');
    } catch {
      setSubmitError(
        'Unable to reach the server. Check your connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="rounded-2xl bg-navy-700 p-8 shadow-xl ring-1 ring-navy-600">
      <ProgressBar current={step} total={totalSteps} />

      {/* ------------------------------------------------------------------ */}
      {/* STEP 1 — Role selection                                             */}
      {/* ------------------------------------------------------------------ */}
      {step === 1 && (
        <section>
          <h1 className="font-sora text-2xl font-semibold text-slate-100">
            How will you use ShieldAudit?
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Choose the option that best describes your use case.
          </p>

          <div className="mt-8 flex flex-col gap-4">
            <RoleCard
              title="Conducting an audit"
              subtitle="For your own organization or as an internal auditor"
              value="admin"
              selected={selectedRole === 'admin'}
              onSelect={setSelectedRole}
            />
            <RoleCard
              title="MSP / Reseller"
              subtitle="Delivering CCPA audit services to clients under your firm's brand"
              value="reseller"
              selected={selectedRole === 'reseller'}
              onSelect={setSelectedRole}
            />
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={handleStep1Next}
              disabled={!selectedRole}
              className="rounded-lg bg-teal-500 px-6 py-2.5 font-sora text-sm font-semibold text-navy-800 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 2 — Organization details                                        */}
      {/* ------------------------------------------------------------------ */}
      {step === 2 && (
        <section>
          <h1 className="font-sora text-2xl font-semibold text-slate-100">
            Your Organization
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            This information will appear on generated audit documents.
          </p>

          <form onSubmit={handleStep2Next} className="mt-8 flex flex-col gap-5" noValidate>
            {/* Legal entity name */}
            <div>
              <label
                htmlFor="legalEntity"
                className="block text-sm font-medium text-slate-300"
              >
                Legal entity name
              </label>
              <input
                id="legalEntity"
                type="text"
                autoComplete="organization"
                placeholder="Acme Corp, LLC"
                {...orgForm.register('legalEntity')}
                className="mt-1.5 w-full rounded-lg border border-navy-600 bg-navy-600 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none ring-0 transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
              <FieldError message={orgForm.formState.errors.legalEntity?.message} />
            </div>

            {/* Contact email */}
            <div>
              <label
                htmlFor="contactEmail"
                className="block text-sm font-medium text-slate-300"
              >
                Contact email
              </label>
              <input
                id="contactEmail"
                type="email"
                autoComplete="email"
                placeholder="compliance@example.com"
                {...orgForm.register('contactEmail')}
                className="mt-1.5 w-full rounded-lg border border-navy-600 bg-navy-600 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none ring-0 transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
              <FieldError message={orgForm.formState.errors.contactEmail?.message} />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Back
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-teal-500 px-6 py-2.5 font-sora text-sm font-semibold text-navy-800 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting && selectedRole === 'reseller'
                  ? 'Creating…'
                  : selectedRole === 'reseller'
                    ? 'Create Organization'
                    : 'Next'}
              </button>
            </div>

            {/* Submission error shown here for resellers (who submit at step 2) */}
            {submitError && selectedRole === 'reseller' && (
              <p className="mt-2 text-sm text-crimson-400">{submitError}</p>
            )}
          </form>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 3 — Assessment details (admin only)                            */}
      {/* ------------------------------------------------------------------ */}
      {step === 3 && (
        <section>
          <h1 className="font-sora text-2xl font-semibold text-slate-100">
            Assessment Details
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Used to determine CPPA coverage thresholds and submission deadlines.
          </p>

          <form
            onSubmit={handleStep3Submit}
            className="mt-8 flex flex-col gap-5"
            noValidate
          >
            {/* Revenue tier */}
            <div>
              <label
                htmlFor="revenueTier"
                className="block text-sm font-medium text-slate-300"
              >
                Annual gross revenue
              </label>
              <select
                id="revenueTier"
                {...assessmentForm.register('revenueTier')}
                defaultValue=""
                className="mt-1.5 w-full rounded-lg border border-navy-600 bg-navy-600 px-4 py-2.5 text-sm text-slate-100 outline-none ring-0 transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              >
                <option value="" disabled>
                  Select revenue tier…
                </option>
                <option value="under_50m">Under $50M annually</option>
                <option value="50m_to_100m">$50M – $100M annually</option>
                <option value="over_100m">Over $100M annually</option>
              </select>
              <FieldError message={assessmentForm.formState.errors.revenueTier?.message} />
            </div>

            {/* Consumer record count */}
            <div>
              <label
                htmlFor="consumerRecordCount"
                className="block text-sm font-medium text-slate-300"
              >
                California consumer record estimate{' '}
                <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="consumerRecordCount"
                type="number"
                min={0}
                step={1}
                placeholder="Estimated number of California consumer records"
                {...assessmentForm.register('consumerRecordCount', {
                  setValueAs: (v: string) =>
                    v === '' ? undefined : parseInt(v, 10),
                })}
                className="mt-1.5 w-full rounded-lg border border-navy-600 bg-navy-600 px-4 py-2.5 font-mono text-sm text-slate-100 placeholder-slate-500 outline-none ring-0 transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
              <FieldError
                message={assessmentForm.formState.errors.consumerRecordCount?.message}
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Back
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-teal-500 px-6 py-2.5 font-sora text-sm font-semibold text-navy-800 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? 'Creating…' : 'Create Organization'}
              </button>
            </div>

            {submitError && (
              <p className="mt-2 text-sm text-crimson-400">{submitError}</p>
            )}
          </form>
        </section>
      )}
    </div>
  );
}
