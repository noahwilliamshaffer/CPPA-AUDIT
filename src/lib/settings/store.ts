/**
 * Settings store — instance-level config persisted in the app_settings table.
 * Secret values are encrypted at rest via crypto.ts. Non-secret values
 * (e.g. a Jira base URL or project key) are stored as plain text.
 */

import 'server-only';
import { encryptSecret, decryptSecret } from './crypto';

/** Read a single setting, decrypting if it was stored as a secret. */
export async function getSetting(key: string): Promise<string | null> {
  const { db } = await import('@/db');
  const { appSettings } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row.isSecret) return row.value;
  try {
    return decryptSecret(row.value);
  } catch {
    return null; // key rotated / corrupt — treat as unset
  }
}

/** Read several settings at once into a { key: value|null } map. */
export async function getSettingsMap(keys: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const k of keys) out[k] = await getSetting(k);
  return out;
}

/** Upsert a setting. Empty/whitespace value deletes it (clears the field). */
export async function setSetting(key: string, value: string | null | undefined, isSecret = false): Promise<void> {
  const { db } = await import('@/db');
  const { appSettings } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  if (value == null || value.trim() === '') {
    await db.delete(appSettings).where(eq(appSettings.key, key));
    return;
  }

  const stored = isSecret ? encryptSecret(value) : value;
  await db
    .insert(appSettings)
    .values({ key, value: stored, isSecret, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: stored, isSecret, updatedAt: new Date() },
    });
}

/** True if a non-empty value is stored for the key. */
export async function hasSetting(key: string): Promise<boolean> {
  return (await getSetting(key)) != null;
}
