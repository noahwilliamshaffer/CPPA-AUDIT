/**
 * POST /api/evidence/upload  (multipart: file, component, [questionId], [description])
 *
 * Saves an auditor-observed evidence file (§7123(e)) to the /data volume, records
 * it in evidence_items, and writes an immutable audit-trail entry linking the
 * evidence id to the component.
 */

import { NextResponse } from 'next/server';
import { getOrgAndAssessment } from '@/lib/current-assessment';
import { MAX_EVIDENCE_BYTES, ALLOWED_EXTENSIONS, extensionOf, saveEvidence } from '@/lib/evidence-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  const ctx = await getOrgAndAssessment();
  if (!ctx?.assessmentId) return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 });
  }

  const file = form.get('file');
  const component = Number(form.get('component'));
  const description = (form.get('description')?.toString() ?? '').slice(0, 500) || null;
  const questionId = form.get('questionId')?.toString() || null;

  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  if (!Number.isFinite(component) || component < 1 || component > 19) {
    return NextResponse.json({ error: 'Invalid component.' }, { status: 400 });
  }
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) return NextResponse.json({ error: `File type .${ext} is not allowed.` }, { status: 400 });
  if (file.size > MAX_EVIDENCE_BYTES) return NextResponse.json({ error: 'File exceeds the 25 MB limit.' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID();
  const key = saveEvidence(id, file.name, buf);

  const { db } = await import('@/db');
  const { evidenceItems, auditTrailEntries } = await import('@/db/schema');

  await db.insert(evidenceItems).values({
    id,
    assessmentId: ctx.assessmentId,
    orgId: ctx.orgId,
    componentNumber: component,
    questionId,
    fileUrl: key,
    fileName: file.name,
    fileType: file.type || ext,
    fileSizeBytes: file.size,
    uploadedBy: 'local-user',
    description,
  });

  await db.insert(auditTrailEntries).values({
    assessmentId: ctx.assessmentId,
    orgId: ctx.orgId,
    componentNumber: component,
    questionId,
    auditorId: 'local-user',
    action: 'evidence_uploaded',
    newValue: { fileName: file.name, sizeBytes: file.size },
    evidenceIds: JSON.stringify([id]),
  });

  return NextResponse.json({ ok: true, id, fileName: file.name, downloadUrl: `/api/evidence/${id}/download` });
}
