import { describe, it, expect } from 'vitest';
import { synthesiseChain } from '../artifact/sonic-synthesis';
import { composeSystemReviewDetailed } from '../artifact/system-review';

/**
 * SUBSTITUTION LOCALITY (Wave 2, 2026-08-29).
 *
 * Changing one component must not change unrelated conclusions. The same
 * chain with only the amplifier slot swapped must yield byte-identical
 * character propositions for every unchanged component, and the review's
 * component-observation prose for unchanged components must not drift.
 * Only relationships that TOUCH the swapped slot may differ.
 */

const BASE = [
  { displayName: 'dCS Rossini Apex', role: 'dac' },
  { displayName: 'ARC ref 5', role: 'preamplifier' },
  { displayName: 'Butler Monads', role: 'amplifier' },
  { displayName: 'Acora QRC-2', role: 'speaker' },
];
const SWAP = BASE.map((c) => c.role === 'amplifier'
  ? { displayName: 'Leben CS600', role: 'amplifier' } : c);

describe('substitution locality — one slot, one delta', () => {
  const s1 = synthesiseChain(BASE);
  const s2 = synthesiseChain(SWAP);

  it('unchanged components keep byte-identical character propositions', () => {
    for (const name of ['dCS Rossini Apex', 'ARC ref 5', 'Acora QRC-2']) {
      expect(JSON.stringify(s2.character.get(name) ?? null),
        `${name} propositions must not drift when only the amplifier changes`)
        .toBe(JSON.stringify(s1.character.get(name) ?? null));
    }
  });

  it('the swapped slot actually carries its own character', () => {
    expect(JSON.stringify(s2.character.get('Leben CS600') ?? []))
      .not.toBe(JSON.stringify(s1.character.get('Butler Monads') ?? []));
  });

  it('review prose about unchanged components does not drift', () => {
    const r1 = composeSystemReviewDetailed({ components: BASE, synthesis: s1, dossiers: [] });
    const r2 = composeSystemReviewDetailed({ components: SWAP, synthesis: s2, dossiers: [] });
    // Paragraphs that mention ONLY unchanged components (never either
    // amplifier) must appear in both compositions unchanged.
    const touchesAmp = (p: string) => /butler|monad|leben|cs600|amplifier|amp\b/i.test(p);
    const stable1 = r1.paragraphs.filter((p) => !touchesAmp(p));
    for (const p of stable1) {
      expect(r2.paragraphs, `stable paragraph must survive the swap: "${p.slice(0, 60)}…"`)
        .toContain(p);
    }
  });
});


import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment } from '../consultation';
import { TURN_SEPARATOR } from '../labelled-components';

describe('stated substitution is a counterfactual, never a duplicate-role question', () => {
  const T1 = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
  const run = (t2: string) => {
    const M = T1 + TURN_SEPARATOR + t2;
    return buildSystemAssessment(M, extractSubjectMatches(M), null as never,
      (detectIntent(M) as never as { desires: never }).desires) as never as {
      kind: string;
      components?: Array<{ displayName: string }>;
      findings?: { systemChain?: { names?: string[] } };
      clarification?: { question?: string };
    };
  };
  const names = (r: ReturnType<typeof run>) =>
    ((r.components ?? []).map((c) => c.displayName).join('|'))
    + '|' + (r.findings?.systemChain?.names ?? []).join('|');

  it('"X instead of the Butler" swaps the amplifier slot', () => {
    const r = run('What about a Leben CS600 instead of the Butler?');
    expect(r.kind).not.toBe('clarification');
    expect(names(r)).toContain('Leben CS600');
    expect(names(r)).not.toContain('Butler');
  });

  it('"replace the Butler with X" swaps the slot', () => {
    const r = run('What if I replace the Butler with a Hegel H590?');
    expect(r.kind).not.toBe('clarification');
    expect(names(r)).not.toContain('Butler');
  });

  it('genuine dual ownership still keeps both and does not delete', () => {
    const r = run('I run both Leben CS600 and Butler Monads amplifiers');
    expect(names(r)).toContain('Butler');
    expect(names(r)).toContain('Leben CS600');
  });

  it('substitution phrasing across DIFFERENT roles never silently deletes', () => {
    const r = run('What about a Chord DAVE instead of the Butler?');
    // DAC candidate vs amplifier incumbent: roles differ. The engine may
    // ASK about the confused request (here: the dual-DAC question) — what
    // it may never do is silently drop the Butler and assess.
    if (r.kind !== 'clarification') {
      expect(names(r)).toContain('Butler');
    } else {
      expect(r.clarification?.question ?? '').toBeTruthy();
    }
  });
});
