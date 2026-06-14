/**
 * ADD-17 — AI autofill pipeline orchestrator.
 *
 * Two sequential Claude calls:
 *   Call 1 — Document simplification → NIST 800-53 control-family summary (JSON).
 *   Call 2 — Per-question autofill against that summary (Yes/Partial/No/N/A/null).
 * Plus a lightweight readability pre-check used before the main run.
 *
 * Uploaded documents are passed in already-parsed (text) or as base64 images;
 * nothing is persisted to disk. When STORAGE_MODE=mock, every call is
 * short-circuited to deterministic mock output so the full UI flow works with
 * no API key.
 */

import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import {
  getAnthropic,
  MAX_TOKENS_SUMMARY,
  MAX_TOKENS_AUTOFILL,
  MAX_TOKENS_READABILITY,
} from '@/lib/anthropic';
import { getEffectiveAnthropicKey, getEffectiveAnthropicModel } from '@/lib/integrations/config';

type MessageContent = Anthropic.MessageParam['content'];

// ── Types ───────────────────────────────────────────────────────────────────

export interface PipelineDocument {
  name: string;
  text?: string;
  image?: { base64: string; mediaType: string };
}

export interface QuestionForAutofill {
  id: string;
  componentNumber: number;
  componentTitle: string;
  questionText: string;
  riskWeight: string;          // 'critical' | 'high' | 'medium' | 'low'
  answerType: string;          // see schema
  nistCsf: string | null;
  nist80053: string | null;
}

export type SuggestedAnswer = 'yes' | 'partial' | 'no' | 'not_applicable' | null;
export type Confidence = 'high' | 'medium' | 'low' | 'insufficient';

export interface AutofillResult {
  questionId: string;
  suggestedAnswer: SuggestedAnswer;
  confidence: Confidence;
  reasoning: string;
  sourceDocuments: string[];
  needsReview: boolean;
}

export interface NistSummary {
  controlFamilySummaries: Record<string, string | null>;
  documentCoverage: Record<string, string[]>;
  overallReadabilityAssessment: string;
}

export interface PipelineResult {
  nistSummary: NistSummary;
  results: AutofillResult[];
}

export interface ReadabilityResult {
  name: string;
  readability: 'Clear' | 'Dense' | 'Poor';
  relevance: 'High' | 'Medium' | 'Low';
  nistFamilies: string[];
}

const SCORED_TYPES = new Set(['yes_partial_no_na', 'yes_no', 'yes_no_na']);

async function isMock(): Promise<boolean> {
  if (process.env.STORAGE_MODE === 'mock') return true;
  return !(await getEffectiveAnthropicKey());
}

// ── JSON extraction (Claude sometimes wraps in fences / prose) ───────────────

function extractJson(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  return s;
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(extractJson(raw)) as T;
  } catch {
    throw new Error(`Failed to parse ${label} response as JSON: ${raw.slice(0, 200)}`);
  }
}

// ── Output normalization (don't fully trust the model) ───────────────────────

function normalizeAnswer(value: unknown, answerType: string): SuggestedAnswer {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  let token: SuggestedAnswer;
  if (v === 'yes') token = 'yes';
  else if (v === 'partial') token = 'partial';
  else if (v === 'no') token = 'no';
  else if (v === 'n/a' || v === 'na' || v === 'not_applicable' || v === 'not applicable') token = 'not_applicable';
  else return null;

  // Constrain to what the question type actually allows.
  if (answerType === 'yes_no' && (token === 'partial' || token === 'not_applicable')) return null;
  if (answerType === 'yes_no_na' && token === 'partial') return null;
  return token;
}

function normalizeConfidence(value: unknown): Confidence {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (v === 'high' || v === 'medium' || v === 'low' || v === 'insufficient') return v;
  return 'insufficient';
}

// ── System prompts (per ADD-17 spec) ─────────────────────────────────────────

const SUMMARY_SYSTEM = `You are a NIST 800-53 Rev 5 control analyst. You will receive one or more cybersecurity documents uploaded by a business undergoing a CPPA §7123 cybersecurity audit. Your job is to produce a structured plain-language summary of what the documents say about each relevant NIST 800-53 control family.

Output a JSON object with this exact shape:
{
  "controlFamilySummaries": {
    "AC": "What the documents say about access control...",
    "AT": "...awareness and training...",
    "AU": "...audit and accountability...",
    "CA": "...assessment, authorization, monitoring...",
    "CM": "...configuration management...",
    "CP": "...contingency planning...",
    "IA": "...identification and authentication...",
    "IR": "...incident response...",
    "MP": "...media protection...",
    "PE": "...physical and environmental protection...",
    "PL": "...planning...",
    "PM": "...program management...",
    "PT": "...PII processing and transparency...",
    "RA": "...risk assessment...",
    "SA": "...system and services acquisition...",
    "SC": "...system and communications protection...",
    "SI": "...system and information integrity...",
    "SR": "...supply chain risk management..."
  },
  "documentCoverage": { "<document_name>": ["AC", "IA", "SC"] },
  "overallReadabilityAssessment": "Brief note on document quality and completeness"
}

Each control family summary should be 2-5 sentences drawn directly from the document content. If a control family is not addressed in any document, set its value to null. Do not invent or assume anything not in the documents. Respond with ONLY the JSON object.`;

const AUTOFILL_SYSTEM = `You are a CPPA §7123 cybersecurity audit assistant. You have been given a NIST 800-53 control summary derived from a business's uploaded cybersecurity documents. Your job is to attempt to answer each question in the CPPA audit question bank based ONLY on the evidence present in the document summary.

RULES:
1. Only answer Yes, Partial, No, or N/A. Do not invent evidence not present in the summary.
2. "Partial" means the documents show some but not complete implementation of the control.
3. "N/A" means the question clearly does not apply based on what the documents reveal.
4. If you do not have sufficient evidence to answer confidently, set suggestedAnswer to null and confidence to "insufficient". Do NOT guess.
5. "high" = clear, specific evidence directly addresses the question. "medium" = indirect/partial evidence. "low" = very thin inference. "insufficient" = no relevant evidence.
6. needsReview must be true for any answer that is not high confidence, and for ALL Critical-risk questions regardless of confidence.
7. sourceDocuments must list only the document filenames that contained the relevant evidence.
8. reasoning must be <= 300 characters and explain specifically what in the documents supports the answer (cite the section/control). Not vague.
9. For conditional questions: only attempt to answer if the parent question's answer triggers the branch; otherwise set suggestedAnswer null.
10. Do not be optimistic. A policy that is "being developed" or "planned" is a No, not a Yes.

Output a JSON array, one object per question, in the given order:
[{ "questionId": "Q-01", "suggestedAnswer": "Yes"|"Partial"|"No"|"N/A"|null, "confidence": "high"|"medium"|"low"|"insufficient", "reasoning": "<=300 chars", "sourceDocuments": ["SSP.pdf"], "needsReview": true|false }]
Respond with ONLY the JSON array.`;

const READABILITY_SYSTEM = `You are a cybersecurity document triage assistant. For each uploaded document, assess:
- "readability": one of "Clear", "Dense", "Poor"
- "relevance": estimated relevance to a CPPA §7123 cybersecurity audit, one of "High", "Medium", "Low"
- "nistFamilies": array of NIST 800-53 family codes that appear covered (e.g. ["AC","IA","SC"])
Output ONLY a JSON array: [{ "name": "<document_name>", "readability": "...", "relevance": "...", "nistFamilies": [...] }]`;

// ── Content builders ─────────────────────────────────────────────────────────

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

function buildDocumentBlocks(documents: PipelineDocument[]): Block[] {
  const blocks: Block[] = [{ type: 'text', text: 'The uploaded cybersecurity documents follow.' }];
  for (const d of documents) {
    blocks.push({ type: 'text', text: `\n\n--- BEGIN DOCUMENT: ${d.name} ---\n` });
    if (d.image) {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: d.image.mediaType, data: d.image.base64 } });
    } else {
      blocks.push({ type: 'text', text: d.text ?? '(no extractable text)' });
    }
    blocks.push({ type: 'text', text: `\n--- END DOCUMENT ---` });
  }
  return blocks;
}

function buildQuestionList(questions: QuestionForAutofill[]): string {
  return questions
    .map(
      q =>
        `[${q.id}] (Component ${q.componentNumber} — ${q.componentTitle}; risk: ${q.riskWeight}; answerType: ${q.answerType}; ` +
        `NIST CSF: ${q.nistCsf ?? 'n/a'}; 800-53: ${q.nist80053 ?? 'n/a'}) ${q.questionText}`
    )
    .join('\n');
}

// ── Mock generators ──────────────────────────────────────────────────────────

const NIST_FAMILY_CODES = ['AC', 'AT', 'AU', 'CA', 'CM', 'CP', 'IA', 'IR', 'MP', 'PE', 'PL', 'PM', 'PT', 'RA', 'SA', 'SC', 'SI', 'SR'];

function mockNistSummary(documents: PipelineDocument[]): NistSummary {
  const controlFamilySummaries: Record<string, string | null> = {};
  for (const code of NIST_FAMILY_CODES) {
    controlFamilySummaries[code] = `[MOCK] Placeholder summary for the ${code} control family. Set ANTHROPIC_API_KEY and unset STORAGE_MODE=mock to run a real analysis.`;
  }
  const documentCoverage: Record<string, string[]> = {};
  for (const d of documents) documentCoverage[d.name] = ['AC', 'IA', 'SC'];
  return {
    controlFamilySummaries,
    documentCoverage,
    overallReadabilityAssessment: '[MOCK] Document analysis is running in mock mode — no AI was called.',
  };
}

function mockResults(questions: QuestionForAutofill[]): AutofillResult[] {
  return questions.map(q => ({
    questionId: q.id,
    suggestedAnswer: null,
    confidence: 'insufficient' as Confidence,
    reasoning: '[MOCK] No AI analysis was performed (mock mode). Please answer manually.',
    sourceDocuments: [],
    needsReview: true,
  }));
}

function mockReadability(documents: PipelineDocument[]): ReadabilityResult[] {
  // Offline heuristic so the readability gate is functional without an API key:
  // very short or obviously-irrelevant files are flagged Poor/Low.
  return documents.map(d => {
    const len = d.text?.length ?? 0;
    const irrelevant = /(resume|cv|invoice|receipt|menu|photo|screenshot|untitled)/i.test(d.name);
    const readability: ReadabilityResult['readability'] = d.image
      ? 'Dense'
      : len < 200 ? 'Poor' : len < 1000 ? 'Dense' : 'Clear';
    const relevance: ReadabilityResult['relevance'] = irrelevant || len < 200 ? 'Low' : 'Medium';
    return { name: d.name, readability, relevance, nistFamilies: ['AC', 'IA', 'SC'] };
  });
}

// ── Public pipeline functions ────────────────────────────────────────────────

export async function runReadabilityPrecheck(documents: PipelineDocument[]): Promise<ReadabilityResult[]> {
  if (await isMock()) return mockReadability(documents);

  const client = await getAnthropic();
  const model = await getEffectiveAnthropicModel();
  const msg = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS_READABILITY,
    system: READABILITY_SYSTEM,
    messages: [{ role: 'user', content: buildDocumentBlocks(documents) as unknown as MessageContent }],
  });
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
  const parsed = parseJson<ReadabilityResult[]>(text, 'readability');
  return Array.isArray(parsed) ? parsed : mockReadability(documents);
}

export async function runAutofillPipeline(
  documents: PipelineDocument[],
  questions: QuestionForAutofill[]
): Promise<PipelineResult> {
  if (await isMock()) {
    return { nistSummary: mockNistSummary(documents), results: mockResults(questions) };
  }

  const client = await getAnthropic();
  const model = await getEffectiveAnthropicModel();

  // ── Call 1 — NIST 800-53 summary ──────────────────────────────────────────
  const summaryMsg = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS_SUMMARY,
    system: SUMMARY_SYSTEM,
    messages: [{ role: 'user', content: buildDocumentBlocks(documents) as unknown as MessageContent }],
  });
  const summaryText = summaryMsg.content[0]?.type === 'text' ? summaryMsg.content[0].text : '';
  const nistSummary = parseJson<NistSummary>(summaryText, 'NIST summary');

  // ── Call 2 — per-question autofill ────────────────────────────────────────
  const autofillUser =
    `NIST 800-53 control summary (derived from the uploaded documents):\n\n` +
    `${JSON.stringify(nistSummary, null, 2)}\n\n` +
    `Here is the complete question bank. Answer each question based ONLY on the control summary above:\n\n` +
    `${buildQuestionList(questions)}`;

  const autofillMsg = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS_AUTOFILL,
    system: AUTOFILL_SYSTEM,
    messages: [{ role: 'user', content: autofillUser }],
  });
  const autofillText = autofillMsg.content[0]?.type === 'text' ? autofillMsg.content[0].text : '';
  const rawResults = parseJson<Record<string, unknown>[]>(autofillText, 'autofill');

  const results = normalizeResults(rawResults, questions);
  return { nistSummary, results };
}

/**
 * Normalize + enforce invariants on the model's per-question output:
 *  - map answers to our tokens and constrain to the question's answer type
 *  - open_text / choice questions can't be auto-answered → null + needsReview
 *  - needsReview is forced true unless high-confidence AND not Critical-risk
 *  - guarantee one result per question (questions the model dropped become insufficient)
 */
export function normalizeResults(
  raw: Record<string, unknown>[],
  questions: QuestionForAutofill[]
): AutofillResult[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of Array.isArray(raw) ? raw : []) {
    const id = typeof r?.questionId === 'string' ? r.questionId : null;
    if (id) byId.set(id, r);
  }

  return questions.map(q => {
    const r = byId.get(q.id);
    const autoFillable = SCORED_TYPES.has(q.answerType);

    if (!r || !autoFillable) {
      return {
        questionId: q.id,
        suggestedAnswer: null,
        confidence: 'insufficient' as Confidence,
        reasoning: r && typeof r.reasoning === 'string'
          ? String(r.reasoning).slice(0, 300)
          : (autoFillable ? 'No answer returned for this question.' : 'This question requires manual judgment and was not auto-filled.'),
        sourceDocuments: [],
        needsReview: true,
      };
    }

    const suggestedAnswer = normalizeAnswer(r.suggestedAnswer, q.answerType);
    const confidence = suggestedAnswer === null ? 'insufficient' : normalizeConfidence(r.confidence);
    const sourceDocuments = Array.isArray(r.sourceDocuments)
      ? (r.sourceDocuments.filter(s => typeof s === 'string') as string[])
      : [];
    const reasoning = typeof r.reasoning === 'string' ? r.reasoning.slice(0, 300) : '';
    // Enforce rule 6: not-high OR Critical-risk OR null → needs review.
    const needsReview = confidence !== 'high' || suggestedAnswer === null || q.riskWeight === 'critical';

    return { questionId: q.id, suggestedAnswer, confidence, reasoning, sourceDocuments, needsReview };
  });
}
