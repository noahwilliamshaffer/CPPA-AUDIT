'use client';

/**
 * OnboardingWizard — simplified 2-step setup for offline mode.
 *
 * Step 1: Organization name + contact email
 * Step 2: Revenue tier (used for CPPA submission deadline calculation)
 *
 * No role selection — offline clients are always admins conducting their own audit.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Mail, ChevronRight, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const step1Schema = z.object({
  legalEntity: z.string().min(2, 'Organization name must be at least 2 characters'),
  contactEmail: z.string().email('Enter a valid email address'),
});

const step2Schema = z.object({
  revenueTier: z.enum(['under_50m', '50m_to_100m', 'over_100m'] as const).optional(),
});

type Step1Fields = z.infer<typeof step1Schema>;
type Step2Fields = z.infer<typeof step2Schema>;

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------

function Steps({ current }: { current: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {[1, 2].map((n) => (
        <div key={n} className="flex items-center gap-3">
          <div className={[
            'flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-semibold transition-all',
            n < current  ? 'bg-teal-400 text-navy-800' :
            n === current ? 'bg-teal-400 text-navy-800 ring-4 ring-teal-400/20' :
                            'bg-navy-600 text-slate-500',
          ].join(' ')}>
            {n < current ? '✓' : n}
          </div>
          {n < 2 && (
            <div className={['h-px w-12 transition-all', n < current ? 'bg-teal-400' : 'bg-navy-600'].join(' ')} />
          )}
        </div>
      ))}
      <span className="ml-1 font-mono text-xs text-slate-500">Step {current} of 2</span>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-red-400">{message}</p>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Fields | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form1 = useForm<Step1Fields>({
    resolver: zodResolver(step1Schema),
    defaultValues: { legalEntity: '', contactEmail: '' },
  });

  const form2 = useForm<Step2Fields>({
    resolver: zodResolver(step2Schema),
  });
  // useWatch (a proper hook) instead of form2.watch() — React Compiler-compatible
  // and evaluated once rather than per render of each option button.
  const revenueTier = useWatch({ control: form2.control, name: 'revenueTier' });

  // Step 1 → Step 2
  const handleStep1 = form1.handleSubmit((values) => {
    setStep1Data(values);
    setStep(2);
  });

  // Step 2 → Submit
  const handleStep2 = form2.handleSubmit(async (values) => {
    if (!step1Data) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'admin',
          legalEntity: step1Data.legalEntity,
          contactEmail: step1Data.contactEmail,
          revenueTier: values.revenueTier ?? undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setSubmitError(json.error ?? `Error (HTTP ${res.status}). Please try again.`);
        return;
      }

      router.push('/dashboard');
    } catch {
      setSubmitError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="rounded-2xl bg-navy-700 p-8 shadow-xl ring-1 ring-navy-600">
      <Steps current={step} />

      {/* ── Step 1: Organization ─────────────────────────────────────────── */}
      {step === 1 && (
        <section>
          <h1 className="font-sora text-2xl font-semibold text-slate-100">
            Set up your organization
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            This information appears on all generated audit documents.
          </p>

          <form onSubmit={handleStep1} className="mt-8 flex flex-col gap-5" noValidate>
            <div>
              <label htmlFor="legalEntity" className="block text-sm font-medium text-slate-300 mb-1.5">
                Legal entity name
              </label>
              <div className="relative">
                <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="legalEntity"
                  type="text"
                  autoFocus
                  autoComplete="organization"
                  placeholder="Acme Corporation, LLC"
                  {...form1.register('legalEntity')}
                  className="w-full rounded-lg border border-navy-600 bg-navy-600 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <FieldError message={form1.formState.errors.legalEntity?.message} />
            </div>

            <div>
              <label htmlFor="contactEmail" className="block text-sm font-medium text-slate-300 mb-1.5">
                Contact email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="contactEmail"
                  type="email"
                  autoComplete="email"
                  placeholder="compliance@yourcompany.com"
                  {...form1.register('contactEmail')}
                  className="w-full rounded-lg border border-navy-600 bg-navy-600 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <FieldError message={form1.formState.errors.contactEmail?.message} />
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-6 py-2.5 font-sora text-sm font-semibold text-navy-800 transition-opacity hover:opacity-90"
              >
                Continue <ChevronRight size={15} />
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Step 2: Revenue tier ──────────────────────────────────────────── */}
      {step === 2 && (
        <section>
          <h1 className="font-sora text-2xl font-semibold text-slate-100">
            Annual Revenue
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Used to calculate your CPPA submission deadline. You can skip this and set it later in Settings.
          </p>

          <form onSubmit={handleStep2} className="mt-8 flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-3">
              {[
                { value: 'under_50m',    label: 'Under $50M annually' },
                { value: '50m_to_100m',  label: '$50M – $100M annually' },
                { value: 'over_100m',    label: 'Over $100M annually' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => form2.setValue('revenueTier', value as Step2Fields['revenueTier'])}
                  className={[
                    'w-full rounded-xl border-2 px-5 py-4 text-left text-sm font-medium transition-all',
                    revenueTier === value
                      ? 'border-teal-500 bg-teal-500/10 text-slate-100'
                      : 'border-navy-600 bg-navy-600 text-slate-400 hover:border-navy-400 hover:text-slate-200',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>

            {submitError && (
              <p className="text-sm text-red-400">{submitError}</p>
            )}

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Back
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    form2.setValue('revenueTier', undefined);
                    handleStep2();
                  }}
                  disabled={isSubmitting}
                  className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Skip for now
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-6 py-2.5 font-sora text-sm font-semibold text-navy-800 transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {isSubmitting ? (
                    <><Loader2 size={14} className="animate-spin" /> Setting up…</>
                  ) : (
                    'Start Assessment'
                  )}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
