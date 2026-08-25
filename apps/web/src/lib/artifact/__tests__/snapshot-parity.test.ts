import { describe, it, expect, vi } from 'vitest';
import {
  ASSESSMENT_SCHEMA_V1, snapshotFromCanonical, snapshotFromProvisional,
  freezeSnapshot, parseSnapshot,
} from '../snapshot';
import { runArtifactPipeline } from '@/product/assessment-pipeline';

/**
 * The snapshot -> artifact semantic-parity boundary.
 *
 * ACCEPTANCE (founder, 2026-08-22): take the exact assessment visible in the
 * conversation, create its snapshot, open the artifact, and compare the
 * listener-visible semantic state. No reasoning function may execute between
 * those two states.
 */

const CREATED = '2026-08-22T10:00:00.000Z';
const meta = { engineVersion: 'test', createdAt: CREATED };

// ── Control 3: Nathan — the provisional path, captured from PRODUCTION ──
// Reproduced verbatim from the 22 August production run. Nathan cannot be
// generated in a unit test (his path calls corroboration, evidence reads and
// the model), and that is exactly why the snapshot must carry the result.
const NATHAN_CONVERSATION = {
  subject: 'dCS Rossini Apex, ARC ref 5, Butler Monads, Acora QRC-2',
  systemSignature:
    'Published figures put the Butler Monads at 200 watts into 4 ohms, which is the '
    + "load the Acora QRC-2 presents, so output at the relevant load is established. The "
    + "Acora QRC-2's sensitivity is not published, so the evidence held is not sufficient "
    + "to estimate this system's acoustic headroom reliably. The evidence establishes one "
    + "compatibility finding in this chain, and leaves the Acora QRC-2's sensitivity unresolved.",
  philosophy:
    'Audio XX does not hold enough product-specific listening evidence for most of this '
    + 'chain — ARC ref 5, Butler Monads, Acora QRC-2 — to make a defensible system-wide '
    + 'tonal judgment. What it holds for them is published specifications and verified identity.',
  tendencies: undefined,
  followUp: 'Are you running into any limit on volume or dynamic range?',
  actionVerdict: 'no_change',
  systemRelations: [{
    components: ['Butler Monads', 'Acora QRC-2'] as [string, string],
    axis: 'power_load', kind: 'reinforcement', tier: 'manufacturer',
  }],
  componentProvenance: [
    { name: 'dCS Rossini Apex', basis: 'brand' },
    { name: 'ARC ref 5', basis: 'model' },
    { name: 'Butler Monads', basis: 'model' },
    { name: 'Acora QRC-2', basis: 'model' },
  ],
};

describe('CONTROL 1 — Nathan renders at all', () => {
  const snap = snapshotFromProvisional(NATHAN_CONVERSATION, {
    ...meta,
    components: [
      { name: 'dCS Rossini Apex', role: 'dac' }, { name: 'ARC ref 5', role: 'preamplifier' },
      { name: 'Butler Monads', role: 'amplifier' }, { name: 'Acora QRC-2', role: 'speaker' },
    ],
  });

  it('produces a snapshot where the live route produced a failure page', () => {
    // Production /artifact?system=<Nathan>: "I couldn't read that as a
    // system — an assessment needs at least two named components."
    expect(snap.schema).toBe(ASSESSMENT_SCHEMA_V1);
    expect(snap.origin).toBe('provisional');
    expect(snap.components).toHaveLength(4);
  });

  it('preserves the derived quantity finding verbatim', () => {
    expect(snap.verdict).toBe(NATHAN_CONVERSATION.systemSignature);
    expect(snap.verdict).toContain('200 watts into 4 ohms');
    expect(snap.verdict).toContain('not sufficient to estimate');
  });

  it('preserves the coverage limitation and the diagnostic question', () => {
    expect(snap.sections[0].paragraphs[0]).toContain('does not hold enough product-specific');
    expect(snap.question).toBe('Are you running into any limit on volume or dynamic range?');
  });

  it('preserves the licensed relation and the per-component basis', () => {
    expect(snap.relations).toEqual([{
      components: ['Butler Monads', 'Acora QRC-2'],
      axis: 'power_load', kind: 'reinforcement', tier: 'manufacturer',
    }]);
    expect(snap.components.find((c) => c.name === 'dCS Rossini Apex')?.basis).toBe('brand');
    expect(snap.components.find((c) => c.name === 'ARC ref 5')?.basis).toBe('model');
  });

  it('invents no evidence classes it does not hold', () => {
    expect(snap.evidenceStatement).not.toMatch(/manufacturer documentation|designer statements/);
  });

  it('states the evidence it DOES hold, rather than a fixed sentence', () => {
    // The provisional path used to hardcode "Assessment based on Audio XX
    // analysis of the components as described" — true but uninformative, and
    // wrong about an assessment resting on published specifications. The
    // ledger is derived from this snapshot's own dossiers.
    expect(snap.evidenceLedger).toBeDefined();
    for (const e of snap.evidenceLedger!.entries) {
      expect(e.licensedFor.length, e.label).toBeGreaterThan(0);
      // Every scoped component is one this snapshot actually carries.
      for (const name of e.licensedFor) {
        expect(snap.componentDossiers?.some((d) => d.displayName === name), name).toBe(true);
      }
    }
  });

  it('survives a storage round trip unchanged', () => {
    expect(parseSnapshot(freezeSnapshot(snap))).toEqual(snap);
  });
});

// ── Controls 2 and 3: the catalog path ──────────────────────────────
const catalogSnapshot = (text: string) => {
  const r = runArtifactPipeline(text)!;
  expect(r).toBeTruthy();
  // `findings` travels so the licensing gate can see which relationships the
  // engine established. Without it a genuine constraint reads as "nothing
  // established" — the gate fails CLOSED, which is the safe direction but
  // discards licensed findings, so every real caller passes it too.
  return {
    cam: r.canonical,
    snap: snapshotFromCanonical(r.canonical, { ...meta, findings: (r.raw as { findings?: unknown })?.findings }),
  };
};

describe('CONTROL 2 — Leben/Cornwall may no longer publish an unlicensed essay', () => {
  /**
   * THE CONTRACT THIS TEST USED TO ENCODE IS DISPROVEN.
   *
   * It required the snapshot to carry the CAM's verdict, standfirst,
   * recognition, reading sections and tonal signature "unchanged" — parity
   * between conversation and artifact, which was the right goal against the
   * wrong reference. It made the trait/axis lane the authority.
   *
   * Production showed the cost. This exact system published "Nothing here
   * needs changing", "Leben CS600X resolves cleanly" and a two-paragraph
   * listening narrative, while Audio XX held ZERO manufacturer facts for the
   * Leben and no listening evidence for either component. Parity was perfect;
   * both surfaces were wrong together.
   *
   * Parity is still required — it is now parity with the AUTHORITATIVE
   * assessment, and both surfaces show the licensed result.
   */
  const { cam, snap } = catalogSnapshot('Assess my system: Amp: Leben CS600 Speakers: Klipsch Cornwall IV');

  it('replaces an unlicensed no-change verdict with what is actually established', () => {
    expect(snap.verdict).toMatch(/No system-level interaction is established/i);
    expect(snap.verdict).not.toMatch(/nothing here needs changing/i);
  });

  it('publishes no listening prediction', () => {
    const all = snap.sections.flatMap((x) => x.paragraphs).join(' ');
    expect(all).not.toMatch(/leading edges|image extends wide|put on something/i);
    expect(snap.sections.find((x) => x.label === 'Listening Session')).toBeUndefined();
  });

  it('publishes no axis-derived system character', () => {
    expect(snap.tonalSignature).toBeUndefined();
    expect(snap.standfirst).toBeUndefined();
    expect(snap.recognition).toBeUndefined();
    expect(snap.recommendation).toBeUndefined();
    expect(snap.operatingCondition).toBeUndefined();
  });

  it('says which figure is missing rather than "insufficient evidence"', () => {
    const review = (snap.systemReview ?? []).join(' ');
    expect(review).toMatch(/could not establish/i);
    expect(review).not.toMatch(/insufficient evidence/i);
  });

  it('keeps the evidence statement, which was never trait-authored', () => {
    expect(snap.evidenceStatement).toBe(cam.evidence.statement);
  });

  it('never renders richness the assessment did not have', () => {
    for (const s of snap.sections) expect(s.paragraphs.length).toBeGreaterThan(0);
  });
});

describe('CONTROL 3 — Magnepan preserves its constraint', () => {
  const { cam, snap } = catalogSnapshot('Assess my system: Amp: Zorblax ZX1 5 watt SET Speakers: Magnepan LRS+');

  it('leads with the constraint', () => {
    expect(snap.verdict).toMatch(/can't drive these speakers|need more power/);
    expect(snap.verdict).toBe(cam.identity.verdict);
  });

  it('keeps Recognition absent, as the constraint requires', () => {
    expect(snap.recognition).toBeUndefined();
  });

  it('keeps the Listening Session omitted', () => {
    expect(snap.sections.find((s) => s.label === 'Listening Session')).toBeUndefined();
  });

  it('keeps the recommendation the constraint licenses', () => {
    // A constraint IS an Explain-level basis, so guidance bounded by it stays.
    // This is the asymmetry that matters: the licensing gate removes trait
    // prose where nothing is established and keeps it where something is.
    expect(snap.recommendation).toBe(cam.guidance.recommendation);
  });

  it('drops the operating condition, which the constraint does NOT license', () => {
    // "Stacked warmth may reduce transient precision and spatial clarity"
    // comes from `detectStackedTraits`, which runs on component axis profiles.
    // A POWER constraint licenses guidance about power; it licenses nothing
    // tonal that happens to sit beside it. Scope is part of licensing —
    // "established" is not a single permission covering every claim on the page.
    expect(snap.operatingCondition).toBeUndefined();
  });

  it('still publishes no axis-derived tonal signature', () => {
    // A power constraint licenses guidance about power. It licenses nothing
    // about tonal character, so the graph goes regardless of the verdict.
    expect(snap.tonalSignature).toBeUndefined();
  });
});

describe('IMMUTABILITY — a snapshot is a value, not a query', () => {
  it('is fully self-contained: no input text, no re-run key', () => {
    const { snap } = catalogSnapshot('Assess my system: Amp: Leben CS600 Speakers: Klipsch Cornwall IV');
    const json = freezeSnapshot(snap);
    // The engine input must not travel with the snapshot. Carrying it is what
    // made re-derivation possible, and anything that CAN re-derive eventually does.
    expect(json).not.toContain('Assess my system');
    expect(Object.keys(snap)).not.toContain('systemText');
  });

  it('identifies its own schema version', () => {
    const { snap } = catalogSnapshot('Assess my system: Amp: Leben CS600 Speakers: Klipsch Cornwall IV');
    expect(snap.schema).toBe('axx.assessment.v1');
    expect(snap.engineVersion).toBe('test');
  });

  it('refuses a schema it cannot faithfully display', () => {
    expect(parseSnapshot('{"schema":"axx.assessment.v2","verdict":"x","sections":[]}')).toBeNull();
    expect(parseSnapshot('not json')).toBeNull();
  });
});

describe('ZERO REASONING — opening a snapshot cannot reassess', () => {
  it('renders with every reasoning entry point rigged to throw', async () => {
    vi.resetModules();
    const boom = (name: string) => () => { throw new Error(`REASONING EXECUTED: ${name}`); };
    vi.doMock('@/lib/consultation', () => ({ buildSystemAssessment: boom('buildSystemAssessment') }));
    vi.doMock('@/lib/llm-system-inference', () => ({
      inferProvisionalSystemAssessment: boom('inferProvisionalSystemAssessment'),
      buildProvisionalPrompt: boom('buildProvisionalPrompt'),
    }));
    vi.doMock('@/lib/evidence/manufacturer-facts', () => ({ physicalFactsFor: boom('physicalFactsFor') }));
    vi.doMock('@/lib/evidence/independent-review-acquisition', () => ({ admitAndStore: boom('admitAndStore') }));
    vi.doMock('@/product/assessment-pipeline', () => ({ runArtifactPipeline: boom('runArtifactPipeline') }));

    const mod = await import('../snapshot');
    const stored = freezeSnapshot(mod.snapshotFromProvisional(NATHAN_CONVERSATION, {
      ...meta, components: [{ name: 'Butler Monads' }, { name: 'Acora QRC-2' }],
    }));
    const reopened = mod.parseSnapshot(stored);

    expect(reopened?.verdict).toContain('200 watts into 4 ohms');
    expect(reopened?.question).toBe('Are you running into any limit on volume or dynamic range?');
    vi.doUnmock('@/lib/consultation');
    vi.resetModules();
  });

  it('imports no reasoning module at all', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(new URL('../snapshot.ts', import.meta.url), 'utf8');
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    // Three dependencies. Two are TYPE-ONLY — the CAM and the dossier view.
    // The third, `evidence-ledger`, carries runtime code but is not a path
    // back to reasoning: it is a pure derivation over dossiers the snapshot
    // has ALREADY frozen. It reads no catalog, resolves no product, consults
    // no engine, and its own only import is a type.
    //
    // The distinction the purity rule protects is "can opening a snapshot
    // reassess", not "does any function run". Deriving the ledger from frozen
    // material is the opposite of reassessment: it is what stops the ledger
    // being maintained separately and drifting from the assessment.
    // `../assessment/authoritative` joins the list on the same terms. It is
    // the licensing gate, and it is placed at CONSTRUCTION so an unlicensed
    // snapshot cannot be built — a gate at the renderer is a gate the next
    // surface forgets to call, which is precisely how the trait lane reached
    // production while the evidence lane sat behind a link nobody surfaced.
    //
    // Its own imports are checked below and are pure: it reaches
    // `relational-explain` for the verdict composer rather than
    // `llm-system-inference`, which is why that function was moved — the
    // snapshot layer must not be able to import a module carrying model
    // prompts and network calls, however pure the one function it wanted.
    expect(imports).toEqual([
      './canonical', './evidence-ledger', './system-review',
      '../assessment/authoritative', '../evidence/dossier-presentation',
    ]);
    for (const i of imports.filter((x) => !['./evidence-ledger', './system-review', '../assessment/authoritative'].includes(x))) {
      expect(src, i).toMatch(new RegExp(`import type \\{[^}]+\\} from '${i.replace(/[./]/g, '\\$&')}'`));
    }
    // The gate reaches nothing that could reassess.
    const gate = await fs.readFile(
      new URL('../../assessment/authoritative.ts', import.meta.url), 'utf8');
    const gateImports = [...gate.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(gateImports).toEqual([
      '../artifact/snapshot', '../evidence/dossier-presentation',
      '../artifact/causal-coverage', '../relational-explain',
    ]);
    expect(gate).not.toMatch(/llm-system-inference|consultation|assessment-pipeline/);
    // `relational-explain` is where the verdict composer now lives, and it
    // depends on nothing at all.
    const rel = await fs.readFile(
      new URL('../../relational-explain.ts', import.meta.url), 'utf8');
    expect([...rel.matchAll(/from '([^']+)'/g)].map((m) => m[1])).toEqual([]);

    // And the derivation itself must stay pure.
    const ledger = await fs.readFile(new URL('../evidence-ledger.ts', import.meta.url), 'utf8');
    const ledgerImports = [...ledger.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(ledgerImports).toEqual(['@/lib/evidence/dossier-presentation']);
    expect(ledger).toMatch(/import type \{/);

    // `system-review` is the same kind of dependency: it composes prose from
    // dossiers the snapshot has ALREADY frozen. It reads no catalog, resolves
    // no product and calls no engine, and its own only import is a type. The
    // purity rule protects "can opening a snapshot reassess", not "does any
    // function run" — and deriving a review from frozen material is the
    // opposite of reassessment.
    const review = await fs.readFile(new URL('../system-review.ts', import.meta.url), 'utf8');
    const reviewImports = [...review.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    // `quantity-compatibility` is a pure predicate over strings the snapshot
    // already holds — it decides whether two published figures may be compared
    // and reads nothing else. Guarding arithmetic is not reassessment.
    // `engineering-rules` joins on the strictest terms of all: it is a table of
    // CONSTANTS with zero imports of its own — Audio XX's own engineering
    // conventions, held as typed objects so a threshold can be attributed and
    // revised rather than sitting as a bare number inside a sentence. Reading a
    // constant is not reasoning, and a snapshot that opens one cannot reassess.
    expect(reviewImports).toEqual([
      '@/lib/evidence/dossier-presentation',
      '../evidence/engineering-rules',
      '@/lib/evidence/quantity-compatibility',
    ]);
    expect(review).toMatch(/import type \{/);
    const compat = await fs.readFile(
      new URL('../../evidence/quantity-compatibility.ts', import.meta.url), 'utf8');
    expect([...compat.matchAll(/from '([^']+)'/g)].map((m) => m[1])).toEqual([]);
    const rules = await fs.readFile(
      new URL('../../evidence/engineering-rules.ts', import.meta.url), 'utf8');
    expect([...rules.matchAll(/from '([^']+)'/g)].map((m) => m[1])).toEqual([]);
  });
});

describe('THE ARTIFACT IS NO LONGER A SUBSET OF THE CONVERSATION', () => {
  // Before this change `SnapshotArtifact` rendered neither dossiers nor the
  // tonal signature, so VIEW ASSESSMENT showed strictly LESS than the
  // conversation it froze: four component cards vanished on Nathan and the
  // Warm/Balanced/Elastic graph vanished on FRANCE.
  const dossiers = [
    { displayName: 'Butler Monads',
      primary: [{ label: 'power output', value: '200 W into 4 ohms' }],
      secondary: [{ label: 'tube complement', value: 'Butler Model 300B' }],
      gaps: [], hasDetail: true },
    { displayName: 'Acora QRC-2',
      primary: [{ label: 'impedance', value: '4 ohm' }],
      secondary: [], gaps: ['sensitivity from Acora'], hasDetail: false },
  ];

  it('carries dossiers through the provisional path', () => {
    const snap = snapshotFromProvisional(NATHAN_CONVERSATION, {
      ...meta, components: [{ name: 'Butler Monads' }], componentDossiers: dossiers as never,
    });
    expect(snap.componentDossiers).toHaveLength(2);
    expect(snap.componentDossiers![0].primary[0].value).toBe('200 W into 4 ohms');
    expect(snap.componentDossiers![1].gaps[0]).toContain('sensitivity');
  });

  it('carries dossiers through the catalog path', () => {
    const r = runArtifactPipeline('Assess my system: Amp: Leben CS600 Speakers: Klipsch Cornwall IV')!;
    const snap = snapshotFromCanonical(r.canonical, { ...meta, componentDossiers: dossiers as never });
    expect(snap.componentDossiers).toHaveLength(2);
  });

  it('no longer carries a tonal signature the evidence cannot license', () => {
    // Superseded 2026-08-24. `AxisReading.pole` is documented as "which pole
    // the SYSTEM commits to" — the aggregation of per-component catalog axes
    // into system character, which no established rule licenses. The dossiers
    // still carry per-component character with the basis beside it, so the
    // artifact is not a subset of the conversation; it is the same
    // authoritative assessment with the unlicensed aggregate removed.
    const r = runArtifactPipeline('Assess my system: Amp: Leben CS600 Speakers: Klipsch Cornwall IV')!;
    const snap = snapshotFromCanonical(r.canonical, meta);
    expect(snap.tonalSignature).toBeUndefined();
  });

  it('survives storage unchanged, dossiers included', () => {
    const snap = snapshotFromProvisional(NATHAN_CONVERSATION, {
      ...meta, components: [{ name: 'Butler Monads' }], componentDossiers: dossiers as never,
    });
    const reopened = parseSnapshot(freezeSnapshot(snap))!;
    expect(reopened.componentDossiers).toEqual(snap.componentDossiers);
    expect(reopened).toEqual(snap);
  });

  it('omits the field entirely when no dossier was produced', () => {
    // Absent must stay absent — the renderer must not draw an empty region.
    const snap = snapshotFromProvisional(NATHAN_CONVERSATION, {
      ...meta, components: [{ name: 'Butler Monads' }],
    });
    expect(snap.componentDossiers).toBeUndefined();
  });
});

describe('the renderer selects nothing', () => {
  it('displays the buckets the presentation layer already decided', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      new URL('../../../app/artifact/SnapshotArtifact.tsx', import.meta.url), 'utf8');
    // It reads primary/secondary/gaps/detailSummary and never re-derives them.
    expect(src).toMatch(/d\.primary\.map/);
    expect(src).toMatch(/d\.secondary\.map/);
    expect(src).toMatch(/d\.gaps\.map/);
    expect(src).not.toMatch(/presentDossier|dossierFor|specRoleFor|worthRendering/);
    // And it plots the frozen pole rather than recomputing one.
    expect(src).not.toMatch(/poleFor|committedValue|BALANCED_BAND|0\.35/);
  });
});

describe('the DOCUMENT speaks in one voice', () => {
  // The engine's prose is written for a chat turn. Rendered whole into the
  // artifact it produced two voices on one page, a third statement of the
  // chain, and per-component notes inside a system-level section.
  const meta = {
    engineVersion: 'test', createdAt: '2026-08-24T00:00:00.000Z',
    components: [{ name: 'Butler Monads', role: 'amplifier' }, { name: 'Acora QRC-2', role: 'speaker' }],
    componentDossiers: [
      { displayName: 'Butler Monads', primary: [], secondary: [], gaps: [], hasDetail: false },
      { displayName: 'Acora QRC-2', primary: [], secondary: [], gaps: [], hasDetail: false },
    ],
  };
  const response = {
    systemSignature: 'A finding.',
    philosophy: [
      'Your chain, as you described it: Butler Monads → Acora QRC-2.',
      'Butler Monads — a valve output stage with unusual reach.',
      'I can place 2 components in the chain but cannot assess them.',
      'What this means in practice: I can reason about the shape of the system.',
      'A genuine system-level observation that belongs in the review.',
    ].join('\n\n'),
    componentProvenance: [],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snap = snapshotFromProvisional(response as any, meta as any);
  const prose = snap.sections.flatMap((s) => s.paragraphs).join('\n');

  it('does not restate the chain the header already carries', () => {
    expect(prose).not.toMatch(/Your chain, as you described it/);
  });

  it('drops chat register from the document', () => {
    expect(prose).not.toMatch(/^I can |What this means in practice/m);
  });

  it('keeps genuine system-level prose', () => {
    expect(prose).toMatch(/genuine system-level observation/);
  });

  it('routes component-scoped prose to that component, not out of existence', () => {
    const butler = snap.componentDossiers?.find((d) => d.displayName === 'Butler Monads');
    expect(butler?.character).toMatch(/valve output stage with unusual reach/);
    // And it is not ALSO left in the review.
    expect(prose).not.toMatch(/valve output stage with unusual reach/);
  });

  it('leaves a component with no prose untouched', () => {
    const acora = snap.componentDossiers?.find((d) => d.displayName === 'Acora QRC-2');
    expect(acora?.character).toBeUndefined();
  });
});
