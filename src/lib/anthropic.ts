/**
 * Anthropic client for ADD-17 autofill.
 *
 * The API key + model are resolved from the in-app settings store first, then
 * env (see integrations/config). The client is created per call so a key
 * entered in the UI takes effect immediately (no restart needed). The SDK is
 * imported lazily to avoid crypto-init crashes on Windows build workers.
 */

import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { getEffectiveAnthropicKey } from '@/lib/integrations/config';

export async function getAnthropic(): Promise<Anthropic> {
  const { default: AnthropicSdk } = await import('@anthropic-ai/sdk');
  const apiKey = (await getEffectiveAnthropicKey()) ?? undefined;
  return new AnthropicSdk({ apiKey });
}

export const MAX_TOKENS_SUMMARY = 4000;
export const MAX_TOKENS_AUTOFILL = 8000;
export const MAX_TOKENS_READABILITY = 2000;
