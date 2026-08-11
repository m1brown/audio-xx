import { describe, it, expect } from 'vitest';
import { isComparisonFollowUp } from '../intent';
import { transition } from '../conversation-state';
import type { ConvState } from '../conversation-state';

/**
 * D3 (production hardening, 2026-08-11) — trade-off follow-ups during an
 * active comparison must not be consumed as comparison intake.
 *
 * Live repro (dev, post-D1/D2 tree):
 *   "harbeth p3esr vs kef ls50 meta" → honest asymmetric comparison (good)
 *   "what am I giving up with the harbeth?"
 *     → "Got it — one down. What do you want to compare it against?"
 * The machine treated a trade-off question about the ESTABLISHED pair as
 * naming the first item of a NEW comparison — forgetting the active pair
 * and misreading a consequence question as intake.
 *
 * Encoded rule: during an active comparison, a question ABOUT the
 * comparison (trade-offs, downsides, why, are-you-sure) is a follow-up
 * to answer, never a comparand to collect.
 */

const PAIR = {
  left: { name: 'harbeth', kind: 'brand' as const },
  right: { name: 'kef', kind: 'brand' as const },
};

describe('isComparisonFollowUp — trade-off and challenge phrasings', () => {
  const FOLLOWUPS = [
    'what am I giving up with the harbeth?',
    'what would I be giving up?',
    'what do I lose going that way?',
    'any downsides?',
    "what's the trade-off?",
    'why that one?',
    'are you sure?',
  ];
  for (const q of FOLLOWUPS) {
    it(`"${q}" is a follow-up to the active pair`, () => {
      expect(isComparisonFollowUp(q, PAIR)).toBe(true);
    });
  }

  it('control: naming a third product is a topic change, not a follow-up', () => {
    expect(isComparisonFollowUp('what about the devore o/96?', PAIR)).toBe(false);
  });
});

describe('comparison mode does not eat trade-off questions as comparands', () => {
  const comparing: ConvState = {
    mode: 'comparison',
    stage: 'ready_to_compare',
    facts: { comparisonTargets: ['detected', 'detected'] },
  };

  it('"what am I giving up with the harbeth?" proceeds (subject is on the pair)', () => {
    const r = transition(comparing, 'what am I giving up with the harbeth?', {
      hasSystem: false,
      subjectCount: 1,
    });
    expect(r.response?.kind).toBe('proceed');
  });

  it('"any downsides?" proceeds with zero subjects', () => {
    const r = transition(comparing, 'any downsides?', {
      hasSystem: false,
      subjectCount: 0,
    });
    expect(r.response?.kind).toBe('proceed');
  });

  it('control: a bare component name is still collected as a comparand', () => {
    const gathering: ConvState = {
      mode: 'comparison',
      stage: 'clarify_targets',
      facts: {},
    };
    const r = transition(gathering, 'the hegel h390', {
      hasSystem: false,
      subjectCount: 1,
    });
    expect(r.response?.kind).toBe('question');
  });
});
