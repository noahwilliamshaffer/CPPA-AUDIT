/**
 * Pure helper: decide which AI autofill results become saved answers.
 *
 * After document analysis the suggestions are written straight into the
 * `answers` table (no separate review stage) — every answer remains editable on
 * the normal question pages and is flagged aiGenerated. Only results with a
 * concrete suggested answer that's valid for the question's answer type are
 * applied; null/insufficient suggestions and open_text/choice types (which the
 * pipeline does not auto-answer) are left blank for manual entry.
 */

export interface AutofillResultRow {
  questionId: string;
  suggestedAnswer: string | null;
  confidence: string | null;
  reasoning: string | null;
  needsReview?: boolean;
}

export interface ApplicableAnswer {
  questionId: string;
  response: string;
  aiConfidence: string | null;
  aiReasoning: string | null;
  needsClientReview: boolean;
}

const STANDARD_OPTIONS: Record<string, string[]> = {
  yes_partial_no_na: ['yes', 'partial', 'no', 'not_applicable'],
  yes_no: ['yes', 'no'],
  yes_no_na: ['yes', 'no', 'not_applicable'],
};

export function selectApplicableAnswers(
  results: AutofillResultRow[],
  answerTypeById: Map<string, string>
): ApplicableAnswer[] {
  const out: ApplicableAnswer[] = [];
  for (const r of results) {
    if (!r || !r.suggestedAnswer) continue;
    const answerType = answerTypeById.get(r.questionId);
    if (!answerType) continue; // unknown / inactive question
    // The pipeline only emits yes/partial/no/not_applicable; skip open_text & choice.
    const allowed = STANDARD_OPTIONS[answerType];
    if (!allowed || !allowed.includes(r.suggestedAnswer)) continue;
    out.push({
      questionId: r.questionId,
      response: r.suggestedAnswer,
      aiConfidence: r.confidence ?? null,
      aiReasoning: r.reasoning ?? null,
      needsClientReview: !!r.needsReview,
    });
  }
  return out;
}
