/**
 * Root layout — offline mode. No Clerk provider needed.
 * Fonts: Sora for headings, IBM Plex Mono for data/scores.
 */

import type { Metadata } from 'next';
import { Sora, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ShieldAudit — CCPA Cybersecurity Audit',
  description:
    'CPPA-required cybersecurity audit tool. Assess all 18 §7123(c) components, get risk scores, and generate Document A and Document B.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-screen bg-navy-700 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
