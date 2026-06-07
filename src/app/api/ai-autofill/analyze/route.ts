/**
 * POST /api/ai-autofill/analyze
 *
 * Multipart route for ADD-17 document ingestion. Modes (form field `mode`):
 *   - 'readability' — lightweight per-document triage cards (no DB write)
 *   - 'analyze'     — full two-call pipeline; persists an ai_autofill_sessions row
 *   - 'skip'        — records a 'skipped' session and runs no AI
 *
 * Uploaded files are read into memory, parsed, and discarded. Only filename /
 * type / size metadata is persisted (per §7123 audit-trail need); the document
 * bytes and extracted text are never written to disk or storage.
 */

import { NextResponse } from 'next/server';
import { AUDIT_COMPONENTS } from '@/lib/components';
import type { PipelineDocument, QuestionForAutofill } from '@/app/actions/ai-autofill';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

type FileKind = 'pdf' | 'docx' | 'txt' | 'md' | 'image';

function classify(name: string): { kind: FileKind; mediaType?: string } | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'pdf': return { kind: 'pdf' };
    case 'docx': return { kind: 'docx' };
    case 'txt': return { kind: 'txt' };
    case 'md': return { kind: 'md' };
    case 'png': return { kind: 'image', mediaType: 'image/png' };
    case 'jpg':
    case 'jpeg': return { kind: 'image', mediaType: 'image/jpeg' };
    default: return null;
  }
}

async function resolveOrg(userId: string): Promise<string | null> {
  const { db } = await import('@/db');
  const { userRoles } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.clerkUserId, userId)).limit(1);
  return rows[0]?.orgId ?? null;
}

async function ensureAssessmentId(orgId: string, userId: string): Promise<string> {
  const { db } = await import('@/db');
  const { assessments } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');
  const existing = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const year = new Date().getFullYear();
  const [created] = await db
    .insert(assessments)
    .values({
      orgId,
      auditPeriodStart: `${year}-01-01`,
      auditPeriodEnd: `${year}-12-31`,
      status: 'draft',
      auditorId: userId,
    })
    .returning({ id: assessments.id });
  return created.id;
}

export async function POST(req: Request) {
  const userId = 'local-user';

  const orgId = await resolveOrg(userId);
  if (!orgId) return NextResponse.json({ error: 'No organization found.' }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 });
  }

  const mode = (form.get('mode') as string) || 'analyze';

  const { db } = await import('@/db');
  const { aiAutofillSessions } = await import('@/db/schema');

  // ── Skip — record a skipped session, no AI ────────────────────────────────
  if (mode === 'skip') {
    const assessmentId = await ensureAssessmentId(orgId, userId);
    const [session] = await db
      .insert(aiAutofillSessions)
      .values({ assessmentId, orgId, status: 'skipped', documentsUploaded: [], autofillResults: [], completedAt: new Date() })
      .returning({ id: aiAutofillSessions.id });
    return NextResponse.json({ ok: true, sessionId: session.id, status: 'skipped' });
  }

  // ── Collect + parse uploaded files (in-memory) ────────────────────────────
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Maximum ${MAX_FILES} files.` }, { status: 400 });

  const { extractTextFromBuffer } = await import('@/lib/ai/extractText');

  const documents: PipelineDocument[] = [];
  const metadata: { name: string; type: string; sizeKb: number; uploadedAt: string }[] = [];

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `"${file.name}" exceeds the 25 MB limit.` }, { status: 400 });
    }
    const c = classify(file.name);
    if (!c) {
      return NextResponse.json({ error: `"${file.name}" is an unsupported file type.` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    metadata.push({
      name: file.name,
      type: c.kind,
      sizeKb: Math.round(file.size / 1024),
      uploadedAt: new Date().toISOString(),
    });

    try {
      if (c.kind === 'image') {
        documents.push({ name: file.name, image: { base64: buffer.toString('base64'), mediaType: c.mediaType! } });
      } else {
        const text = await extractTextFromBuffer(buffer, c.kind);
        documents.push({ name: file.name, text });
      }
    } catch {
      return NextResponse.json({ error: `Could not read "${file.name}". It may be corrupt or password-protected.` }, { status: 422 });
    }
  }

  const { runReadabilityPrecheck, runAutofillPipeline } = await import('@/app/actions/ai-autofill');

  // ── Readability pre-check ─────────────────────────────────────────────────
  if (mode === 'readability') {
    try {
      const readability = await runReadabilityPrecheck(documents);
      return NextResponse.json({ ok: true, readability });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Readability check failed.' },
        { status: 502 }
      );
    }
  }

  // ── Full analysis ─────────────────────────────────────────────────────────
  const assessmentId = await ensureAssessmentId(orgId, userId);

  // Load the question bank for Call 2
  const { questions } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const titleByComponent = new Map(AUDIT_COMPONENTS.map(c => [c.number, c.title]));
  const qRows = await db
    .select({
      id: questions.id,
      componentNumber: questions.componentNumber,
      questionText: questions.questionText,
      riskWeight: questions.riskWeight,
      answerType: questions.answerType,
      nistCsf: questions.nistCsfMapping,
      nist80053: questions.nist80053Mapping,
      displayOrder: questions.displayOrder,
    })
    .from(questions)
    .where(eq(questions.active, true))
    .orderBy(questions.displayOrder);

  const questionBank: QuestionForAutofill[] = qRows.map(q => ({
    id: q.id,
    componentNumber: q.componentNumber,
    componentTitle: titleByComponent.get(q.componentNumber) ?? `Component ${q.componentNumber}`,
    questionText: q.questionText,
    riskWeight: q.riskWeight,
    answerType: q.answerType ?? 'yes_partial_no_na',
    nistCsf: q.nistCsf,
    nist80053: q.nist80053,
  }));

  // Create the session row up front so a failure is still recorded.
  const [session] = await db
    .insert(aiAutofillSessions)
    .values({ assessmentId, orgId, status: 'processing', documentsUploaded: metadata, autofillResults: [] })
    .returning({ id: aiAutofillSessions.id });

  try {
    const { nistSummary, results } = await runAutofillPipeline(documents, questionBank);

    await db
      .update(aiAutofillSessions)
      .set({
        status: 'complete',
        nistSummaryText: JSON.stringify(nistSummary),
        autofillResults: results,
        completedAt: new Date(),
      })
      .where(eq(aiAutofillSessions.id, session.id));

    const filled = results.filter(r => r.suggestedAnswer !== null).length;
    const needsReview = results.filter(r => r.needsReview).length;
    const highConfidence = results.filter(r => r.confidence === 'high' && r.suggestedAnswer !== null).length;

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      status: 'complete',
      counts: { total: results.length, filled, needsReview, highConfidence },
    });
  } catch (err) {
    await db
      .update(aiAutofillSessions)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(aiAutofillSessions.id, session.id));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI document analysis failed.', sessionId: session.id, status: 'failed' },
      { status: 502 }
    );
  }
}
