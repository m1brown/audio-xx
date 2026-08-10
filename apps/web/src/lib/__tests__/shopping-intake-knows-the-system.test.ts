import { describe, it, expect } from 'vitest';
import { transition, type ConvState } from '../conversation-state';

/**
 * Never ask about an existing system the advisor already knows.
 *
 * Verified on production (f468079): a user whose three-component system had
 * been assessed, echoed, and check-marked earlier in the same conversation
 * answered the intake's "which component?" question with "the dac" — and was
 * asked "What's your budget? And do you have an existing system these need
 * to work with?" The caller passes context.hasSystem for exactly this;
 * the clarify_category → clarify_budget transition ignored it.
 */

const AWAITING_CATEGORY: ConvState = {
  mode: 'shopping',
  stage: 'clarify_category',
  facts: {},
};

function budgetQuestion(hasSystem: boolean): string {
  const r = transition(AWAITING_CATEGORY, 'the dac', {
    hasSystem,
    subjectCount: 0,
  });
  expect(r.response?.kind).toBe('question');
  return (r.response as { question: string }).question;
}

describe('shopping intake and the known system', () => {
  it('does not ask about an existing system when one is known', () => {
    const q = budgetQuestion(true);
    expect(q).toMatch(/budget/i);
    expect(q).not.toMatch(/existing system/i);
  });

  it('still asks when no system is known', () => {
    // A cold shopper genuinely may or may not have a system — the question
    // is right there, and must stay.
    const q = budgetQuestion(false);
    expect(q).toMatch(/existing system/i);
  });
});
