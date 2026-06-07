'use client';

/**
 * Public pre-onboarding funnel — no auth required.
 *
 * Flow:
 *   Step 1  →  Know you need the audit?
 *              Yes → Step 3 (skip screener)
 *              No  → Step 2 (eligibility screener)
 *   Step 2  →  5-question §7120 screener
 *              Not covered → exit
 *              Covered     → Step 3
 *   Step 3  →  Have a qualified auditor?
 *              Have one  → platform acquisition CTA
 *              Need one  → full-service engagement CTA
 *
 * Update CALENDAR_URL and CONTACT_EMAIL before launch.
 */

import { useState } from 'react';
import {
  Shield,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Mail,
  AlertCircle,
  Laptop,
} from 'lucide-react';

const CALENDAR_URL = 'https://calendly.com/apexshield';
const CONTACT_EMAIL = 'contact@apexshield.com';

type Step =
  | 'know_status'
  | 'screener'
  | 'auditor_status'
  | 'not_covered'
  | 'have_auditor'
  | 'need_auditor';

const QUESTIONS = [
  { id: 'revenue',    text: 'My business has annual gross revenues exceeding $50 million' },
  { id: 'volume',     text: 'My business buys, sells, receives, or shares the personal information of 100,000 or more consumers or households per year' },
  { id: 'sales_pct',  text: 'My business derives 50% or more of its annual revenues from selling or sharing consumers’ personal information' },
  { id: 'pi_control', text: 'My business owns, controls, or licenses the personal information of 100,000 or more consumers' },
  { id: 'sensitive',  text: 'My business processes sensitive personal information of 10,000 or more consumers per year' },
];

type Answers = Record<string, boolean | null>;

export default function QualifyWizard() {
  const [step, setStep] = useState<Step>('know_status');
  const [usedScreener, setUsedScreener] = useState(false);
  const [answers, setAnswers] = useState<Answers>(
    Object.fromEntries(QUESTIONS.map(q => [q.id, null]))
  );

  const allAnswered = QUESTIONS.every(q => answers[q.id] !== null);
  const anyCovered  = QUESTIONS.some(q => answers[q.id] === true);

  function toggleAnswer(id: string, val: boolean) {
    setAnswers(prev => ({ ...prev, [id]: val }));
  }

  function submitScreener() {
    setStep(anyCovered ? 'auditor_status' : 'not_covered');
  }

  function restart() {
    setStep('know_status');
    setUsedScreener(false);
    setAnswers(Object.fromEntries(QUESTIONS.map(q => [q.id, null])));
  }

  const isTerminal = ['not_covered', 'have_auditor', 'need_auditor'].includes(step);

  return (
    <div className="min-h-screen bg-navy-800 flex flex-col items-center px-4 py-12">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-10">
        <Shield size={22} className="text-teal-400" strokeWidth={1.5} />
        <span className="font-sora text-base font-semibold text-white">ShieldAudit</span>
        <span className="text-slate-600 text-xs">by ApexShield</span>
      </div>

      {/* Step progress (not shown on terminal states) */}
      {!isTerminal && (
        <div className="flex items-center gap-3 mb-8">
          {buildSteps(step, usedScreener).map(({ label, active, done }, i, arr) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                active ? 'bg-teal-400 text-navy-800' :
                done   ? 'bg-teal-600/40 text-teal-400 border border-teal-600/60' :
                         'bg-navy-600 text-slate-600 border border-navy-500'
              }`}>
                {done ? '✓' : label}
              </div>
              {i < arr.length - 1 && <div className="h-px w-10 bg-navy-600" />}
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-lg">

        {/* ── Step 1: Know your status ─────────────────────────────────── */}
        {step === 'know_status' && (
          <Card>
            <Eyebrow>Step 1 · Eligibility</Eyebrow>
            <CardTitle>CPPA Cybersecurity Audit Readiness</CardTitle>
            <CardBody>
              Cal. Code Regs. tit. 11, §7120 requires certain California businesses
              to complete an annual cybersecurity audit. Let&apos;s determine where you stand.
            </CardBody>

            <Question>
              Do you know for certain your business is required to complete a CPPA cybersecurity audit this year?
            </Question>

            <div className="space-y-3">
              <ChoiceButton
                title="Yes — we're required"
                subtitle="Skip the screener and go straight to auditor matching"
                onClick={() => { setUsedScreener(false); setStep('auditor_status'); }}
              />
              <ChoiceButton
                title="Not sure — check my eligibility"
                subtitle="Answer 5 questions to determine coverage under §7120"
                onClick={() => { setUsedScreener(true); setStep('screener'); }}
              />
            </div>
          </Card>
        )}

        {/* ── Step 2: Eligibility screener ─────────────────────────────── */}
        {step === 'screener' && (
          <Card>
            <BackButton onClick={() => setStep('know_status')} />
            <Eyebrow>Step 2 · §7120 Screener</Eyebrow>
            <CardTitle>Does the audit requirement apply?</CardTitle>
            <CardBody>
              If <em>any</em> of the following applies to your business, you meet the CPPA
              audit threshold. Answer all five honestly.
            </CardBody>

            {anyCovered && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-teal-400/20 bg-teal-400/5 px-4 py-2.5">
                <CheckCircle2 size={13} className="text-teal-400 flex-shrink-0" />
                <p className="text-xs text-teal-400">Coverage threshold met — you may proceed</p>
              </div>
            )}

            <div className="space-y-3 mb-6">
              {QUESTIONS.map(q => (
                <div key={q.id} className="rounded-xl border border-navy-600 bg-navy-600/30 p-4">
                  <p className="text-sm text-slate-300 mb-3">{q.text}</p>
                  <div className="flex gap-2">
                    {([true, false] as const).map(val => (
                      <button
                        key={String(val)}
                        onClick={() => toggleAnswer(q.id, val)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all border ${
                          answers[q.id] === val
                            ? val
                              ? 'border-emerald-400 bg-emerald-400/15 text-emerald-400'
                              : 'border-slate-500 bg-slate-500/15 text-slate-400'
                            : 'border-navy-500 bg-navy-600/30 text-slate-500 hover:border-slate-500/40'
                        }`}
                      >
                        {val ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={submitScreener}
              disabled={!allAnswered && !anyCovered}
              className="w-full rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-navy-800 font-semibold py-3 text-sm transition-colors"
            >
              {allAnswered || anyCovered ? 'See My Result' : 'Answer all questions to continue'}
            </button>
          </Card>
        )}

        {/* ── Step 3: Auditor status ────────────────────────────────────── */}
        {step === 'auditor_status' && (
          <Card>
            <BackButton onClick={() => setStep(usedScreener ? 'screener' : 'know_status')} />
            <Eyebrow>{usedScreener ? 'Step 3 · Auditor Match' : 'Step 2 · Auditor Match'}</Eyebrow>

            {usedScreener && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-teal-400/20 bg-teal-400/5 px-4 py-2">
                <CheckCircle2 size={13} className="text-teal-400 flex-shrink-0" />
                <p className="text-xs text-teal-400">
                  Screener result: <strong>Covered</strong> under §7120
                </p>
              </div>
            )}

            <CardTitle>Do you already have a qualified third-party auditor?</CardTitle>
            <CardBody>
              §7122(a)(3) requires the audit to be conducted by an independent auditor
              who reports to executive management not responsible for cybersecurity.
            </CardBody>

            <div className="space-y-3">
              <ChoiceButton
                title="I have a qualified auditor"
                subtitle="I need the ShieldAudit platform to conduct the assessment"
                onClick={() => setStep('have_auditor')}
              />
              <ChoiceButton
                title="I need an auditor provided"
                subtitle="ApexShield can assign a qualified, independent auditor"
                onClick={() => setStep('need_auditor')}
              />
            </div>
          </Card>
        )}

        {/* ── Terminal: Not Covered ─────────────────────────────────────── */}
        {step === 'not_covered' && (
          <Card className="border-amber-400/20">
            <div className="flex justify-center mb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10">
                <AlertCircle size={22} className="text-amber-400" />
              </div>
            </div>
            <h2 className="font-sora text-xl font-semibold text-white mb-2 text-center">
              Not Currently Covered
            </h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed text-center">
              Based on your answers, your business does not currently meet the CPPA
              cybersecurity audit threshold under §7120. No audit is required at this time.
            </p>

            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 mb-6">
              <p className="text-xs font-semibold text-amber-400 mb-2">Monitor these thresholds</p>
              <ul className="space-y-1.5">
                {[
                  'Annual gross revenue crosses $50 million',
                  'Consumer data volume reaches 100,000 records per year',
                  'Data sales revenue exceeds 50% of total annual revenue',
                  'Sensitive personal data processing reaches 10,000 consumers',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                    <ChevronRight size={10} className="mt-0.5 text-slate-600 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={restart}
              className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-2"
            >
              ← Start over
            </button>
          </Card>
        )}

        {/* ── Terminal: Have Auditor → Platform CTA ────────────────────── */}
        {step === 'have_auditor' && (
          <ContactCard
            IconEl={<Laptop size={22} className="text-teal-400" />}
            title="Get the ShieldAudit Platform"
            subtitle="You bring the auditor. We provide the compliance infrastructure."
            body="ShieldAudit is delivered as a licensed, encrypted platform — available as a Docker container for air-gapped and on-premises environments. Platform access is metered by assessment credits tied to a cryptographic license that disables automatically on expiry."
            tags={['Docker delivery', 'Air-gap capable', 'Annual license', 'Encrypted & metered']}
            primaryLabel="Schedule a Call"
            primaryHref={CALENDAR_URL}
            secondaryLabel={`Email ${CONTACT_EMAIL}`}
            secondaryHref={`mailto:${CONTACT_EMAIL}`}
            onBack={() => setStep('auditor_status')}
          />
        )}

        {/* ── Terminal: Need Auditor → Full-service CTA ────────────────── */}
        {step === 'need_auditor' && (
          <ContactCard
            IconEl={<Shield size={22} className="text-teal-400" />}
            title="We&apos;ll Provide a Qualified Auditor"
            subtitle="ApexShield assigns an independent, regulation-compliant auditor."
            body="Our auditors satisfy the §7122(a)(3) independence requirement and carry E&O insurance. We handle scheduling, conduct the full 18-component assessment, and produce Document A and Document B for CPPA submission — all at a flat engagement fee."
            tags={['§7122(a)(3) compliant', 'E&O insured', 'Full-service']}
            primaryLabel="Schedule a Call"
            primaryHref={CALENDAR_URL}
            secondaryLabel={`Email ${CONTACT_EMAIL}`}
            secondaryHref={`mailto:${CONTACT_EMAIL}`}
            onBack={() => setStep('auditor_status')}
          />
        )}

      </div>

      <p className="mt-10 text-[10px] text-slate-700 text-center max-w-sm">
        ShieldAudit is a product of ApexShield LLC &middot; Not legal advice &middot; Consult qualified counsel for compliance decisions
      </p>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function buildSteps(current: Step, usedScreener: boolean) {
  const order: Step[] = usedScreener
    ? ['know_status', 'screener', 'auditor_status']
    : ['know_status', 'auditor_status'];

  return order.map((id, i) => ({
    label: String(i + 1),
    active: id === current,
    done: order.indexOf(current) > i,
  }));
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-navy-600 bg-navy-700/60 p-8 ${className}`}>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-xs text-teal-400 uppercase tracking-wider mb-2">{children}</p>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="font-sora text-xl font-semibold text-white mb-3">{children}</h1>;
}

function CardBody({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 leading-relaxed mb-6">{children}</p>;
}

function Question({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-slate-200 mb-4">{children}</p>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-5 transition-colors"
    >
      <ArrowLeft size={12} /> Back
    </button>
  );
}

function ChoiceButton({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-xl border border-navy-500 bg-navy-600/40 px-5 py-4 text-left transition-all hover:border-teal-400/40 hover:bg-navy-600/70 group"
    >
      <div>
        <p className="text-sm font-semibold text-slate-200 group-hover:text-teal-400 transition-colors">
          {title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight size={16} className="text-slate-600 group-hover:text-teal-400 flex-shrink-0 ml-3" />
    </button>
  );
}

function ContactCard({
  IconEl,
  title,
  subtitle,
  body,
  tags,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  onBack,
}: {
  IconEl: React.ReactNode;
  title: string;
  subtitle: string;
  body: string;
  tags: string[];
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  onBack: () => void;
}) {
  return (
    <div className="rounded-2xl border border-teal-400/20 bg-navy-700/60 p-8">
      <BackButton onClick={onBack} />
      <div className="flex justify-center mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-400/10">
          {IconEl}
        </div>
      </div>
      <h2
        className="font-sora text-xl font-semibold text-white mb-1 text-center"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <p className="text-sm text-teal-400 mb-4 text-center">{subtitle}</p>
      <p className="text-sm text-slate-400 mb-5 leading-relaxed text-center">{body}</p>
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {tags.map(tag => (
          <span
            key={tag}
            className="rounded-full border border-navy-500 bg-navy-600/40 px-3 py-1 text-xs text-slate-400"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        <a
          href={primaryHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-800 font-semibold py-3 text-sm transition-colors"
        >
          <Calendar size={14} />
          {primaryLabel}
        </a>
        <a
          href={secondaryHref}
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-navy-500 hover:border-navy-400 text-slate-400 hover:text-slate-300 py-2.5 text-sm transition-colors"
        >
          <Mail size={14} />
          {secondaryLabel}
        </a>
      </div>
    </div>
  );
}
