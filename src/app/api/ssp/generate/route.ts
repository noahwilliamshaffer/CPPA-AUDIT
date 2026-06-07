/**
 * POST /api/ssp/generate
 *
 * Document C — AI-drafted System Security Plan. Gathers the assessment answers
 * (per §7123(c) component + ADMT) and the latest NIST 800-53 document summary,
 * drafts the SSP (Claude, or deterministic mock), renders it as PDF or DOCX, and
 * records a reports row for the 5-year retention trail.
 *
 * Body: { format?: 'pdf' | 'docx' }   (defaults to 'pdf')
 */

import { NextResponse } from 'next/server';
import { AUDIT_COMPONENTS } from '@/lib/components';
import type { SspComponentInput, SspQuestion } from '@/app/actions/ssp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const FORMATS = ['pdf', 'docx'] as const;
type Format = (typeof FORMATS)[number];

export async function POST(req: Request) {
  const userId = 'local-user';

  let format: Format = 'pdf';
  try {
    const body = (await req.json()) as { format?: unknown };
    if (body.format && FORMATS.includes(body.format as Format)) format = body.format as Format;
  } catch {
    // empty body → default pdf
  }

  const { db } = await import('@/db');
  const { userRoles, organizations, assessments, questions, answers, aiAutofillSessions, reports } =
    await import('@/db/schema');
  const { eq, desc, and } = await import('drizzle-orm');

  const roleRows = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.clerkUserId, userId)).limit(1);
  if (roleRows.length === 0) return NextResponse.json({ error: 'No organization found.' }, { status: 404 });
  const { orgId } = roleRows[0];

  const orgRows = await db
    .select({ name: organizations.name, legalEntity: organizations.legalEntity })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (orgRows.length === 0) return NextResponse.json({ error: 'Organization record not found.' }, { status: 404 });
  const { name: orgName, legalEntity } = orgRows[0];

  const assessmentRows = await db
    .select({ id: assessments.id, status: assessments.status, auditPeriodStart: assessments.auditPeriodStart, auditPeriodEnd: assessments.auditPeriodEnd })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  if (assessmentRows.length === 0) return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });
  const { id: assessmentId, status, auditPeriodStart, auditPeriodEnd } = assessmentRows[0];

  if (status === 'draft' || status === 'in_progress') {
    return NextResponse.json(
      { error: 'Complete and score the assessment before generating a System Security Plan.' },
      { status: 403 }
    );
  }

  // Answers joined with question metadata
  const answerRows = await db
    .select({
      questionId: questions.id,
      componentNumber: questions.componentNumber,
      questionText: questions.questionText,
      riskWeight: questions.riskWeight,
      answerType: questions.answerType,
      remediation: questions.remediation,
      response: answers.response,
      responseText: answers.responseText,
      auditorNotes: answers.auditorNotes,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(answers.assessmentId, assessmentId), eq(answers.orgId, orgId)));

  const byComponent = new Map<number, SspQuestion[]>();
  for (const r of answerRows) {
    const list = byComponent.get(r.componentNumber) ?? [];
    list.push({
      id: r.questionId,
      text: r.questionText,
      response: r.response,
      responseText: r.responseText,
      notes: r.auditorNotes,
      remediation: r.remediation,
      riskWeight: r.riskWeight,
      answerType: r.answerType ?? 'yes_partial_no_na',
    });
    byComponent.set(r.componentNumber, list);
  }

  const components: SspComponentInput[] = AUDIT_COMPONENTS.map(c => ({
    number: c.number,
    title: c.title,
    citation: c.citation,
    description: c.description,
    isAdmt: c.isAdmt,
    questions: byComponent.get(c.number) ?? [],
  }));

  // Latest NIST summary (may be absent if autofill was skipped)
  const sessionRows = await db
    .select({ nistSummaryText: aiAutofillSessions.nistSummaryText })
    .from(aiAutofillSessions)
    .where(eq(aiAutofillSessions.assessmentId, assessmentId))
    .orderBy(desc(aiAutofillSessions.createdAt))
    .limit(1);
  const nistSummaryText = sessionRows[0]?.nistSummaryText ?? null;

  // Draft the SSP
  const { draftSSP } = await import('@/app/actions/ssp');
  let draft;
  try {
    draft = await draftSSP(orgName, components, nistSummaryText);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to draft the System Security Plan.' },
      { status: 502 }
    );
  }

  const generatedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const sharedInput = {
    orgName,
    legalEntity,
    auditPeriodStart,
    auditPeriodEnd,
    generatedAt,
    executiveOverview: draft.executiveOverview,
    sections: draft.sections,
    aiGenerated: draft.generatedBy === 'ai',
  };

  let docBuffer: Buffer;
  let contentType: string;
  if (format === 'pdf') {
    const { generateSspPdf } = await import('@/lib/pdf/ssp');
    docBuffer = await generateSspPdf(sharedInput);
    contentType = 'application/pdf';
  } else {
    const { generateSspDocx } = await import('@/lib/docx/ssp');
    docBuffer = await generateSspDocx(sharedInput);
    contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  const slug = orgName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const fileName = `ShieldAudit-SSP-${slug}-${auditPeriodEnd ?? 'undated'}.${format}`;

  // Record for the retention trail (report_type is free text in SQLite)
  const priorRows = await db
    .select({ version: reports.version })
    .from(reports)
    .where(and(eq(reports.assessmentId, assessmentId), eq(reports.reportType, 'ssp')))
    .orderBy(desc(reports.generatedAt))
    .limit(1);
  const version = (priorRows[0]?.version ?? 0) + 1;

  await db.insert(reports).values({
    assessmentId,
    orgId,
    reportType: 'ssp',
    docxUrl: `mock://reports/${assessmentId}/ssp/${format}/v${version}`,
    version,
  });

  return new NextResponse(new Uint8Array(docBuffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(docBuffer.length),
      'Cache-Control': 'no-store',
    },
  });
}
