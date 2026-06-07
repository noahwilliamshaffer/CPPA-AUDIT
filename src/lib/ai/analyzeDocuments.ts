/**
 * analyzeDocuments — calls Claude to analyze uploaded cybersecurity documents
 * and answer all 40 §7123(c) compliance questions.
 *
 * Single API call covers:
 *   1. Document readability scoring (0–100) with plain-language notes
 *   2. NIST 800-53 control family mapping per document
 *   3. Plain-language simplified summary per document
 *   4. Answer all 40 audit questions with confidence ratings
 *
 * Dynamically imported to avoid Windows Node.js 20 build-time crypto crashes.
 */

export interface DocumentInput {
  id: string;
  fileName: string;
  extractedText: string;
}

export interface QuestionInput {
  id: string;
  componentNumber: number;
  questionText: string;
  nistCsfMapping: string | null;
  cisControlMapping: string | null;
}

export interface DocumentAnalysis {
  documentId: string;
  readabilityScore: number;        // 0–100
  readabilityNotes: string;        // 1-3 sentences on clarity, jargon, completeness
  simplifiedSummary: string;       // Plain-language explanation mapped to NIST 800-53
  nistControlsCovered: string[];   // e.g. ['AC', 'AU', 'IA', 'SC']
}

export interface QuestionAnalysis {
  questionId: string;
  response: 'yes' | 'partial' | 'no' | 'not_applicable';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;               // 1-2 sentences citing evidence from docs
  needsClientReview: boolean;      // true when confidence is low or evidence is ambiguous
}

export interface AnalysisResult {
  documents: DocumentAnalysis[];
  questions: QuestionAnalysis[];
}

const NIST_800_53_FAMILIES = [
  'AC - Access Control',
  'AT - Awareness and Training',
  'AU - Audit and Accountability',
  'CA - Assessment, Authorization, and Monitoring',
  'CM - Configuration Management',
  'CP - Contingency Planning',
  'IA - Identification and Authentication',
  'IR - Incident Response',
  'MA - Maintenance',
  'MP - Media Protection',
  'PE - Physical and Environmental Protection',
  'PL - Planning',
  'PM - Program Management',
  'PS - Personnel Security',
  'PT - PII Processing and Transparency',
  'RA - Risk Assessment',
  'SA - System and Services Acquisition',
  'SC - System and Communications Protection',
  'SI - System and Information Integrity',
  'SR - Supply Chain Risk Management',
];

export async function analyzeDocuments(
  documents: DocumentInput[],
  questions: QuestionInput[]
): Promise<AnalysisResult> {
  const { Anthropic } = await import('@anthropic-ai/sdk');

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // ── Build the prompt ────────────────────────────────────────────────────────

  const documentSection = documents
    .map(
      (d, i) =>
        `### Document ${i + 1}: ${d.fileName}\nDocument ID: ${d.id}\n\n${d.extractedText}`
    )
    .join('\n\n---\n\n');

  const questionsSection = questions
    .map(
      (q, i) =>
        `Q${i + 1}. [ID: ${q.id}] [Component ${q.componentNumber}] ${q.questionText}` +
        (q.nistCsfMapping ? ` (NIST CSF: ${q.nistCsfMapping})` : '')
    )
    .join('\n');

  const systemPrompt = `You are a senior cybersecurity auditor reviewing client policy and procedure documents for CCPA compliance under Cal. Code Regs. §7123(c).

Your task is to analyze the provided documents and:
1. Assess the readability of each document (score 0-100 where 100 = crystal clear, 0 = completely unreadable)
2. Map each document to the NIST SP 800-53 control families it covers (use 2-letter codes: AC, AT, AU, CA, CM, CP, IA, IR, MA, MP, PE, PL, PM, PS, PT, RA, SA, SC, SI, SR)
3. Write a plain-language summary of each document's cybersecurity posture mapped to those NIST families
4. Answer all audit questions based ONLY on what is explicitly stated or clearly implied in the documents

CONFIDENCE LEVELS:
- "high": Document explicitly addresses the question with clear evidence
- "medium": Document partially addresses it or implies compliance without explicit detail
- "low": Little or no relevant information found, or contradictory information

Set needsClientReview to true when:
- confidence is "low"
- Evidence is ambiguous or contradictory
- The question cannot be reliably answered from the documents alone

For NIST 800-53 control families covered, list only families where there is meaningful content in the document. The available families are:
${NIST_800_53_FAMILIES.join(', ')}

Respond ONLY with a valid JSON object matching this exact schema (no markdown, no explanation, just JSON):
{
  "documents": [
    {
      "documentId": "<exact document ID from input>",
      "readabilityScore": <0-100>,
      "readabilityNotes": "<1-3 sentences on clarity, technical jargon level, and completeness>",
      "simplifiedSummary": "<3-5 sentences explaining in plain language what cybersecurity controls this document establishes, mapped to NIST 800-53 families>",
      "nistControlsCovered": ["<2-letter code>", ...]
    }
  ],
  "questions": [
    {
      "questionId": "<exact question ID from input>",
      "response": "<yes|partial|no|not_applicable>",
      "confidence": "<high|medium|low>",
      "reasoning": "<1-2 sentences citing specific evidence from the documents, or explaining what is missing>",
      "needsClientReview": <true|false>
    }
  ]
}`;

  const userMessage = `## CLIENT DOCUMENTS\n\n${documentSection}\n\n## COMPLIANCE QUESTIONS TO ANSWER\n\n${questionsSection}`;

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  // ── Parse response ──────────────────────────────────────────────────────────

  const raw = message.content[0];
  if (raw.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Strip markdown fences if present
  const cleaned = raw.text
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim();

  let result: AnalysisResult;
  try {
    result = JSON.parse(cleaned) as AnalysisResult;
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${cleaned.slice(0, 200)}`);
  }

  // Validate structure
  if (!Array.isArray(result.documents) || !Array.isArray(result.questions)) {
    throw new Error('Claude response missing documents or questions array');
  }

  return result;
}
