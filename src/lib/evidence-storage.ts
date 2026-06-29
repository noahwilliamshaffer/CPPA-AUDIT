/**
 * Evidence Locker disk storage (offline). Files live on the same volume as the
 * SQLite DB — `<dataDir>/evidence/<id>__<name>` — so they're captured by the
 * existing /data backup and persist across container restarts. The DB row keeps
 * metadata + the storage key (in evidence_items.fileUrl).
 */

import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { encryptBuffer, decryptBuffer } from '@/lib/settings/crypto';

export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024; // 25 MB

// Accepted evidence types (documents, spreadsheets, images, text).
export const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'json', 'log',
  'png', 'jpg', 'jpeg', 'gif', 'webp',
]);

export function dataDir(): string {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'shieldaudit.db');
  return path.dirname(path.resolve(dbPath));
}

export function sanitizeName(name: string): string {
  const cleaned = name.replace(/[^\w.\- ]/g, '_').replace(/\s+/g, '_').slice(0, 120);
  return cleaned || 'file';
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/** Relative storage key (forward slashes) stored in evidence_items.fileUrl. */
export function storageKeyFor(id: string, fileName: string): string {
  return `evidence/${id}__${sanitizeName(fileName)}`;
}

export function saveEvidence(id: string, fileName: string, buf: Buffer): string {
  const key = storageKeyFor(id, fileName);
  const abs = path.join(dataDir(), key);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  // Encrypt evidence at rest (AES-256-GCM) — §7123 Evidence Locker requirement.
  fs.writeFileSync(abs, encryptBuffer(buf));
  return key;
}

/** Read + decrypt an evidence file. Falls back to raw bytes for any legacy
 *  (pre-encryption) file so older uploads still download. */
export function readEvidence(storageKey: string): Buffer {
  const raw = fs.readFileSync(resolveEvidencePath(storageKey));
  try {
    return decryptBuffer(raw);
  } catch {
    return raw; // legacy plaintext file
  }
}

export function resolveEvidencePath(storageKey: string): string {
  // Guard against path traversal: only allow keys under the evidence/ dir.
  const safe = storageKey.replace(/\\/g, '/');
  if (!safe.startsWith('evidence/') || safe.includes('..')) {
    throw new Error('Invalid evidence storage key');
  }
  return path.join(dataDir(), safe);
}

export function deleteEvidence(storageKey: string): void {
  try {
    fs.unlinkSync(resolveEvidencePath(storageKey));
  } catch {
    /* already gone — non-fatal */
  }
}
