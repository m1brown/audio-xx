/**
 * Migration 1 — pins.
 *
 * §1: the two experimentally validated B2 rules are PRODUCTION reasoning
 * rules, single-sourced (the QA arms derive from the same constants, so
 * experiment and product cannot drift).
 * §6: the publication boundary is real — a failed or incomplete check never
 * silently counts as passed.
 */
import { describe, it, expect } from 'vitest';
import {
  REASONING_RULES, REASONING_RULES_CORE, QUIET_GOVERNANCE_RULE, BOUNDED_KNOWLEDGE_RULE,
} from '../governed-context';
import { computeValidationStatus, type ClaimViolation } from '../claim-validation';

describe('§1 — the B2 contract is production behavior', () => {
  it('REASONING_RULES = core + quiet governance + bounded knowledge', () => {
    expect(REASONING_RULES).toContain(REASONING_RULES_CORE);
    expect(REASONING_RULES).toContain(QUIET_GOVERNANCE_RULE);
    expect(REASONING_RULES).toContain(BOUNDED_KNOWLEDGE_RULE);
  });

  it('quiet governance silences the narration, not the discipline', () => {
    expect(QUIET_GOVERNANCE_RULE).toMatch(/SILENTLY/);
    expect(QUIET_GOVERNANCE_RULE).toMatch(/plain adviser language/);
  });

  it('bounded knowledge keeps four kinds of ground and forbids manufacture', () => {
    for (const req of [
      'never be presented as kinds 1–3'.replace('never be presented', 'never be presented'),
      'exact numerical specifications',
      'exact load ratings',
      'exact feature availability',
      'attribute any claim to a publication or source',
    ]) {
      expect(BOUNDED_KNOWLEDGE_RULE).toContain(req);
    }
  });
});

describe('§6 — publication status', () => {
  const v = (partial: Partial<ClaimViolation>): ClaimViolation => ({
    type: 'unsupported_character', sentence: 'The X sounds warm.', rewrite: 'weakened', ...partial,
  });

  it('clean check → CHECKED', () => {
    expect(computeValidationStatus({
      answer: 'Fine answer.', violations: [], repaired: 0, unchecked: false,
    })).toBe('CHECKED');
  });

  it('all violations repaired (sentence gone from text) → REPAIRED', () => {
    expect(computeValidationStatus({
      answer: 'Weakened text without the offending sentence.',
      violations: [v({})], repaired: 1, unchecked: false,
    })).toBe('REPAIRED');
  });

  it('checker failure → INCOMPLETE, never silently passed', () => {
    expect(computeValidationStatus({
      answer: 'Draft passed through.', violations: [], repaired: 0, unchecked: true,
    })).toBe('INCOMPLETE');
  });

  it('a consequential violation surviving in the text → REJECTED', () => {
    expect(computeValidationStatus({
      answer: 'It delivers 45W into 6 ohms as rated.',
      violations: [v({ type: 'mutated_spec', sentence: 'It delivers 45W into 6 ohms as rated.' })],
      repaired: 0, unchecked: false,
    })).toBe('REJECTED');
  });

  it('an unrepairable sentence (rewrite null) surviving → REJECTED', () => {
    expect(computeValidationStatus({
      answer: 'The X sounds warm.',
      violations: [v({ rewrite: null })], repaired: 0, unchecked: false,
    })).toBe('REJECTED');
  });

  it('DELETION IS NOT A REPAIR: rewrite-null finding with the sentence removed → REJECTED', () => {
    // The live blank-recommendation failure: the sentence was deleted, the
    // amputated answer counted as REPAIRED, and the listener saw
    // "Amplifier: —". A deletion-required finding never publishes.
    expect(computeValidationStatus({
      answer: 'Category list with a hole where the product name was.',
      violations: [v({ rewrite: null, sentence: 'Consider the Hegel H190.' })],
      repaired: 1, unchecked: false,
    })).toBe('REJECTED');
  });

  it('mixed findings: one rewrite applied + one deletion-required → still REJECTED', () => {
    expect(computeValidationStatus({
      answer: 'Weakened text without either offending sentence.',
      violations: [v({}), v({ rewrite: null, sentence: 'The Y is measured to be warm.' })],
      repaired: 2, unchecked: false,
    })).toBe('REJECTED');
  });

  it('a non-consequential violation left unrepaired → INCOMPLETE (not publishable)', () => {
    expect(computeValidationStatus({
      answer: 'The X sounds warm.',
      violations: [v({})], repaired: 0, unchecked: false,
    })).toBe('INCOMPLETE');
  });

  it('markdown-emphasis tolerance: repaired bold sentence counts as repaired', () => {
    expect(computeValidationStatus({
      answer: 'Clean text now.',
      violations: [v({ sentence: '**The X sounds warm.**' })], repaired: 1, unchecked: false,
    })).toBe('REPAIRED');
  });
});
