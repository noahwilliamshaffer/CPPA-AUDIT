/**
 * Root layout — wraps all routes with ClerkProvider and the ShieldAudit
 * design system fonts (Sora for headings, IBM Plex Mono for data/scores).
 */

import type { Metadata } from 'next';
import { Sora, IBM_Plex_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
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
  title: 'ShieldAudit — CCPA Cybersecurity Audit Platform',
  description:
    'Conduct CPPA-required cybersecurity audits under Cal. Code Regs. tit. 11, §§ 7120–7124. Generate Document A and Document B for CPPA submission.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${sora.variable} ${ibmPlexMono.variable}`}>
        <body className="min-h-screen bg-navy-700 text-slate-100 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
