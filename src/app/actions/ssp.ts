/**
 * AI-drafted System Security Plan (SSP) — the final deliverable in the audit flow.
 *
 * Given the assessment answers (per §7123(c) component + ADMT) and the NIST
 * 800-53 document summary, draft a §7123-aligned SSP: an executive overview plus
 * a narrative per component describing implemented controls and remediation gaps.
 *
 * Real mode = one Claude call. STORAGE_MODE=mock (or no ANTHROPIC_API_KEY) =
 * a deterministic narrative synthesized from the answers, so the feature works
 * end-to-end with no API key.
 */

import 'server-only';
import { getAnthropic } from '@/lib/anthropic';
import { getEffectiveAnthropicKey, getEffectiveAnthropicModel } from '@/lib/integrations/config';

const SSP_MAX_TOKENS = 8000;

export interface SspQuestion {
  id: string;
  text: string;
  response: string | null;
  responseText: string | null;
  notes: string | null;
  remediation: string | null;
  riskWeight: string;
  answerType: string;
}

export interface SspComponentInput {
  number: number;
  title: string;
  citation: string;
  description: string;
  isAdmt?: boolean;
  questions: SspQuestion[];
}

export interface SspSection {
  componentNumber: number;
  title: string;
  citation: string;
  narrative: string;
  gaps: string[];
}

export interface SspDraft {
  executiveOverview: string;
  sections: SspSection[];
  generatedBy: 'ai' | 'mock';
}

async function isMock(): Promise<boolean> {
  if (process.env.STORAGE_MODE === 'mock') return true;
  return !(await getEffectiveAnthropicKey());
}

function extractJson(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  return s;
}

// ── Deterministic mock SSP (synthesized from real answers) ───────────────────

function mockSSP(orgName: string, components: SspComponentInput[]): SspDraft {
  const answeredTotal = components.reduce((n, c) => n + c.questions.filter(q => q.response).length, 0);
  const assessedComponents = components.filter(c => c.questions.some(q => q.response)).length;

  const executiveOverview =
    `This System Security Plan (SSP) documents the cybersecurity program of ${orgName} as evaluated ` +
    `against the eighteen enumerated cybersecurity components of Cal. Code Regs. tit. 11, §7123(c) and the ` +
    `Automated Decision-Making Technology requirements of §7200–7222, mapped to NIST SP 800-53 Rev 5. ` +
    `It reflects ${answeredTotal} assessment response(s) across ${assessedComponents} of ${components.length} ` +
    `program areas. The component narratives below describe implemented safeguards and identify remediation ` +
    `items for any controls assessed as partially or not implemented.`;

  const sections: SspSection[] = components.map(c => {
    const answered = c.questions.filter(q => q.response);
    const yes = answered.filter(q => q.response === 'yes').length;
    const partial = answered.filter(q => q.response === 'partial').length;
    const no = answered.filter(q => q.response === 'no').length;
    const na = answered.filter(q => q.response === 'not_applicable').length;

    let narrative: string;
    if (answered.length === 0) {
      narrative =
        `Controls for ${c.title} (${c.citation}) were not assessed during this audit period. ` +
        `${c.description} These controls should be evaluated and documented to demonstrate compliance.`;
    } else {
      const parts = [`${yes} fully implemented`];
      if (partial) parts.push(`${partial} partially implemented`);
      if (no) parts.push(`${no} not implemented`);
      if (na) parts.push(`${na} not applicable`);
      narrative =
        `For ${c.title} (${c.citation}), ${c.description} The organization's controls were assessed across ` +
        `${answered.length} item(s): ${parts.join(', ')}. ` +
        (partial + no > 0
          ? `Remediation is recommended for the gaps identified below.`
          : `Controls in this area appear adequately implemented based on the assessment.`);
    }

    const gaps = c.questions
      .filter(q => q.response === 'partial' || q.response === 'no')
      .map(q => q.remediation?.trim() || `Address the gap identified in: ${q.text}`);

    return { componentNumber: c.number, title: c.title, citation: c.citation, narrative, gaps };
  });

  return { executiveOverview, sections, generatedBy: 'mock' };
}

// ── Real Claude draft ────────────────────────────────────────────────────────

const SSP_SYSTEM = `You are a senior cybersecurity compliance writer. Draft a System Security Plan (SSP) for the organization, aligned to the eighteen cybersecurity components of Cal. Code Regs. tit. 11 §7123(c) plus the ADMT sub-assessment (§7200-7222), and mapped to NIST SP 800-53 Rev 5.

RULES:
1. Use ONLY the audit responses and NIST 800-53 summary provided. Do NOT invent controls, products, or evidence that is not present.
2. For each component, write a factual, audit-defensible narrative (2-4 sentences) describing the implemented controls and the organization's posture.
3. For any control assessed as "partial" or "no", produce a concrete remediation item in that component's "gaps" array. If there are no gaps, use an empty array.
4. Write a concise executive overview (4-6 sentences) summarizing the program, scope (§7123(c) + ADMT), and overall maturity.
5. Professional, plain, regulator-facing tone. No marketing language.

Output ONLY valid JSON, no markdown:
{ "executiveOverview": "...", "sections": [ { "componentNumber": <number>, "narrative": "...", "gaps": ["...", ...] } ] }`;

function buildSspUser(orgName: string, components: SspComponentInput[], nistSummaryText: string | null): string {
  const comp = components
    .map(c => {
      const qs = c.questions
        .map(q => {
          const ans = q.response === 'open_text' ? (q.responseText ?? '(no text)') : (q.response ?? 'unanswered');
          const note = q.notes ? ` | auditor note: ${q.notes}` : '';
          return `    - [${q.id}] (${q.riskWeight}) ${q.text} => ${ans}${note}`;
        })
        .join('\n');
      return `Component ${c.number} — ${c.title} (${c.citation})\n  ${c.description}\n${qs || '    - (no questions answered)'}`;
    })
    .join('\n\n');

  return (
    `Organization: ${orgName}\n\n` +
    (nistSummaryText ? `NIST 800-53 document summary (from uploaded documents):\n${nistSummaryText}\n\n` : '') +
    `Audit responses by component:\n\n${comp}`
  );
}

export async function draftSSP(
  orgName: string,
  components: SspComponentInput[],
  nistSummaryText: string | null
): Promise<SspDraft> {
  if (await isMock()) return mockSSP(orgName, components);

  const client = await getAnthropic();
  const model = await getEffectiveAnthropicModel();
  const msg = await client.messages.create({
    model,
    max_tokens: SSP_MAX_TOKENS,
    system: SSP_SYSTEM,
    messages: [{ role: 'user', content: buildSspUser(orgName, components, nistSummaryText) }],
  });

  const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
  let parsed: { executiveOverview?: string; sections?: { componentNumber?: number; narrative?: string; gaps?: string[] }[] };
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    // Fall back to a deterministic draft rather than failing the download.
    return mockSSP(orgName, components);
  }

  const byNumber = new Map((parsed.sections ?? []).map(s => [s.componentNumber, s]));
  const sections: SspSection[] = components.map(c => {
    const s = byNumber.get(c.number);
    return {
      componentNumber: c.number,
      title: c.title,
      citation: c.citation,
      narrative: (s?.narrative && String(s.narrative).trim()) || `Controls for ${c.title} (${c.citation}) were not described.`,
      gaps: Array.isArray(s?.gaps) ? s!.gaps.filter(g => typeof g === 'string' && g.trim()) : [],
    };
  });

  return {
    executiveOverview: parsed.executiveOverview?.trim() || mockSSP(orgName, components).executiveOverview,
    sections,
    generatedBy: 'ai',
  };
}
