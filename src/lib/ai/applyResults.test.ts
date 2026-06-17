import { describe, it, expect } from 'vitest';
import { selectApplicableAnswers, type AutofillResultRow } from './applyResults';

const types = new Map<string, string>([
  ['Q-01', 'yes_partial_no_na'],
  ['Q-02', 'yes_no'],
  ['Q-03', 'yes_no_na'],
  ['Q-04', 'open_text'],
  ['Q-05', 'choice'],
]);

const r = (o: Partial<AutofillResultRow> & { questionId: string }): AutofillResultRow => ({
  suggestedAnswer: null, confidence: null, reasoning: null, needsReview: false, ...o,
});

describe('selectApplicableAnswers', () => {
  it('applies a valid suggestion with its metadata', () => {
    const out = selectApplicableAnswers([r({ questionId: 'Q-01', suggestedAnswer: 'yes', confidence: 'high', reasoning: 'found in SSP' })], types);
    expect(out).toEqual([{ questionId: 'Q-01', response: 'yes', aiConfidence: 'high', aiReasoning: 'found in SSP', needsClientReview: false }]);
  });

  it('skips null / no-evidence suggestions', () => {
    expect(selectApplicableAnswers([r({ questionId: 'Q-01', suggestedAnswer: null })], types)).toHaveLength(0);
  });

  it('skips suggestions invalid for the answer type', () => {
    // 'partial' is not allowed for a yes_no question
    expect(selectApplicableAnswers([r({ questionId: 'Q-02', suggestedAnswer: 'partial' })], types)).toHaveLength(0);
  });

  it('does not auto-answer open_text or choice questions', () => {
    const out = selectApplicableAnswers([
      r({ questionId: 'Q-04', suggestedAnswer: 'yes' }),
      r({ questionId: 'Q-05', suggestedAnswer: 'yes' }),
    ], types);
    expect(out).toHaveLength(0);
  });

  it('flags low-confidence answers for client review but still applies them', () => {
    const out = selectApplicableAnswers([r({ questionId: 'Q-03', suggestedAnswer: 'no', confidence: 'low', needsReview: true })], types);
    expect(out[0]).toMatchObject({ questionId: 'Q-03', response: 'no', needsClientReview: true });
  });

  it('skips unknown questions', () => {
    expect(selectApplicableAnswers([r({ questionId: 'Q-99', suggestedAnswer: 'yes' })], types)).toHaveLength(0);
  });
});
