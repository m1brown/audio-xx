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

import { transition, INITIAL_CONV_STATE } from '../conversation-state';

/**
 * ROUTING BOUNDARY (Wave 2 battery, 2026-08-29). Production answered
 * "What about a Leben CS600 instead of the Butler?" as an ISOLATED product
 * inquiry: detectIntent reads the product name (product_assessment, a
 * strong intent outside system_assessment's compatible set), and the
 * intent-mismatch reset at the top of transition() destroyed the
 * assessment context before the ready_to_assess case could accumulate.
 * Every later turn in the conversation then cascaded into the wrong lane.
 * A substitution proposal is a question about the ACTIVE system.
 */
describe('substitution turns stay in the assessment conversation', () => {
  const T1 = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
  const ready = {
    mode: 'system_assessment', stage: 'ready_to_assess',
    facts: { ...INITIAL_CONV_STATE.facts, hasSystem: true, systemAssessmentText: T1, systemComponents: [T1] },
  } as never as Parameters<typeof transition>[0];

  const CASES = [
    ['What about a Leben CS600 instead of the Butler?', 'product_assessment'],
    ['What about a Hegel H590 instead?', 'product_assessment'],
    ['Would swapping the Butler for solid state be worse?', 'product_assessment'],
  ] as const;
  for (const [q, intent] of CASES) {
    it(`"${q}" (${intent}) accumulates instead of resetting`, () => {
      const tr = transition(ready, q, { hasSystem: true, subjectCount: 1, detectedIntent: intent });
      expect(tr.state.mode).toBe('system_assessment');
      expect(tr.state.stage).toBe('ready_to_assess');
      expect(tr.response?.kind).toBe('proceed');
    });
  }

  it('a genuinely new-topic opinion question still leaves the mode', () => {
    const tr = transition(ready, 'What do you think of Goldmund amps?', {
      hasSystem: true, subjectCount: 1, detectedIntent: 'product_assessment',
    });
    expect(tr.state.mode).not.toBe('system_assessment');
  });
});

describe('chained counterfactuals collapse to the original incumbent', () => {
  const T1 = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
  const runSeq = (...turns: string[]) => {
    const M = [T1, ...turns].join(TURN_SEPARATOR);
    return buildSystemAssessment(M, extractSubjectMatches(M), null as never, []) as never as {
      kind: string;
      findings?: { systemChain?: { names?: string[] }; statedSubstitution?: { incumbent: string; candidate: string } };
      components?: Array<{ displayName: string }>;
    };
  };
  const chain = (r: ReturnType<typeof runSeq>) =>
    ((r.components ?? []).map((c) => c.displayName).join('|'))
    + '|' + (r.findings?.systemChain?.names ?? []).join('|');

  it('trailing bare "instead" swaps against the unique same-role peer', () => {
    const r = runSeq('What about a Hegel H590 instead?');
    expect(chain(r)).not.toContain('Butler');
    expect(r.findings?.statedSubstitution?.incumbent).toBe('Butler Monads');
  });

  it('second counterfactual frames against the ORIGINAL occupant, not the prior hypothesis', () => {
    const r = runSeq('What about a Leben CS600 instead of the Butler?', 'What about a Hegel H590 instead?');
    expect(chain(r)).not.toContain('Butler');
    expect(chain(r)).not.toContain('Leben');
    expect(r.findings?.statedSubstitution?.incumbent).toBe('Butler Monads');
  });
});

describe('multi-turn counterfactual state — keep and revert', () => {
  const T1 = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
  const NATHAN_SEQ = [
    'What about a Leben CS600 instead of the Butler?',
    'Would I lose bass control?',
    'What about a Hegel H590 instead?',
    'Which of the three would you choose?',
  ];
  const runSeq2 = (...turns: string[]) => {
    const M = [T1, ...turns].join(TURN_SEPARATOR);
    return buildSystemAssessment(M, extractSubjectMatches(M), null as never, []) as never as {
      kind: string;
      findings?: { statedSubstitution?: { incumbent: string; candidate: string } | null };
      components?: Array<{ displayName: string }>;
      clarification?: { question?: string };
    };
  };
  const comps = (r: ReturnType<typeof runSeq2>) =>
    (r.components ?? []).map((c) => c.displayName).join('|');

  it('"Keep the Butler" cancels the whole amplifier hypothesis chain', () => {
    const r = runSeq2(...NATHAN_SEQ, 'Keep the Butler. What would you change next?');
    expect(r.kind).not.toBe('clarification');
    expect(comps(r)).toContain('Butler Monads');
    expect(comps(r)).not.toContain('Leben');
    expect(comps(r)).not.toContain('Hegel');
    expect(r.findings?.statedSubstitution ?? null).toBeNull();
  });

  it('"go back to the original system" restores the original, no counterfactual frame', () => {
    const r = runSeq2(...NATHAN_SEQ,
      'Keep the Butler. What would you change next?',
      'What speakers would make sense?',
      'Actually, go back to the original system.');
    expect(r.kind).not.toBe('clarification');
    expect(comps(r)).toContain('Butler Monads');
    expect(comps(r)).not.toContain('Hegel');
    expect(r.findings?.statedSubstitution ?? null).toBeNull();
  });

  it('"keep the speakers and change the amp" with no swap in play is a no-op, not a clarification', () => {
    const r = runSeq2('keep the speakers and change the amp');
    expect(r.kind).not.toBe('clarification');
    expect(comps(r)).toContain('Butler Monads');
    expect(comps(r)).toContain('Acora QRC-2');
  });
});

describe('judgment questions do not leave the assessment for shopping', () => {
  const readyG = {
    mode: 'system_assessment', stage: 'ready_to_assess',
    facts: {
      ...INITIAL_CONV_STATE.facts, hasSystem: true,
      systemAssessmentText: 'Assess my system: Chord DAVE DAC running directly into a Benchmark AHB2 power amplifier, KEF LS50 Meta speakers',
      systemComponents: ['Assess my system: Chord DAVE DAC…'],
    },
  } as never as Parameters<typeof transition>[0];

  it('"Should I add a preamp?" stays in assessment', () => {
    const tr = transition(readyG, 'Should I add a preamp?', { hasSystem: true, subjectCount: 0, detectedIntent: 'audio_knowledge' });
    expect(tr.state.mode).toBe('system_assessment');
    expect(tr.response?.kind).toBe('proceed');
  });

  it('explicit purchase phrasing still goes to shopping', () => {
    const tr = transition(readyG, 'what would you buy?', { hasSystem: true, subjectCount: 0, detectedIntent: 'audio_knowledge' });
    expect(tr.state.mode).toBe('shopping');
  });

  it('declarative buy intent still goes to shopping', () => {
    const tr = transition(readyG, 'I want to get a new amplifier', { hasSystem: true, subjectCount: 0, detectedIntent: 'shopping' });
    expect(tr.state.mode).toBe('shopping');
  });
});

import { isReviewDirectedFollowUp } from '../assessment-followup';

describe('the early review-anchored net yields to counterfactual turns', () => {
  for (const q of [
    'Keep the Butler. What would you change next?',
    'What about a Hegel H590 instead?',
    'Actually, go back to the original system.',
  ]) {
    it(`"${q}" is NOT intercepted`, () => {
      expect(isReviewDirectedFollowUp(q)).toBe(false);
    });
  }
  it('a plain direction question still is intercepted', () => {
    expect(isReviewDirectedFollowUp('What would you change first?')).toBe(true);
  });
});
