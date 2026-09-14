/**
 * Canonical system ingestion — P1 pins (2026-09-14).
 *
 * The QA harness's first metamorphic probe found that equivalent
 * natural-language descriptions of ONE physical system reached different
 * component-resolution behavior, and some corrupted variants still returned
 * `kind: assessment`:
 *
 *   "my system is Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus"
 *
 * dropped the DP-450 at extraction (the role-less leftover-segment licence
 * required a literal "system:" colon), the graph — assembled from curated
 * `subjectMatches` only — never carried it, the integrity gate could not see
 * it ("Accuphase DP-450 and Harbeth SHL5 Plus" was ONE segment whose Harbeth
 * tokens satisfied the identity test), and the listener got a confident
 * assessment of two-thirds of their system.
 *
 * The invariants these pins protect:
 *
 *   1. SEMANTIC FRAME INVARIANCE — once a turn is recognized as a system
 *      description, supported frames describing the same system resolve to
 *      the same physical component set.
 *   2. PRESERVE OR ASK — when Audio XX cannot account for every material
 *      component-bearing segment, it must not silently return an assessment
 *      of a reduced or blobbed system; clarification / low confidence are
 *      the honest outcomes.
 *   3. ONE SEMANTIC OWNER — `detectSystemDescription` decides what the
 *      message names; the catalog governs what may be SAID about a node,
 *      never whether it exists in the graph.
 */
import { describe, it, expect } from 'vitest';
import { extractSubjectMatches } from '../intent';
import { detectSystemDescription } from '../system-extraction';
import { buildTurnContext } from '../turn-context';
import { buildSystemAssessment } from '../consultation';
import type { AudioSessionState } from '../system-types';

const GUEST = {
  activeSystemRef: { kind: 'none' },
  savedSystems: [],
  draftSystem: null,
  loading: false,
  proposedSystem: null,
} as unknown as AudioSessionState;

function ids(msg: string): string[] {
  const p = detectSystemDescription(msg, extractSubjectMatches(msg), GUEST);
  return (p?.components ?? [])
    .map((c) => `${c.brand} ${c.name}`.trim().toLowerCase())
    .sort();
}

function e2e(msg: string) {
  const tc = buildTurnContext(msg, GUEST, new Set(), undefined);
  return buildSystemAssessment(msg, tc.subjectMatches, tc.activeSystem, []) as {
    kind?: string;
    response?: {
      systemChain?: { fullChain?: string[]; names?: string[]; roles?: string[] };
    };
  };
}

const ACCUPHASE_SET = [
  'accuphase dp-450',
  'accuphase e-600',
  'harbeth shl5 plus',
];

// ── 1. Metamorphic acceptance set: one system, many frames ─────────────

const FRAMES: Array<[string, string]> = [
  ['A colon-list', 'assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus'],
  ['B copula', 'my system is Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus'],
  ['C question-led', 'what do you think of my system? Accuphase E-600, Accuphase DP-450, Harbeth SHL5 Plus'],
  ['D imperative-verb', 'please assess: Accuphase E-600; Accuphase DP-450; Harbeth SHL5 Plus'],
  ['E i-have', 'I have an Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus'],
  ['F bare-system-colon', 'system: Accuphase E-600 / Accuphase DP-450 / Harbeth SHL5 Plus'],
];

describe('1 — semantic frame invariance at extraction', () => {
  for (const [label, frame] of FRAMES) {
    it(`frame ${label} resolves the same three components`, () => {
      expect(ids(frame)).toEqual(ACCUPHASE_SET);
    });
  }
});

// ── 2. The primary reproducers end-to-end ──────────────────────────────

describe('2 — corrupted frames no longer reach `assessment` reduced', () => {
  for (const [label, frame] of FRAMES.slice(0, 3)) {
    it(`frame ${label}: assessment carries all three as first-class components`, () => {
      const r = e2e(frame);
      expect(r.kind).toBe('assessment');
      const names = (r.response?.systemChain?.names ?? []).map((n) => n.toLowerCase());
      expect(names.some((n) => n.includes('e-600'))).toBe(true);
      expect(names.some((n) => n.includes('dp-450'))).toBe(true);
      expect(names.some((n) => n.includes('shl5'))).toBe(true);
      // No blobbed combined entry anywhere in the chain projection.
      for (const n of [...names, ...(r.response?.systemChain?.fullChain ?? [])]) {
        expect(n).not.toMatch(/\band\b/i);
      }
    }, 90000);
  }
});

// ── 3. Preserve or ask: omitted repeated brand ─────────────────────────

describe('3 — a frame Audio XX cannot fully account for degrades honestly', () => {
  it('omitted-brand sibling either survives or produces a clarification — never a silent reduction', () => {
    const r = e2e('assess my system: Accuphase E-600, DP-450, and Harbeth SHL5 Plus');
    if (r.kind === 'assessment') {
      const names = (r.response?.systemChain?.names ?? []).map((n) => n.toLowerCase());
      expect(names.some((n) => n.includes('dp-450'))).toBe(true);
    } else {
      expect(['clarification', 'low_confidence']).toContain(r.kind);
    }
  }, 90000);
});

// ── 4. Neighborhood: the repair is not Accuphase-specific ──────────────

describe('4 — same-brand siblings survive in the copula frame across makers', () => {
  it('two Naim components stay distinct', () => {
    const naim = ids('my system is Naim NDX 2, Naim SuperNait 3 and Harbeth SHL5 Plus');
    expect(naim).toHaveLength(3);
    expect(naim.join(' | ')).toMatch(/ndx 2/);
    expect(naim.join(' | ')).toMatch(/supernait 3/);
  });

  it('two Chord components stay distinct', () => {
    const chord = ids('my system is Chord Qutest, Chord TToby and Harbeth SHL5 Plus');
    expect(chord).toHaveLength(3);
    expect(chord).toContain('chord qutest');
    expect(chord).toContain('chord ttoby');
  });

  it('a true duplicate mention stays one physical unit', () => {
    const dup = ids('assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; the SuperNait 3 also takes a digital input');
    expect(dup).toHaveLength(2);
    expect(dup.filter((n) => n.includes('supernait'))).toHaveLength(1);
  });

  it('the A35/A3 collision stays fixed under the canonical path', () => {
    const nad = ids('assess my system: NAD AV716 Reciever. TOPPING D70 Pro OCTO DAC. Dynaco A35 Speakers');
    expect(nad).toHaveLength(3);
    for (const n of nad) expect(n).not.toMatch(/topping a3\b/);
  });
});

// ── 5. Frame recognition must not leak into non-description intents ────

describe('5 — widened recognition still refuses non-descriptions', () => {
  const NOT_SYSTEMS = [
    'which is better, Chord Qutest or Denafrips Ares II?',
    'review: Chord Qutest vs Schiit Modi 3',
    'can you recommend a dac: under $500, warm sounding',
    'my system is mostly vintage, warm sounding and I love it',
  ];
  for (const msg of NOT_SYSTEMS) {
    it(`refuses: ${msg.slice(0, 44)}`, () => {
      expect(detectSystemDescription(msg, extractSubjectMatches(msg), GUEST)).toBeNull();
    });
  }
});
