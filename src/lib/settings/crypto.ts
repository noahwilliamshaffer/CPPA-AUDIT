/**
 * At-rest encryption for stored secrets (API tokens).
 *
 * AES-256-GCM. The key comes from APP_SECRET (if set) or a locally generated
 * key file kept next to the SQLite database. This protects tokens from casual
 * DB inspection / accidental commits. For stronger guarantees use an external
 * secrets manager (the "Vault" item on the roadmap).
 */

import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let cachedKey: Buffer | null = null;

function resolveKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = process.env.APP_SECRET;
  if (secret && secret.trim()) {
    cachedKey = crypto.createHash('sha256').update(secret.trim()).digest();
    return cachedKey;
  }

  // Local key file beside the DB (persists on the Docker volume).
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'shieldaudit.db');
  const keyPath = path.join(path.dirname(path.resolve(dbPath)), '.shieldaudit.key');
  try {
    if (fs.existsSync(keyPath)) {
      cachedKey = Buffer.from(fs.readFileSync(keyPath, 'utf8').trim(), 'hex');
      return cachedKey;
    }
  } catch {
    /* fall through to generate */
  }

  const key = crypto.randomBytes(32);
  try {
    fs.writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
  } catch {
    /* non-fatal: key just won't persist, secrets become undecryptable on restart */
  }
  cachedKey = key;
  return cachedKey;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', resolveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', resolveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// ── Binary helpers (e.g. Evidence Locker files at rest) ──────────────────────
/** Encrypt arbitrary bytes. Output layout: iv(12) | authTag(16) | ciphertext. */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', resolveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decryptBuffer(payload: Buffer): Buffer {
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const data = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', resolveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
