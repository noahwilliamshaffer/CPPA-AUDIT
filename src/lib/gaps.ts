/**
 * Gap engine — persistent gaps + remediation tracking (§7123(d) Document A
 * elements 4 & 6). syncGaps() reconciles gap_records with the current no/partial
 * answers: it upserts a gap per gap-producing question (seeding the suggested
 * remediation as a default) and deletes gaps whose answer is no longer a gap.
 * The auditor's remediation plan / target date / status are PRESERVED on
 * regenerate (only the gap facts are refreshed).
 */

import 'server-only';
import { AUDIT_COMPONENTS } from '@/lib/components';

const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export interface GapRow {
  id: string;
  componentNumber: number;
  componentTitle: string | null;
  citation: string;
  questionId: string | null;
  riskWeight: string;
  response: string;
  title: string;
  description: string;
  remediationPlan: string | null;
  remediationDue: string | null;
  status: string;
}

export async function syncGaps(assessmentId: string, orgId: string): Promise<number> {
  const { db } = await import('@/db');
  const { answers, questions, gapRecords } = await import('@/db/schema');
  const { eq, and, inArray, notInArray } = await import('drizzle-orm');

  const rows = await db
    .select({
      questionId: answers.questionId,
      response: answers.response,
      componentNumber: questions.componentNumber,
      questionText: questions.questionText,
      riskWeight: questions.riskWeight,
      remediation: questions.remediation,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(answers.assessmentId, assessmentId), inArray(answers.response, ['no', 'partial'])));

  for (const r of rows) {
    const comp = AUDIT_COMPONENTS.find(c => c.number === r.componentNumber);
    const citation = comp?.citation ?? `§7123(c)(${r.componentNumber})`;
    const title = `${citation} — ${comp?.title ?? `Component ${r.componentNumber}`}`;
    const gap = r.response === 'no' ? 'Control not implemented' : 'Control partially implemented';
    const description = `${gap}: ${r.questionText}`;
    await db
      .insert(gapRecords)
      .values({
        assessmentId, orgId, componentNumber: r.componentNumber, questionId: r.questionId,
        riskWeight: r.riskWeight, response: r.response, title, description,
        remediationPlan: r.remediation ?? null, status: 'open', updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [gapRecords.assessmentId, gapRecords.questionId],
        // Refresh the gap facts only — preserve the auditor's remediation/status.
        set: { riskWeight: r.riskWeight, response: r.response, title, description, componentNumber: r.componentNumber, updatedAt: new Date() },
      });
  }

  // Remove gaps whose answer is no longer no/partial (the gap was closed).
  const currentIds = rows.map(r => r.questionId);
  if (currentIds.length > 0) {
    await db.delete(gapRecords).where(and(eq(gapRecords.assessmentId, assessmentId), notInArray(gapRecords.questionId, currentIds)));
  } else {
    await db.delete(gapRecords).where(eq(gapRecords.assessmentId, assessmentId));
  }

  return rows.length;
}

export async function loadGaps(assessmentId: string): Promise<GapRow[]> {
  const { db } = await import('@/db');
  const { gapRecords } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(gapRecords).where(eq(gapRecords.assessmentId, assessmentId));
  return rows
    .map(g => {
      const comp = AUDIT_COMPONENTS.find(c => c.number === g.componentNumber);
      return {
        id: g.id,
        componentNumber: g.componentNumber,
        componentTitle: comp?.title ?? null,
        citation: comp?.citation ?? `§7123(c)(${g.componentNumber})`,
        questionId: g.questionId,
        riskWeight: g.riskWeight,
        response: g.response,
        title: g.title,
        description: g.description,
        remediationPlan: g.remediationPlan,
        remediationDue: g.remediationDue,
        status: g.status,
      };
    })
    .sort((a, b) => (RANK[a.riskWeight] ?? 9) - (RANK[b.riskWeight] ?? 9) || a.componentNumber - b.componentNumber);
}
