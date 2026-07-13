/**
 * Full org data backup — export the entire audit dataset (assessments,
 * answers, evidence files, test/interview logs, scores, gaps, reports, and
 * the audit trail) as a single portable JSON file, and restore it later on
 * this or another install.
 *
 * Excluded by design:
 *  - `questions` — the §7123(c) question bank is static seed data with fixed
 *    regulatory-code IDs (Q-01, A-01, ...), identical across every install
 *    (docker/seed.mjs is idempotent), so it's never exported/imported.
 *  - `app_settings` — integration credentials / API keys. These are secrets
 *    encrypted with a per-install key; bundling them into a portable JSON
 *    backup would risk leaking credentials if the file is shared or lost.
 *    Reconfigure integrations separately on each install.
 */

import 'server-only';
import { readEvidence, saveEvidence, deleteEvidence } from '@/lib/evidence-storage';

export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  source: 'shieldaudit';
  organization: Record<string, unknown>;
  userRoles: Record<string, unknown>[];
  assessments: Record<string, unknown>[];
  eligibilityResults: Record<string, unknown>[];
  componentApplicability: Record<string, unknown>[];
  answers: Record<string, unknown>[];
  evidenceItems: (Record<string, unknown> & { fileContentBase64: string | null })[];
  testLogs: Record<string, unknown>[];
  interviewLogs: Record<string, unknown>[];
  componentScores: Record<string, unknown>[];
  admtAssessments: Record<string, unknown>[];
  gapRecords: Record<string, unknown>[];
  reports: Record<string, unknown>[];
  aiAutofillSessions: Record<string, unknown>[];
  auditTrailEntries: Record<string, unknown>[];
}

export interface RestoreResult {
  orgId: string;
  orgName: string;
  assessmentCount: number;
  answerCount: number;
  evidenceFileCount: number;
  replacedExisting: boolean;
}

export async function orgExistsForUser(userId = 'local-user'): Promise<{ orgId: string; orgName: string } | null> {
  const { db } = await import('@/db');
  const { userRoles, organizations } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db
    .select({ orgId: userRoles.orgId, orgName: organizations.name })
    .from(userRoles)
    .innerJoin(organizations, eq(userRoles.orgId, organizations.id))
    .where(eq(userRoles.clerkUserId, userId))
    .limit(1);
  return rows[0] ?? null;
}

// ── Export ───────────────────────────────────────────────────────────────────

export async function buildBackup(orgId: string): Promise<BackupPayload> {
  const { db } = await import('@/db');
  const {
    organizations, userRoles, assessments, eligibilityResults, componentApplicability,
    answers, evidenceItems, testLogs, interviewLogs, componentScores, admtAssessments,
    gapRecords, reports, aiAutofillSessions, auditTrailEntries,
  } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');

  const orgRows = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (orgRows.length === 0) throw new Error('Organization not found.');

  const assessmentRows = await db.select().from(assessments).where(eq(assessments.orgId, orgId));
  const assessmentIds = assessmentRows.map((a) => a.id);

  const [
    userRoleRows, eligibilityRows, applicabilityRows, answerRows, evidenceRows,
    testLogRows, interviewLogRows, scoreRows, admtRows, gapRows, reportRows,
    autofillRows, trailRows,
  ] = await Promise.all([
    db.select().from(userRoles).where(eq(userRoles.orgId, orgId)),
    db.select().from(eligibilityResults).where(eq(eligibilityResults.orgId, orgId)),
    assessmentIds.length ? db.select().from(componentApplicability).where(inArray(componentApplicability.assessmentId, assessmentIds)) : [],
    db.select().from(answers).where(eq(answers.orgId, orgId)),
    db.select().from(evidenceItems).where(eq(evidenceItems.orgId, orgId)),
    db.select().from(testLogs).where(eq(testLogs.orgId, orgId)),
    db.select().from(interviewLogs).where(eq(interviewLogs.orgId, orgId)),
    assessmentIds.length ? db.select().from(componentScores).where(inArray(componentScores.assessmentId, assessmentIds)) : [],
    assessmentIds.length ? db.select().from(admtAssessments).where(inArray(admtAssessments.assessmentId, assessmentIds)) : [],
    db.select().from(gapRecords).where(eq(gapRecords.orgId, orgId)),
    db.select().from(reports).where(eq(reports.orgId, orgId)),
    db.select().from(aiAutofillSessions).where(eq(aiAutofillSessions.orgId, orgId)),
    db.select().from(auditTrailEntries).where(eq(auditTrailEntries.orgId, orgId)),
  ]);

  // Evidence files live encrypted on disk; decrypt to plain bytes so the
  // backup is portable to an install with a different at-rest key, then
  // base64-encode for JSON. Missing/unreadable files degrade to
  // metadata-only rather than failing the whole export.
  const evidenceWithContent = evidenceRows.map((item) => {
    let fileContentBase64: string | null = null;
    try {
      fileContentBase64 = readEvidence(item.fileUrl).toString('base64');
    } catch {
      fileContentBase64 = null;
    }
    return { ...item, fileContentBase64 };
  });

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    source: 'shieldaudit',
    organization: orgRows[0],
    userRoles: userRoleRows,
    assessments: assessmentRows,
    eligibilityResults: eligibilityRows,
    componentApplicability: applicabilityRows,
    answers: answerRows,
    evidenceItems: evidenceWithContent,
    testLogs: testLogRows,
    interviewLogs: interviewLogRows,
    componentScores: scoreRows,
    admtAssessments: admtRows,
    gapRecords: gapRows,
    reports: reportRows,
    aiAutofillSessions: autofillRows,
    auditTrailEntries: trailRows,
  };
}

// ── Import ───────────────────────────────────────────────────────────────────

function isBackupPayload(v: unknown): v is BackupPayload {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const org = o.organization as Record<string, unknown> | undefined;
  return (
    typeof o.schemaVersion === 'number' &&
    !!org && typeof org === 'object' &&
    typeof org.id === 'string' &&
    typeof org.legalEntity === 'string'
  );
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Convert ISO date strings back into Date instances for the given keys —
 *  required for `integer({mode:'timestamp'})` columns, which JSON.stringify
 *  turned into strings and JSON.parse leaves as strings. */
function reviveDates<T extends Record<string, unknown>>(rows: T[], keys: (keyof T)[]): T[] {
  return rows.map((row) => {
    const copy = { ...row };
    for (const k of keys) {
      const v = copy[k];
      if (typeof v === 'string') copy[k] = new Date(v) as T[keyof T];
    }
    return copy;
  });
}

export async function restoreBackup(
  raw: unknown,
  opts: { userId?: string; replaceExisting: boolean }
): Promise<RestoreResult> {
  const userId = opts.userId ?? 'local-user';

  if (!isBackupPayload(raw)) {
    throw new Error('That file is not a valid ShieldAudit backup.');
  }
  if (raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('This backup was created by a newer version of ShieldAudit. Update the app before importing.');
  }

  const { db } = await import('@/db');
  const {
    organizations, userRoles, assessments, eligibilityResults, componentApplicability,
    answers, evidenceItems, testLogs, interviewLogs, componentScores, admtAssessments,
    gapRecords, reports, aiAutofillSessions, auditTrailEntries,
  } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const existing = await orgExistsForUser(userId);
  if (existing && !opts.replaceExisting) {
    const err = new Error('An organization already exists on this install. Confirm to replace it with the imported backup.') as Error & { code?: string };
    err.code = 'CONFIRM_REQUIRED';
    throw err;
  }
  const replacedExisting = !!existing;

  // Evidence files on disk for the org being replaced — collected up front
  // (read-only) so the actual deletion can happen only after the DB
  // transaction below has committed successfully.
  const staleEvidenceKeys = existing
    ? (await db.select({ fileUrl: evidenceItems.fileUrl }).from(evidenceItems).where(eq(evidenceItems.orgId, existing.orgId))).map((e) => e.fileUrl)
    : [];

  const org = reviveDates([raw.organization as Record<string, unknown>], ['createdAt'])[0] as typeof organizations.$inferInsert;
  const evidenceList = arr<BackupPayload['evidenceItems'][number]>(raw.evidenceItems);

  const assessmentRows = reviveDates(
    arr<Record<string, unknown>>(raw.assessments),
    ['createdAt', 'completedAt', 'lockedAt']
  ) as (typeof assessments.$inferInsert)[];
  const answerRows = reviveDates(
    arr<Record<string, unknown>>(raw.answers),
    ['updatedAt']
  ) as (typeof answers.$inferInsert)[];
  const evidenceRows = reviveDates(
    evidenceList.map(({ fileContentBase64: _fileContentBase64, ...rest }) => rest),
    ['uploadedAt']
  ) as (typeof evidenceItems.$inferInsert)[];
  const trailRows = reviveDates(
    arr<Record<string, unknown>>(raw.auditTrailEntries),
    ['timestamp']
  ) as (typeof auditTrailEntries.$inferInsert)[];

  // Sync (non-async) transaction — better-sqlite3 executes transactions
  // synchronously; every statement inside uses .run() rather than await.
  // The old org's delete lives in the SAME transaction as the reinsert, so
  // a failure anywhere rolls back to the pre-import state — never a half-wiped DB.
  db.transaction((tx) => {
    if (existing) {
      tx.delete(organizations).where(eq(organizations.id, existing.orgId)).run();
    }

    tx.insert(organizations).values(org).run();

    const userRoleRows = reviveDates(
      arr<Record<string, unknown>>(raw.userRoles),
      ['createdAt']
    ) as (typeof userRoles.$inferInsert)[];
    if (userRoleRows.length) tx.insert(userRoles).values(userRoleRows).run();
    else tx.insert(userRoles).values({ orgId: org.id as string, clerkUserId: userId, role: 'admin' }).run();

    if (assessmentRows.length) tx.insert(assessments).values(assessmentRows).run();

    const eligRows = reviveDates(
      arr<Record<string, unknown>>(raw.eligibilityResults),
      ['createdAt']
    ) as (typeof eligibilityResults.$inferInsert)[];
    if (eligRows.length) tx.insert(eligibilityResults).values(eligRows).run();

    const appRows = reviveDates(
      arr<Record<string, unknown>>(raw.componentApplicability),
      ['markedAt']
    ) as (typeof componentApplicability.$inferInsert)[];
    if (appRows.length) tx.insert(componentApplicability).values(appRows).run();

    if (answerRows.length) tx.insert(answers).values(answerRows).run();
    if (evidenceRows.length) tx.insert(evidenceItems).values(evidenceRows).run();

    const testLogRows = reviveDates(
      arr<Record<string, unknown>>(raw.testLogs),
      ['createdAt']
    ) as (typeof testLogs.$inferInsert)[];
    if (testLogRows.length) tx.insert(testLogs).values(testLogRows).run();

    const interviewLogRows = reviveDates(
      arr<Record<string, unknown>>(raw.interviewLogs),
      ['createdAt']
    ) as (typeof interviewLogs.$inferInsert)[];
    if (interviewLogRows.length) tx.insert(interviewLogs).values(interviewLogRows).run();

    const scoreRows = reviveDates(
      arr<Record<string, unknown>>(raw.componentScores),
      ['calculatedAt']
    ) as (typeof componentScores.$inferInsert)[];
    if (scoreRows.length) tx.insert(componentScores).values(scoreRows).run();

    const admtRows = reviveDates(
      arr<Record<string, unknown>>(raw.admtAssessments),
      ['createdAt']
    ) as (typeof admtAssessments.$inferInsert)[];
    if (admtRows.length) tx.insert(admtAssessments).values(admtRows).run();

    const gapRows = reviveDates(
      arr<Record<string, unknown>>(raw.gapRecords),
      ['createdAt', 'updatedAt']
    ) as (typeof gapRecords.$inferInsert)[];
    if (gapRows.length) tx.insert(gapRecords).values(gapRows).run();

    const reportRows = reviveDates(
      arr<Record<string, unknown>>(raw.reports),
      ['generatedAt']
    ) as (typeof reports.$inferInsert)[];
    if (reportRows.length) tx.insert(reports).values(reportRows).run();

    const autofillRows = reviveDates(
      arr<Record<string, unknown>>(raw.aiAutofillSessions),
      ['createdAt', 'completedAt', 'auditorReviewedAt']
    ) as (typeof aiAutofillSessions.$inferInsert)[];
    if (autofillRows.length) tx.insert(aiAutofillSessions).values(autofillRows).run();

    if (trailRows.length) tx.insert(auditTrailEntries).values(trailRows).run();

    tx.insert(auditTrailEntries).values({
      orgId: org.id as string,
      auditorId: userId,
      action: 'data_imported',
      newValue: {
        exportedAt: raw.exportedAt,
        replacedExisting,
        assessmentCount: assessmentRows.length,
        answerCount: answerRows.length,
      },
    }).run();
  });

  // Filesystem writes aren't part of the SQL transaction — do these after
  // the DB commit succeeds so a write failure never leaves a half-committed DB.
  for (const key of staleEvidenceKeys) {
    try { deleteEvidence(key); } catch { /* non-fatal */ }
  }

  let evidenceFileCount = 0;
  for (const item of evidenceList) {
    if (!item.fileContentBase64) continue;
    try {
      saveEvidence(item.id as string, item.fileName as string, Buffer.from(item.fileContentBase64, 'base64'));
      evidenceFileCount++;
    } catch {
      /* DB row already inserted; file write failure is non-fatal */
    }
  }

  return {
    orgId: org.id as string,
    orgName: (org.name as string) ?? (org.legalEntity as string),
    assessmentCount: assessmentRows.length,
    answerCount: answerRows.length,
    evidenceFileCount,
    replacedExisting,
  };
}
