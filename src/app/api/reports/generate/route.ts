/**
 * POST /api/reports/generate
 *
 * Generates Document A (Audit Report) or Document B (Executive Certification)
 * as either a PDF or DOCX file and returns it as a binary download.
 *
 * In mock mode (STORAGE_MODE=mock) the document is generated in memory and
 * streamed directly to the client.
 *
 * A record is inserted into the `reports` table on every successful generation
 * to maintain the 5-year audit trail required by §7123.
 *
 * Body: {
 *   reportType: 'audit_report' | 'executive_certification',
 *   format?: 'pdf' | 'docx'   (defaults to 'pdf')
 * }
 * Response: application/pdf  OR  application/vnd.openxmlformats-officedocument...
 */

import { NextRequest, NextResponse } from 'next/server';
// IMPORTANT: document generators are dynamically imported inside the POST handler.
// The docx package (via jszip) triggers Node.js crypto initialization, which
// causes an assertion failure on Windows Node.js 20 when loaded at module-init
// time during the Next.js build worker phase. Lazy import avoids this.

const REPORT_TYPES = ['audit_report', 'executive_certification'] as const;
const FORMATS = ['pdf', 'docx'] as const;

type ReportType = (typeof REPORT_TYPES)[number];
type Format = (typeof FORMATS)[number];

export async function POST(req: NextRequest) {
  const userId = 'local-user';
  

  // Parse + validate body
  let reportType: ReportType;
  let format: Format;
  try {
    const body = await req.json() as { reportType?: unknown; format?: unknown };
    if (!body.reportType || !REPORT_TYPES.includes(body.reportType as ReportType)) {
      return NextResponse.json(
        { error: `reportType must be one of: ${REPORT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    reportType = body.reportType as ReportType;
    // Default to PDF
    format = (body.format && FORMATS.includes(body.format as Format))
      ? body.format as Format
      : 'pdf';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { db } = await import('@/db');
  const {
    userRoles, organizations, assessments, answers,
    questions, componentScores, reports,
  } = await import('@/db/schema');
  const { eq, desc, and } = await import('drizzle-orm');

  // ── Resolve org ──────────────────────────────────────────────────────────
  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, userId))
    .limit(1);
  if (roleRows.length === 0) {
    return NextResponse.json({ error: 'No organization found.' }, { status: 404 });
  }
  const { orgId } = roleRows[0];

  // ── Org details ──────────────────────────────────────────────────────────
  const orgRows = await db
    .select({ name: organizations.name, legalEntity: organizations.legalEntity })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (orgRows.length === 0) {
    return NextResponse.json({ error: 'Organization record not found.' }, { status: 404 });
  }
  const { name: orgName, legalEntity } = orgRows[0];

  // ── Latest assessment ────────────────────────────────────────────────────
  const assessmentRows = await db
    .select({
      id: assessments.id,
      status: assessments.status,
      auditPeriodStart: assessments.auditPeriodStart,
      auditPeriodEnd: assessments.auditPeriodEnd,
    })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);

  if (assessmentRows.length === 0) {
    return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });
  }

  const { id: assessmentId, status, auditPeriodStart, auditPeriodEnd } = assessmentRows[0];

  // Gate: must be scoring or complete to generate documents
  if (status === 'draft' || status === 'in_progress') {
    return NextResponse.json(
      { error: 'Assessment must be scored before generating documents. Run the scoring calculator first.' },
      { status: 403 }
    );
  }

  // ── Component scores ─────────────────────────────────────────────────────
  const scoreRows = await db
    .select({
      componentNumber: componentScores.componentNumber,
      score: componentScores.score,
      status: componentScores.status,
    })
    .from(componentScores)
    .where(eq(componentScores.assessmentId, assessmentId))
    .orderBy(componentScores.componentNumber);

  const scoreMap = new Map(scoreRows.map((s) => [s.componentNumber, s]));

  // ── Answers + question text ──────────────────────────────────────────────
  const answerRows = await db
    .select({
      questionId: questions.id,
      componentNumber: questions.componentNumber,
      questionText: questions.questionText,
      riskWeight: questions.riskWeight,
      response: answers.response,
      auditorNotes: answers.auditorNotes,
      aiGenerated: answers.aiGenerated,
      aiConfidence: answers.aiConfidence,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(answers.assessmentId, assessmentId), eq(answers.orgId, orgId)));

  // Total questions in the bank (for the AI-assisted footnote denominator)
  const totalQuestionRows = await db.select({ id: questions.id }).from(questions);

  // Group answers by component
  const answersByComponent = new Map<number, typeof answerRows>();
  for (const row of answerRows) {
    if (!answersByComponent.has(row.componentNumber)) {
      answersByComponent.set(row.componentNumber, []);
    }
    answersByComponent.get(row.componentNumber)!.push(row);
  }

  // Build component data array (1–18 §7123(c) components + 19 = ADMT sub-assessment)
  const components = Array.from({ length: 19 }, (_, i) => {
    const num = i + 1;
    const s = scoreMap.get(num) ?? null;
    return {
      number: num,
      score: s?.score ?? null,
      status: (s?.status ?? null) as 'green' | 'yellow' | 'red' | null,
      answers: (answersByComponent.get(num) ?? []).map((a) => ({
        questionId: a.questionId,
        questionText: a.questionText,
        riskWeight: a.riskWeight,
        response: a.response,
        auditorNotes: a.auditorNotes ?? null,
        aiAssisted: !!a.aiGenerated,
        aiConfidence: a.aiConfidence ?? null,
      })),
    };
  });

  // AI-assisted summary for the Document A footnote
  const aiAssistedIds = answerRows.filter((a) => a.aiGenerated).map((a) => a.questionId);
  const aiAssisted = {
    count: aiAssistedIds.length,
    total: totalQuestionRows.length,
    questionIds: aiAssistedIds,
  };

  const generatedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const scoredComponents = components.filter((c) => c.score !== null);
  const overallScore =
    scoredComponents.length > 0
      ? Math.round(scoredComponents.reduce((s, c) => s + c.score!, 0) / scoredComponents.length)
      : null;

  const greenCount = scoreRows.filter((s) => s.status === 'green').length;
  const yellowCount = scoreRows.filter((s) => s.status === 'yellow').length;
  const redCount = scoreRows.filter((s) => s.status === 'red').length;

  const slug = orgName.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  // ── Generate document ────────────────────────────────────────────────────
  let docBuffer: Buffer;
  let fileName: string;
  let contentType: string;

  if (format === 'pdf') {
    // PDF generators — dynamically imported to avoid crypto init at build time
    const { generateAuditReportPdf } = await import('@/lib/pdf/auditReport');
    const { generateExecCertificationPdf } = await import('@/lib/pdf/execCertification');

    if (reportType === 'audit_report') {
      docBuffer = await generateAuditReportPdf({
        orgName,
        legalEntity,
        auditPeriodStart,
        auditPeriodEnd,
        generatedAt,
        components,
        aiAssisted,
      });
      fileName = `ShieldAudit-Report-A-${slug}-${auditPeriodEnd ?? 'undated'}.pdf`;
    } else {
      docBuffer = await generateExecCertificationPdf({
        orgName,
        legalEntity,
        auditPeriodStart,
        auditPeriodEnd,
        generatedAt,
        overallScore,
        greenCount,
        yellowCount,
        redCount,
        scoredComponents: scoredComponents.length,
      });
      fileName = `ShieldAudit-Report-B-${slug}-${auditPeriodEnd ?? 'undated'}.pdf`;
    }
    contentType = 'application/pdf';
  } else {
    // DOCX generators — dynamically imported to avoid crypto init at build time
    const { generateAuditReportDocx } = await import('@/lib/docx/auditReport');
    const { generateExecCertificationDocx } = await import('@/lib/docx/execCertification');

    if (reportType === 'audit_report') {
      docBuffer = await generateAuditReportDocx({
        orgName,
        legalEntity,
        auditPeriodStart,
        auditPeriodEnd,
        generatedAt,
        components,
        aiAssisted,
      });
      fileName = `ShieldAudit-Report-A-${slug}-${auditPeriodEnd ?? 'undated'}.docx`;
    } else {
      docBuffer = await generateExecCertificationDocx({
        orgName,
        legalEntity,
        auditPeriodStart,
        auditPeriodEnd,
        generatedAt,
        overallScore,
        greenCount,
        yellowCount,
        redCount,
        scoredComponents: scoredComponents.length,
      });
      fileName = `ShieldAudit-Report-B-${slug}-${auditPeriodEnd ?? 'undated'}.docx`;
    }
    contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  // ── Persist report record ────────────────────────────────────────────────
  const priorRows = await db
    .select({ version: reports.version })
    .from(reports)
    .where(eq(reports.assessmentId, assessmentId))
    .orderBy(desc(reports.generatedAt))
    .limit(1);

  const version = (priorRows[0]?.version ?? 0) + 1;
  const mockUrl = `mock://reports/${assessmentId}/${reportType}/${format}/v${version}`;

  await db.insert(reports).values({
    assessmentId,
    orgId,
    reportType,
    docxUrl: mockUrl,
    version,
  });

  // ── Return document as download ──────────────────────────────────────────
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
