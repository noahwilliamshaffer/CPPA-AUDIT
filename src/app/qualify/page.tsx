import type { Metadata } from 'next';
import QualifyWizard from './QualifyWizard';

export const metadata: Metadata = {
  title: 'Check Your CPPA Audit Eligibility — ShieldAudit',
  description:
    'Determine whether your California business is required to complete an annual CPPA cybersecurity audit under Cal. Code Regs. tit. 11, §7120, and find the right auditing solution.',
};

export default function QualifyPage() {
  return <QualifyWizard />;
}
