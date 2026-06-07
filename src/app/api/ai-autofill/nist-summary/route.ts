/**
 * GET /api/ai-autofill/nist-summary
 *
 * Streams the AI-generated NIST 800-53 control-family summary for the current
 * assessment's latest autofill session as a PDF (auditor-facing audit-trail
 * artifact). The PDF generator is imported lazily to avoid crypto init at the
 * Next.js build-worker phase on Windows Node.js 20.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const userId = 'local-user';

  const { db } = await import('@/db');
  const { userRoles, organizations, assessments, aiAutofillSessions } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const roleRows = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.clerkUserId, userId)).limit(1);
  if (roleRows.length === 0) return NextResponse.json({ error: 'No organization found.' }, { status: 404 });
  const { orgId } = roleRows[0];

  const orgRows = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const orgName = orgRows[0]?.name ?? 'Organization';

  const assessmentRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  if (assessmentRows.length === 0) return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });

  const sessionRows = await db
    .select({ nistSummaryText: aiAutofillSessions.nistSummaryText })
    .from(aiAutofillSessions)
    .where(eq(aiAutofillSessions.assessmentId, assessmentRows[0].id))
    .orderBy(desc(aiAutofillSessions.createdAt))
    .limit(1);

  const summaryText = sessionRows[0]?.nistSummaryText;
  if (!summaryText) {
    return NextResponse.json({ error: 'No NIST summary available. Run document analysis first.' }, { status: 404 });
  }

  let parsed: {
    controlFamilySummaries?: Record<string, string | null>;
    documentCoverage?: Record<string, string[]>;
    overallReadabilityAssessment?: string;
  };
  try {
    parsed = JSON.parse(summaryText);
  } catch {
    return NextResponse.json({ error: 'Stored NIST summary is malformed.' }, { status: 500 });
  }

  const { generateNistSummaryPdf } = await import('@/lib/pdf/nistSummary');
  const generatedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const buffer = await generateNistSummaryPdf({
    orgName,
    generatedAt,
    controlFamilySummaries: parsed.controlFamilySummaries ?? {},
    documentCoverage: parsed.documentCoverage ?? {},
    overallReadabilityAssessment: parsed.overallReadabilityAssessment ?? '',
  });

  const slug = orgName.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ShieldAudit-NIST-Summary-${slug}.pdf"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  });
}
