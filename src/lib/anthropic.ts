/**
 * Anthropic client singleton + model configuration for ADD-17 autofill.
 *
 * The SDK is imported lazily (dynamic import inside getAnthropic) rather than at
 * module-init time. The `docx`/`pdfkit`/SDK packages trigger Node.js crypto
 * initialization that crashes Windows Node.js 20 build workers when loaded at
 * import time; deferring to runtime avoids it. `@anthropic-ai/sdk` is also
 * listed in next.config.mjs `serverExternalPackages`.
 */

import type Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export async function getAnthropic(): Promise<Anthropic> {
  if (_client) return _client;
  const { default: AnthropicSdk } = await import('@anthropic-ai/sdk');
  _client = new AnthropicSdk({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// Model is overridable via env so the deployment can track the current Sonnet
// without a code change. Defaults to Claude Sonnet 4.5.
export const AUTOFILL_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
export const MAX_TOKENS_SUMMARY = 4000;
export const MAX_TOKENS_AUTOFILL = 8000;
export const MAX_TOKENS_READABILITY = 2000;
