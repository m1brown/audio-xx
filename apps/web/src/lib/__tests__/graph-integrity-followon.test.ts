/**
 * Graph-integrity follow-on clauses — P1 pins (2026-09-14).
 *
 * The 2422055 gate hardening widened the segment vocabulary (";", "?", "!",
 * " and ") so blobbed lists could not hide a dropped component — and every
 * ordinary follow-on clause then became its own "component" segment. A
 * fully-recognised system plus a re-mention ("; the SuperNait 3 also takes a
 * digital input") or listener context ("; I mostly listen to jazz") flipped
 * from assessment to the wrong-premise "One component in what you wrote I
 * couldn't match" clarification — live on production 802ae4e, with both
 * components shown RECOGNISED two lines above.
 *
 * The invariants these pins protect:
 *
 *   1. A gate segment affects the component count only when it plausibly
 *      NAMES A PRODUCT (brand token, equipment noun, model morphology).
 *   2. A re-mention of a resolved component is recognised by its normalized
 *      identity — including short and one-character model tokens (SuperNait
 *      3, E-600, Ref 5, A35) — never lost to token-length filters.
 *   3. A genuinely new product after ";" or "and" still counts: preserved
 *      whole, or preserve-or-ask. Never silently ignored.
 *   4. A prose clause inside a list frame never becomes a phantom component
 *      (a designation carries no clause grammar).
 */
import { describe, it, expect } from 'vitest';
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

function e2e(msg: string) {
  const tc = buildTurnContext(msg, GUEST, new Set(), undefined);
  return buildSystemAssessment(msg, tc.subjectMatches, tc.activeSystem, []) as {
    kind?: string;
    clarification?: { question?: string };
    response?: { systemChain?: { names?: string[] } };
  };
}
const names = (r: ReturnType<typeof e2e>) =>
  (r.response?.systemChain?.names ?? []).map((n) => n.toLowerCase());

describe('1 — re-mention clauses do not block assessment', () => {
  const CASES: Array<[string, string[]]> = [
    ['assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; the SuperNait 3 also takes a digital input',
      ['supernait 3', 'shl5']],
    ['assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus; the SuperNait 3 is the newest box',
      ['qutest', 'supernait 3', 'hl5']],
    ['assess my system: Accuphase E-600, Accuphase DP-450, Harbeth SHL5 Plus and the E-600 runs warm',
      ['e-600', 'dp-450', 'shl5']],
  ];
  for (const [M, expected] of CASES) {
    it(`assesses: ${M.slice(18, 80)}`, () => {
      const r = e2e(M);
      expect(r.kind).toBe('assessment');
      const n = names(r);
      for (const e of expected) expect(n.some((x) => x.includes(e))).toBe(true);
      // The clause itself must not become a component.
      expect(n.length).toBe(expected.length);
    }, 90000);
  }
});

describe('2 — listener-context clauses do not block assessment or seed phantoms', () => {
  const CASES = [
    'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; I mostly listen to jazz',
    'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; my room is about 20 square metres',
    'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; I listen fairly quietly',
  ];
  for (const M of CASES) {
    it(`assesses cleanly: ${M.slice(54)}`, () => {
      const r = e2e(M);
      expect(r.kind).toBe('assessment');
      const n = names(r);
      expect(n.length).toBe(2);
      expect(n.some((x) => x.includes('supernait 3'))).toBe(true);
      expect(n.some((x) => x.includes('shl5'))).toBe(true);
    }, 90000);
  }
});

describe('3 — INVERSE: a genuinely new product after ";" or "and" still counts', () => {
  it('a cataloged third product joins the system', () => {
    const r = e2e('assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; Chord Qutest');
    expect(r.kind).toBe('assessment');
    expect(names(r).some((x) => x.includes('qutest'))).toBe(true);
    expect(names(r).length).toBe(3);
  }, 90000);

  it('an "and"-joined third product joins the system', () => {
    const r = e2e('assess my system: Naim SuperNait 3 and Harbeth SHL5 Plus and Chord Qutest');
    expect(r.kind).toBe('assessment');
    expect(names(r).some((x) => x.includes('qutest'))).toBe(true);
    expect(names(r).length).toBe(3);
  }, 90000);

  it('a bare brand after ";" is never silently ignored (preserved or asked)', () => {
    const r = e2e('assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; Rega');
    if (r.kind === 'assessment') {
      expect(names(r).some((x) => x.includes('rega'))).toBe(true);
    } else {
      expect(['clarification', 'low_confidence']).toContain(r.kind);
    }
  }, 90000);

  it('an unknown model-shaped product after ";" is preserved or asked', () => {
    const r = e2e('assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; Zorblax Z9');
    if (r.kind === 'assessment') {
      expect(names(r).some((x) => x.includes('zorblax'))).toBe(true);
    } else {
      expect(['clarification', 'low_confidence']).toContain(r.kind);
    }
  }, 90000);
});

describe('4 — the canonical-ingestion repair stays intact', () => {
  const FRAMES = [
    'assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus',
    'my system is Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus',
    'what do you think of my system? Accuphase E-600, Accuphase DP-450, Harbeth SHL5 Plus',
  ];
  for (const M of FRAMES) {
    it(`all three survive: ${M.slice(0, 44)}`, () => {
      const r = e2e(M);
      expect(r.kind).toBe('assessment');
      const n = names(r);
      expect(n.some((x) => x.includes('e-600'))).toBe(true);
      expect(n.some((x) => x.includes('dp-450'))).toBe(true);
      expect(n.some((x) => x.includes('shl5'))).toBe(true);
      for (const x of n) expect(x).not.toMatch(/\band\b/);
    }, 90000);
  }

  it('the unsafe omitted-brand case still clarifies (not silently reduced)', () => {
    const r = e2e('assess my system: Accuphase E-600, DP-450, and Harbeth SHL5 Plus');
    expect(r.kind).toBe('clarification');
  }, 90000);
});
