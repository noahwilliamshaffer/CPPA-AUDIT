/**
 * Audit-trail loader + serializers.
 *
 * audit_trail_entries is an IMMUTABLE append-only log (enforced by a DB trigger).
 * This module is read-only: it loads the current org's latest-assessment entries
 * (joined to question text + component title) for the viewer page and the
 * CSV/JSON export. Nothing here mutates the log.
 */

import 'server-only';
import { AUDIT_COMPONENTS } from '@/lib/components';

export interface AuditTrailRow {
  id: string;
  timestamp: Date;
  action: string;
  componentNumber: number | null;
  componentTitle: string | null;
  questionId: string | null;
  questionText: string | null;
  auditorId: string;
  priorValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
}

export interface AuditTrailData {
  orgName: string;
  assessmentId: string | null;
  rows: AuditTrailRow[];
}

export async function loadAuditTrail(userId = 'local-user'): Promise<AuditTrailData | null> {
  const { db } = await import('@/db');
  const { organizations, userRoles, assessments, auditTrailEntries, questions } = await import('@/db/schema');
  const { eq, and, desc } = await import('drizzle-orm');

  const roleRows = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.clerkUserId, userId)).limit(1);
  if (roleRows.length === 0) return null;
  const { orgId } = roleRows[0];

  const orgRows = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const orgName = orgRows[0]?.name ?? 'Organization';

  const aRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  const assessmentId = aRows[0]?.id ?? null;
  if (!assessmentId) return { orgName, assessmentId: null, rows: [] };

  const raw = await db
    .select({
      id: auditTrailEntries.id,
      timestamp: auditTrailEntries.timestamp,
      action: auditTrailEntries.action,
      componentNumber: auditTrailEntries.componentNumber,
      questionId: auditTrailEntries.questionId,
      questionText: questions.questionText,
      auditorId: auditTrailEntries.auditorId,
      priorValue: auditTrailEntries.priorValue,
      newValue: auditTrailEntries.newValue,
      ipAddress: auditTrailEntries.ipAddress,
    })
    .from(auditTrailEntries)
    .leftJoin(questions, eq(auditTrailEntries.questionId, questions.id))
    .where(and(eq(auditTrailEntries.assessmentId, assessmentId), eq(auditTrailEntries.orgId, orgId)))
    .orderBy(desc(auditTrailEntries.timestamp));

  const rows: AuditTrailRow[] = raw.map((r) => ({
    ...r,
    componentTitle: r.componentNumber ? AUDIT_COMPONENTS.find((c) => c.number === r.componentNumber)?.title ?? null : null,
  }));
  return { orgName, assessmentId, rows };
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

export function auditTrailToCsv(rows: AuditTrailRow[]): string {
  const esc = (s: string) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const header = ['Timestamp', 'Action', 'Component', 'Question', 'Prior value', 'New value', 'Auditor', 'IP'];
  const lines = rows.map((r) =>
    [
      r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
      r.action,
      r.componentNumber ? `${r.componentNumber} ${r.componentTitle ?? ''}`.trim() : '',
      r.questionId ? `${r.questionId}: ${r.questionText ?? ''}`.trim() : '',
      fmtValue(r.priorValue),
      fmtValue(r.newValue),
      r.auditorId,
      r.ipAddress ?? '',
    ]
      .map(esc)
      .join(',')
  );
  return [header.map(esc).join(','), ...lines].join('\r\n');
}

export function auditTrailToJson(data: AuditTrailData): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: 'ShieldAudit',
      org: data.orgName,
      assessmentId: data.assessmentId,
      count: data.rows.length,
      entries: data.rows,
    },
    null,
    2
  );
}
