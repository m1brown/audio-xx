import { describe, it, expect } from 'vitest';
import { isConsultationFollowUp } from '../intent';
import type { SubjectMatch } from '../intent';

/**
 * D5 (production hardening, 2026-08-11) — pronoun fit questions bind to
 * the product under discussion; owned gear after "my" is context.
 *
 * Live repro:
 *   "thoughts on the leben cs600?" → CS600 product card
 *   "would it work with my harbeth p3esr?"
 *     → PRODUCT ASSESSMENT of the *P3ESR* ("No system context available —
 *        tell me about your amplifier"), with the pronoun's referent (the
 *        CS600) dropped entirely and the user's owned speaker treated as
 *        the candidate product.
 *
 * Cause: isConsultationFollowUp's new-subject gate read "my harbeth
 * p3esr" as a topic change. But a pronoun-fit question ("would IT work
 * with MY x?") names the active subject via the pronoun; subjects after
 * an ownership marker are the user's system context, exactly what
 * buildConsultationFollowUp grounds fit answers in.
 *
 * Encoded rule: in a pronoun-fit question, subjects preceded by an
 * ownership marker are context, never a topic change.
 */

const ACTIVE = {
  subjects: [{ name: 'leben cs600', kind: 'product' } as SubjectMatch],
  originalQuery: 'thoughts on the leben cs600?',
};

describe('pronoun fit questions are consultation follow-ups', () => {
  const FOLLOWUPS = [
    'would it work with my harbeth p3esr?',
    'will it pair with my kef r3?',
    'does it fit with my harbeth p3esr and my small room?',
    'how would it sound with my p3esr?',
    'can it drive my harbeth p3esr?',
  ];
  for (const q of FOLLOWUPS) {
    it(`"${q}" stays with the active subject`, () => {
      expect(isConsultationFollowUp(q, ACTIVE)).toBe(true);
    });
  }
});

describe('genuine topic changes still break out', () => {
  it('naming a new product without ownership is a topic change', () => {
    expect(isConsultationFollowUp('what about the hegel h390?', ACTIVE)).toBe(false);
  });

  it('a fresh assessment request about other gear is a topic change', () => {
    expect(isConsultationFollowUp('thoughts on the chord qutest?', ACTIVE)).toBe(false);
  });
});
