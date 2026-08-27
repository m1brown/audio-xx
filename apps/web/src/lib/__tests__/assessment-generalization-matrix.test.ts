import { describe, it, expect } from 'vitest';
import { buildSystemAssessment } from '../consultation';
import { extractSubjectMatches, detectIntent } from '../intent';
import { buildTurnContext } from '../turn-context';
import { normalizeRole } from '../assessment/authoritative';
import { factCompatibleWithRole } from '../evidence/product-dossier';

/**
 * ASSESSMENT GENERALIZATION MATRIX (P0, 2026-08-26).
 *
 * The Eversolo/JOB/WLM production assessment rendered a loudspeaker as
 * AMPLIFIER and a streamer's power draw as amplifier output, while the Nathan
 * control stayed perfect — rich curation was masking a general failure. This
 * matrix runs ordinary, poorly-catalogued and fictional systems through the
 * same door as the curated ones and holds every one of them to the same
 * structural invariants:
 *
 *   - the chain's names and roles are projections of ONE surviving list;
 *   - a component whose own descriptor says loudspeaker is never an amplifier;
 *   - a fact licenses only reasoning compatible with its typed predicate AND
 *     the physical role of the component it belongs to.
 */

const EMPTY_STATE = {
  savedSystems: [], activeSystemRef: null, draftSystem: null, proposedSystem: null,
} as never;

/** The same door production uses: turn-context resolves the active system. */
const assess = (msg: string, activeSystem?: unknown) => {
  const resolved = activeSystem !== undefined
    ? activeSystem
    : (buildTurnContext(msg, EMPTY_STATE, new Set(), null as never) as never as {
      activeSystem: unknown }).activeSystem;
  const { desires } = detectIntent(msg) as never as { desires: unknown };
  return (buildSystemAssessment(
    msg, extractSubjectMatches(msg), resolved as never, desires as never) ?? {}) as never as {
    kind: string;
    findings?: { systemChain?: { names: string[]; roles: string[] } };
  };
};

const chainOf = (msg: string, activeSystem: unknown = null) => {
  const r = assess(msg, activeSystem);
  const chain = r.findings?.systemChain;
  expect(chain, `no systemChain for: ${msg}`).toBeTruthy();
  return chain as { names: string[]; roles: string[] };
};

/** The invariant every real system must satisfy. */
const expectAligned = (chain: { names: string[]; roles: string[] }) => {
  expect(chain.roles.length).toBe(chain.names.length);
};

describe('1 · Nathan — rich curated control', () => {
  const MSG = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
  it('four components, every role true to its physical identity', () => {
    // Nathan resolves through the evidence lane: low_confidence with typed
    // components, the shape page.tsx builds the review from.
    const r = assess(MSG) as never as {
      kind: string; components?: Array<{ displayName: string; role: string }> };
    expect(r.kind).toBe('low_confidence');
    const comps = r.components ?? [];
    expect(comps).toHaveLength(4);
    const roleOf = (re: RegExp) =>
      normalizeRole(comps.find((c) => re.test(c.displayName))?.role);
    expect(roleOf(/acora/i)).toBe('speaker');
    expect(['amplifier', 'integrated']).toContain(roleOf(/butler/i));
    expect(roleOf(/arc/i)).toBe('preamplifier');
  });
});

describe('2 · Eversolo/JOB/WLM — the exact production failure case', () => {
  const MSG = 'assess my system: Eversolo DMP-A6 streamer/dac --> JOB Job integrated amp --> WLM Diva monitor speakers';
  it('exactly three components — the parser invents no phantom equipment', () => {
    const chain = chainOf(MSG);
    expectAligned(chain);
    expect(chain.names).toHaveLength(3);
  });
  it('the WLM Diva monitor is a loudspeaker, never an amplifier', () => {
    const chain = chainOf(MSG);
    const wlm = chain.names.findIndex((n) => /wlm|diva/i.test(n));
    expect(wlm).toBeGreaterThanOrEqual(0);
    expect(normalizeRole(chain.roles[wlm])).toBe('speaker');
  });
  it('the same holds when a saved system is active and this is a NEW chain', () => {
    const ctx = buildTurnContext(MSG, {
      savedSystems: [{ id: 's1', name: 'Test system', components: [
        { brand: 'dCS', name: 'Rossini Apex', category: 'dac' },
        { brand: 'ARC', name: 'ref', category: 'preamplifier' },
        { brand: 'Butler', name: 'Monads', category: 'amplifier' },
        { brand: 'Acora', name: 'QRC-2', category: 'speaker' },
      ] }],
      activeSystemRef: { kind: 'saved', id: 's1' },
      draftSystem: null, proposedSystem: null,
    } as never, new Set(), null as never) as never as {
      systemSource: string; activeSystem: { components: unknown[] } | null };
    expect(ctx.systemSource).toBe('inline');
    expect(ctx.activeSystem?.components).toHaveLength(3);
    const chain = chainOf(MSG, ctx.activeSystem);
    expectAligned(chain);
    const wlm = chain.names.findIndex((n) => /wlm|diva/i.test(n));
    expect(normalizeRole(chain.roles[wlm])).toBe('speaker');
  });
});

describe('3 · Leben/DeVore — sideways rich-evidence control', () => {
  const MSG = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - leben cs600 integrated amplifier - Speakers: devore o/96';
  it('three components aligned; the O/96 is a loudspeaker', () => {
    const chain = chainOf(MSG);
    expectAligned(chain);
    expect(chain.names).toHaveLength(3);
    const devore = chain.names.findIndex((n) => /devore|o\/96/i.test(n));
    expect(normalizeRole(chain.roles[devore])).toBe('speaker');
  });
});

describe('4 · untouched catalog system — no special-case enrichment', () => {
  const MSG = 'assess my system: Rega Elex-R integrated amp, Magnepan LRS speakers';
  it('aligned, and each role matches the listener\'s own descriptor', () => {
    // Shape-agnostic: this system may resolve through the catalog lane
    // (findings.systemChain) or the evidence lane (typed components),
    // depending on what the store holds. The invariants bind both.
    const r = assess(MSG) as never as {
      kind: string;
      components?: Array<{ displayName: string; role: string }>;
      findings?: { systemChain?: { names: string[]; roles: string[] } };
    };
    const pairs = r.findings?.systemChain
      ? r.findings.systemChain.names.map((n, i) => ({
        name: n, role: r.findings!.systemChain!.roles[i] }))
      : (r.components ?? []).map((c) => ({ name: c.displayName, role: c.role }));
    expect(pairs.length).toBe(2);
    const roleOf = (re: RegExp) => normalizeRole(pairs.find((p) => re.test(p.name))?.role);
    expect(['amplifier', 'integrated']).toContain(roleOf(/rega|elex/i));
    expect(roleOf(/magnepan|lrs/i)).toBe('speaker');
  });
});

describe('5 · poorly catalogued system — labels only', () => {
  const MSG = 'assess my system - Amp: Fezz Titania - Speakers: Pylon Ruby 25';
  it('never yields more roles than names', () => {
    const r = assess(MSG);
    const chain = r.findings?.systemChain;
    if (chain) expectAligned(chain);
  });
});

describe('6 · fictional system — must not corrupt, may clarify', () => {
  const MSG = 'assess my system: Zorblax ZX1 dac, Quibblewock Q2 amp, Fnord F3 speakers';
  it('whatever survives is aligned; nothing crashes', () => {
    const r = assess(MSG);
    const chain = r.findings?.systemChain;
    if (chain) expectAligned(chain);
  });
});

describe('7 · saved systems through the Assess action (chip restatement)', () => {
  const SAVED_A = { id: 'a', name: 'A', components: [
    { brand: 'dCS', name: 'Rossini Apex', category: 'dac' },
    { brand: 'ARC', name: 'ref', category: 'preamplifier' },
    { brand: 'Butler', name: 'Monads', category: 'amplifier' },
    { brand: 'Acora', name: 'QRC-2', category: 'speaker' },
  ] };
  const SAVED_B = { id: 'b', name: 'B', components: [
    { brand: 'Leben', name: 'CS600', category: 'integrated' },
    { brand: 'DeVore', name: 'Orangutan O/96', category: 'speaker' },
  ] };
  const chipFor = (sys: typeof SAVED_A) =>
    `Assess my system: ${sys.components.map((c) => `${c.brand} ${c.name}`).join(', ')}`;
  it.each([[SAVED_A], [SAVED_B]])('the chip resolves to the saved record, all components', (sys) => {
    const ctx = buildTurnContext(chipFor(sys), {
      savedSystems: [sys], activeSystemRef: { kind: 'saved', id: sys.id },
      draftSystem: null, proposedSystem: null,
    } as never, new Set(), null as never) as never as {
      systemSource: string; activeSystem: { components: unknown[] } | null };
    expect(ctx.systemSource).toBe('saved');
    expect(ctx.activeSystem?.components).toHaveLength(sys.components.length);
  });
});

describe('8 · saved record with stale shared categories — role is authoritative', () => {
  /*
   * The production shape that manufactured a duplicate-role clarification
   * for a correctly saved system: the save endpoint reuses shared Component
   * rows by brand+name, so the ARC preamplifier carried category
   * 'amplifier' and the Acora loudspeaker category 'other' — while the
   * listener's actual statement lived in the link's role. Role outranks
   * category; a correctly saved system must never be asked to explain
   * equipment it already described.
   */
  const STALE = {
    id: 'p', name: 'Prod-shaped',
    components: [
      { brand: 'dCS', name: 'Rossini Apex', category: 'dac', role: null },
      { brand: 'ARC', name: 'ref', category: 'amplifier', role: 'preamp' },
      { brand: 'Butler', name: 'Monads', category: 'amplifier', role: 'power_amp' },
      { brand: 'Acora', name: 'QRC-2', category: 'other', role: 'speaker' },
    ],
  };
  it('the chip yields an assessment, not a duplicate-role question', () => {
    const msg = 'Assess my system: dCS Rossini Apex, ARC ref, Butler Monads, Acora QRC-2';
    const ctx = buildTurnContext(msg, {
      savedSystems: [STALE], activeSystemRef: { kind: 'saved', id: 'p' },
      draftSystem: null, proposedSystem: null,
    } as never, new Set(), null as never) as never as {
      systemSource: string; activeSystem: unknown };
    expect(ctx.systemSource).toBe('saved');
    const r = assess(msg, ctx.activeSystem) as never as {
      kind: string;
      clarification?: { question?: string };
      components?: Array<{ displayName: string; role: string }>;
    };
    expect(r.clarification?.question ?? '').not.toMatch(/both appear as/i);
    const comps = r.components ?? [];
    if (comps.length) {
      const roleOf = (re: RegExp) =>
        normalizeRole(comps.find((c) => re.test(c.displayName))?.role);
      expect(roleOf(/arc/i)).toBe('preamplifier');
      expect(roleOf(/acora/i)).toBe('speaker');
    }
  });
});

describe('9 · natural restatement — assessment verb on an owned list', () => {
  it('"Assess my <four products>" is a system assessment, not a gear inquiry', () => {
    // Nathan beta: this exact phrasing routed to gear_inquiry and rendered
    // exploratory boilerplate, because every assess-pattern required the
    // word "system". The verb + possessive-on-named-products + a list is
    // the same request in the listener's own words.
    const r = detectIntent('Assess my dCS Rossini Apex, ARC Ref 5, Butler Monads and Acora QRC-2') as never as { intent: string };
    expect(r.intent).toBe('system_assessment');
  });
  it('single-product and comparison phrasings keep their lanes', () => {
    expect((detectIntent('assess the JOB integrated') as never as { intent: string }).intent)
      .not.toBe('system_assessment');
    expect((detectIntent('What do you think of the dCS Rossini vs Chord Dave?') as never as { intent: string }).intent)
      .toBe('comparison');
  });
});

describe('universal invariant — a fact licenses only role-compatible reasoning', () => {
  it('amplifier power is never a predicate on a non-amplifier', () => {
    for (const role of ['streamer', 'dac', 'streamer_dac', 'preamplifier', 'speaker', 'turntable', undefined]) {
      expect(factCompatibleWithRole('power_output', role)).toBe(false);
    }
    for (const role of ['amplifier', 'integrated']) {
      expect(factCompatibleWithRole('power_output', role)).toBe(true);
    }
  });
  it('loudspeaker-load predicates never attach to non-speakers', () => {
    for (const field of ['sensitivity', 'impedance', 'power_handling', 'driver_complement']) {
      for (const role of ['amplifier', 'integrated', 'dac', 'streamer', 'preamplifier', undefined]) {
        expect(factCompatibleWithRole(field, role)).toBe(false);
      }
      expect(factCompatibleWithRole(field, 'speaker')).toBe(true);
    }
  });
  it('an unknown role is not a usable one — typed fields fail closed', () => {
    expect(factCompatibleWithRole('power_output', undefined)).toBe(false);
    expect(factCompatibleWithRole('sensitivity', '')).toBe(false);
  });
  it('untyped fields still render anywhere', () => {
    for (const field of ['frequency_response', 'dimensions', 'weight', 'tube_complement', 'inputs']) {
      expect(factCompatibleWithRole(field, 'streamer')).toBe(true);
    }
  });
});
