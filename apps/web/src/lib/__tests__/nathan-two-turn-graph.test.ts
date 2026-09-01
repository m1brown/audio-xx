import { describe, it, expect } from 'vitest';
import { extractSubjectMatches, detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';
import { parseLabelledComponents, truncateAtListBoundary } from '../labelled-components';
import { detectSystemDescription } from '../system-extraction';

/**
 * PERMANENT REGRESSION — the two-turn system-graph defect (2026-08-24).
 *
 * A listener described one four-component system twice, and Audio XX refused
 * to assess it both times, differently:
 *
 *   Turn 1 (numbered list)  → "Butler Monads" appeared twice.
 *   Turn 2 (bulleted list)  → three dCS Rossini Apex entries in the dac role,
 *                             while the Review & save card beneath showed the
 *                             correct four.
 *
 * ROOT CAUSE — one thing, in two places. A component's name was sliced out of
 * the raw message and the NEXT list item's marker came with it:
 *
 *   "3. Dac/Streamer: dCS Rossini Apex 4. Speakers:"  →  "dCS Rossini Apex 4"
 *   "- Dac/Streamer: dCS Rossini Apex - Speakers:"    →  "dCS Rossini Apex -"
 *
 * So the SAME physical unit acquired a DIFFERENT name string depending on
 * whether the listener numbered or bulleted their list — and identity was
 * compared as a string. Turn 1's parse, Turn 2's parse and the canonical form
 * were three names for one DAC, and all three survived into the signal path.
 *
 * That the duplicated product CHANGED between turns is the tell: nothing about
 * Butler or dCS was involved. Formatting was.
 */

const TURN_1 = 'Assess my system: 1. Pre-amp: ARC ref 5 2. Amps: Butler Monads 3. Dac/Streamer: dCS Rossini Apex 4. Speakers: Acora QRC-2';
const TURN_2 = 'Assess my system: - Pre-amp: ARC ref 5 - Amps: Butler Monads - Dac/Streamer: dCS Rossini Apex - Speakers: Acora QRC-2';
/** The formatting that always worked, kept as the control. */
const TURN_PLAIN = 'Assess my system: Pre-amp: ARC ref 5 Amps: Butler Monads Dac/Streamer: dCS Rossini Apex Speakers: Acora QRC-2';

const NATHAN = ['dCS Rossini Apex', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assess = (q: string, active: any = null): any => {
  const subs = extractSubjectMatches(q);
  const { desires } = detectIntent(q) as unknown as { desires: unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buildSystemAssessment(q, subs, active, desires as any);
};

/** Promote a turn's parse to the active context, as a save card in flight does. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asActiveSystem = (q: string): any => {
  const proposed = detectSystemDescription(q, extractSubjectMatches(q), {} as never);
  return proposed && {
    name: 'Nathan',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    components: proposed.components.map((c: any) => ({
      name: c.name, brand: c.brand, category: c.category ?? 'dac', role: c.role ?? c.category ?? 'dac',
    })),
    tendencies: null, location: null, primaryUse: null,
  };
};

describe('the founder two-turn sequence', () => {
  for (const [label, turn] of [['numbered', TURN_1], ['bulleted', TURN_2], ['plain', TURN_PLAIN]] as const) {
    it(`${label}: the physical graph is exactly the four components, once each`, () => {
      const r = assess(turn);
      expect(r?.kind).not.toBe('clarification');
      const names = (r?.components ?? []).map((c: { displayName: string }) => c.displayName);
      expect([...names].sort()).toEqual([...NATHAN].sort());
    });
  }

  it('turn 2 after turn 1 — prior-turn state does not add a component', () => {
    // The exact failure: Turn 1's parse becomes context for Turn 2, and the
    // two parses disagreed about the DAC's name.
    const r = assess(TURN_2, asActiveSystem(TURN_1));
    expect(r?.kind).not.toBe('clarification');
    const names = (r?.components ?? []).map((c: { displayName: string }) => c.displayName);
    expect([...names].sort()).toEqual([...NATHAN].sort());
  });

  it('no dac-role component is ever listed more than once', () => {
    for (const turn of [TURN_1, TURN_2]) {
      const r = assess(turn, asActiveSystem(TURN_1));
      const dacs = (r?.components ?? []).filter(
        (c: { role: string }) => c.role === 'dac' || c.role === 'streamer',
      );
      expect(dacs).toHaveLength(1);
      expect(dacs[0].displayName).toBe('dCS Rossini Apex');
    }
  });

  it('every turn formatting produces the SAME graph — typography is not identity', () => {
    const graphs = [TURN_1, TURN_2, TURN_PLAIN].map((t) =>
      (assess(t)?.components ?? [])
        .map((c: { displayName: string; role: string }) => `${c.displayName}:${c.role}`)
        .sort().join('|'),
    );
    expect(new Set(graphs).size).toBe(1);
  });

  it('a saved system that is NOT the typed one contributes nothing', () => {
    const r = assess(TURN_2, {
      name: 'FRANCE',
      components: [
        { name: 'DMP-A6', brand: 'Eversolo', category: 'dac', role: 'dac' },
        { name: 'INTegrated', brand: 'JOB', category: 'integrated', role: 'amplifier' },
        { name: 'Diva Monitor', brand: 'WLM', category: 'speaker', role: 'speaker' },
      ], tendencies: null, location: null, primaryUse: null,
    });
    const names = (r?.components ?? []).map((c: { displayName: string }) => c.displayName);
    expect([...names].sort()).toEqual([...NATHAN].sort());
  });
});

describe('list markers are structure, never part of a name', () => {
  it('the label parser stops at the next list item', () => {
    const byRole = (q: string) => Object.fromEntries(
      parseLabelledComponents(q).map((l) => [l.roles[0], l.rawName]),
    );
    for (const q of [TURN_1, TURN_2, TURN_PLAIN]) {
      expect(byRole(q)).toMatchObject({
        preamplifier: 'ARC ref 5',
        amplifier: 'Butler Monads',
        dac: 'dCS Rossini Apex',
        speaker: 'Acora QRC-2',
      });
    }
  });

  it('truncates numbered, bulleted and middot markers alike', () => {
    expect(truncateAtListBoundary(' dCS Rossini Apex 4. ')).toBe(' dCS Rossini Apex');
    expect(truncateAtListBoundary(' dCS Rossini Apex - ')).toBe(' dCS Rossini Apex');
    expect(truncateAtListBoundary(' dCS Rossini Apex · ')).toBe(' dCS Rossini Apex');
    expect(truncateAtListBoundary(' dCS Rossini Apex 2) ')).toBe(' dCS Rossini Apex');
  });

  it('never truncates a model number that belongs to the product', () => {
    // The marker must be a LIST marker, not any trailing digit.
    expect(truncateAtListBoundary(' Audio Research Reference 5')).toBe(' Audio Research Reference 5');
    expect(truncateAtListBoundary(' Leben CS600')).toBe(' Leben CS600');
    expect(truncateAtListBoundary(' Acora QRC-2')).toBe(' Acora QRC-2');
    expect(truncateAtListBoundary(' Chord Hugo TT2')).toBe(' Chord Hugo TT2');
    expect(truncateAtListBoundary(' Magnepan LRS+')).toBe(' Magnepan LRS+');
  });
});

describe('NEGATIVE CONTROLS — genuinely multiple components stay multiple', () => {
  /**
   * The physical graph, wherever this result kind exposes it. A completed
   * assessment reports `findings.componentNames`; the pre-assessment kinds
   * carry `components`. Both are the same graph.
   */
  const graph = (q: string) => {
    const r = assess(q);
    if (r?.kind === 'clarification') return { clarified: true, q: r.clarification.question as string };
    const names: string[] = r?.components
      ? r.components.map((c: { displayName: string }) => c.displayName)
      : (r?.findings?.componentNames ?? []);
    return { clarified: false, names };
  };

  it('two genuinely active DACs still raise a clarification, naming both', () => {
    const g = graph('Assess my system: DAC: Chord Qutest DAC: Denafrips Ares II Amp: Rega Elex-R Speakers: KEF LS50 Meta');
    expect(g.clarified).toBe(true);
    expect(g.q).toContain('Chord Qutest');
    expect(g.q).toContain('Denafrips Ares II');
    // ...and NOT a third, phantom entry echoing one of them.
    expect(g.q).not.toMatch(/Denafrips[,\s]+(?:and\s+)?Denafrips/);
  });

  it('monoblocks are one amplifier record, not two', () => {
    const g = graph(TURN_PLAIN);
    expect(g.clarified).toBe(false);
    expect(g.names!.filter((n: string) => n === 'Butler Monads')).toHaveLength(1);
  });

  it('a preamp beside an integrated keeps both', () => {
    // Two amplification records that are genuinely two boxes. Collapsing is by
    // shared source span or bare-brand echo, and neither applies here.
    const g = graph('Assess my system: Pre-amp: ARC ref 5 Integrated: Leben CS600 Speakers: KEF LS50 Meta');
    expect(g.clarified).toBe(false);
    expect(g.names).toHaveLength(3);
    expect(g.names).toContain('ARC ref 5');
    // The integrated survives as its own node. NOTE: it is reported as
    // "Leben CS600X" — the catalog product lookup prefix-matches a typed
    // "CS600" onto the CS600X. That is a wrong-IDENTITY defect of the same
    // family, one layer up, and is deliberately NOT in scope here: this pass
    // is about a component COUNT that grows. Asserted loosely so this test
    // pins the count invariant and does not silently bless the substitution.
    expect(g.names!.some((n: string) => /leben/i.test(n))).toBe(true);
  });

  it('a bare brand beside its own cataloged model is ONE component', () => {
    // "Denafrips Ares II" yields a brand match and a product match over the
    // same words. Two records, one box.
    const g = graph('Assess my system: DAC: Denafrips Ares II Amp: Rega Elex-R Speakers: KEF LS50 Meta');
    expect(g.clarified).toBe(false);
    expect(g.names!.filter((n: string) => /denafrips/i.test(n))).toHaveLength(1);
  });

  it('two bare brands with no model still ask for the models', () => {
    // Regression for the repair itself: collapsing representations must not
    // silence the case where the MODEL was never resolved. A multi-word brand
    // ("Wilson audio") is still a bare brand.
    const g = graph('Assess my system: dCS Vivaldi, Boulder 866, Wilson Audio Sasha DAW');
    expect(g.clarified).toBe(true);
    expect(g.q).toMatch(/exact make and model/i);
  });
});

/**
 * STRUCTURAL SWEEP — the mechanism, not the products.
 *
 * The defect class is: N physical components become N+1 because two evidence
 * records for one box are treated as two boxes. It is invisible to
 * product-specific tests, because which product duplicates depends on the
 * listener's typography, not on the product.
 *
 * So the sweep is over FORMATTINGS and CONTEXTS of the same systems, asserting
 * the count is stable. A new brand or model is covered by construction.
 */
describe('structural sweep — one system, many ways of writing it', () => {
  const SYSTEMS: Array<[string, string[], number]> = [
    ['nathan', ['Pre-amp: ARC ref 5', 'Amps: Butler Monads', 'Dac/Streamer: dCS Rossini Apex', 'Speakers: Acora QRC-2'], 4],
    ['catalogued', ['DAC: Chord Qutest', 'Amp: Rega Elex-R', 'Speakers: KEF LS50 Meta'], 3],
    ['brand+model', ['DAC: Denafrips Ares II', 'Amp: Rega Elex-R', 'Speakers: KEF LS50 Meta'], 3],
    ['mixed known/unknown', ['DAC: Chord Qutest', 'Amps: Butler Monads', 'Speakers: Acora QRC-2'], 3],
  ];

  /** The ways a listener actually writes a list. */
  const FORMATS: Array<[string, (items: string[]) => string]> = [
    ['plain', (i) => `Assess my system: ${i.join(' ')}`],
    ['numbered', (i) => `Assess my system: ${i.map((x, n) => `${n + 1}. ${x}`).join(' ')}`],
    ['bulleted', (i) => `Assess my system: ${i.map((x) => `- ${x}`).join(' ')}`],
    ['middot', (i) => `Assess my system: ${i.join(' · ')}`],
    ['parenthesised', (i) => `Assess my system: ${i.map((x, n) => `${n + 1}) ${x}`).join(' ')}`],
    ['newline', (i) => `Assess my system:\n${i.join('\n')}`],
  ];

  const countOf = (q: string): number | 'clarified' => {
    const r = assess(q);
    if (r?.kind === 'clarification') return 'clarified';
    return (r?.components?.length ?? r?.findings?.componentNames?.length ?? 0);
  };

  for (const [sysName, items, expected] of SYSTEMS) {
    it(`${sysName}: every formatting yields exactly ${expected} components`, () => {
      const results = FORMATS.map(([fmt, build]) => [fmt, countOf(build(items))] as const);
      const wrong = results.filter(([, n]) => n !== expected);
      expect(wrong, `formattings that changed the graph: ${JSON.stringify(wrong)}`).toEqual([]);
    });
  }

  it('prior-turn context never grows the graph, whatever the formatting', () => {
    const items = ['Pre-amp: ARC ref 5', 'Amps: Butler Monads', 'Dac/Streamer: dCS Rossini Apex', 'Speakers: Acora QRC-2'];
    for (const [, buildA] of FORMATS) {
      for (const [, buildB] of FORMATS) {
        const active = asActiveSystem(buildA(items));
        const r = assess(buildB(items), active);
        const n = r?.components?.length ?? r?.findings?.componentNames?.length ?? 0;
        expect(r?.kind, `${buildA(items)} → ${buildB(items)}`).not.toBe('clarification');
        expect(n).toBe(4);
      }
    }
  });
});
