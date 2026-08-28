import { describe, it, expect } from 'vitest';
import { buildSystemAssessment } from '../consultation';
import { extractSubjectMatches, detectIntent } from '../intent';
import { TURN_SEPARATOR } from '../labelled-components';

/**
 * THE 4/4-RECOGNISED CLARIFICATION — the internally impossible document.
 *
 * Production displayed four ticked RECOGNISED components and then asked
 * "One component in what you wrote I couldn't match to a specific model".
 * The two halves counted different things: `expected` was a union over every
 * ACCUMULATED turn's input segments, `resolved` was the current graph — so a
 * prior-turn prose mention that failed to collapse into a resolved identity
 * ("the amp is a Butler Monad" beside "Butler Monads": 'monad' and 'monads'
 * are different tokens) manufactured a phantom missing component.
 *
 * The invariant, both directions (founder, 2026-08-26):
 *   IF every physical component in the request has a resolved identity,
 *   no unresolved-component clarification may fire; AND a genuinely
 *   unmatched segment still fires one.
 */

const FAIL_STRING = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. '
  + '- Preamp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
const saved = [
  { brand: 'dCS', name: 'Rossini Apex', category: 'dac' },
  { brand: 'ARC', name: 'ref', category: 'preamplifier' },
  { brand: 'Butler', name: 'Monads', category: 'amplifier' },
  { brand: 'Acora', name: 'QRC-2', category: 'speaker' },
];

const run = (raw: string, withSaved = true) => {
  const { desires } = detectIntent(raw) as never as { desires: unknown };
  return buildSystemAssessment(raw, extractSubjectMatches(raw),
    withSaved ? ({ name: 'Test system', components: saved } as never) : null as never,
    desires as never) as never as {
    kind?: string;
    components?: Array<{ displayName: string }>;
    clarification?: { question?: string };
  };
};

describe('the exact production Fail string', () => {
  it('assesses all four components signed-in', () => {
    const r = run(FAIL_STRING);
    expect(r.kind).not.toBe('clarification');
    expect(r.components).toHaveLength(4);
  });

  it('assesses signed-out too', () => {
    const r = run(FAIL_STRING, false);
    expect(r.kind).not.toBe('clarification');
    expect(r.components).toHaveLength(4);
  });
});

describe('prior-turn residue cannot manufacture a missing component', () => {
  it('a prose mention of a resolved box is not a fifth component', () => {
    // The reproduction: singular prose mention + the full labelled message.
    const r = run(`the amp is a Butler Monad${TURN_SEPARATOR}${FAIL_STRING}`);
    expect(r.kind).not.toBe('clarification');
    expect(r.components).toHaveLength(4);
  });

  it('a restated saved-system turn is not extra components', () => {
    const r = run(
      `My system: dCS Rossini Apex, ARC ref, Butler Monads, Acora QRC-2.${TURN_SEPARATOR}${FAIL_STRING}`);
    expect(r.kind).not.toBe('clarification');
    expect(r.components).toHaveLength(4);
  });
});

describe('legitimate clarifications still fire', () => {
  it('a genuinely unmatched extra component still asks', () => {
    const r = run(`I also run a Zorblax ZX-1 streamer${TURN_SEPARATOR}${FAIL_STRING}`);
    // Either an explicit clarification or a graph that carries the unknown —
    // what may NOT happen is the unknown silently vanishing while the reply
    // claims completeness.
    if (r.kind !== 'clarification') {
      const names = (r.components ?? []).map((c) => c.displayName.toLowerCase());
      expect(names.some((n) => n.includes('zorblax'))).toBe(true);
    } else {
      expect(r.clarification?.question ?? '').toMatch(/couldn't match|couldn’t match|Zorblax/i);
    }
  });

  it('a real role conflict across turns still asks', () => {
    // Two different amplifiers genuinely present — this clarification is
    // CORRECT and must not be suppressed by the phantom fix.
    const r = run(
      'Assess my system: - Dac/Streamer: dCS Rossini Apex. - leben cs600 integrated amplifier - Speakers: devore o/96'
      + TURN_SEPARATOR + FAIL_STRING);
    expect(r.kind).toBe('clarification');
    expect(r.clarification?.question ?? '').toMatch(/both appear as amplifiers/i);
  });
});
describe('questions accumulated into the system text are not components', () => {
  it('the direction question does not manufacture a missing component', () => {
    // Production, Nathan beta: "What would you change first?" after the
    // assessment re-ran with the prior question in the accumulated text and
    // rendered 4/4 RECOGNISED plus "one component I couldn't match".
    const MSG = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. '
      + '- Amps: Butler Monads. - Speakers: Acora QRC-2.'
      + TURN_SEPARATOR + 'Do you think the Butler is holding the system back?'
      + TURN_SEPARATOR + 'What would you change first?';
    const { desires } = detectIntent(MSG) as never as { desires: unknown };
    const r = buildSystemAssessment(MSG, extractSubjectMatches(MSG), null as never, desires as never) as never as {
      kind: string; clarification?: { question?: string } };
    expect(r.kind).not.toBe('clarification');
  });
});

