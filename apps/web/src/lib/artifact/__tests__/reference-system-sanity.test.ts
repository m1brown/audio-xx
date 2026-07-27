/**
 * Reference-System Sanity Suite — Doctrine D-11 (Explanatory Licensing).
 *
 * Trust floors, not preferred outcomes: an implausible primary diagnosis must be
 * impossible without licensed evidence (an identified interaction / constraint /
 * mismatch). These fixtures assert that reference-class coherent systems are not
 * diagnosed flawed on intrinsic character, that a genuine mismatch still fires,
 * that a normal-character system yields no primary diagnosis, and the
 * cross-cutting invariants.
 */
import { describe, it, expect } from 'vitest';
import { runArtifactPipeline } from '../../../product/assessment-pipeline';

const NO_CHANGE = 'This system is already well balanced.';
const COHERENT_TITLE = 'Nothing here needs changing.';

function payload(sys: string) {
  const r = runArtifactPipeline(sys);
  return r?.payload ?? null;
}
function allText(p: NonNullable<ReturnType<typeof payload>>) {
  return [p.verdict, p.standfirst ?? '', p.recognition, ...p.caseParagraphs, p.recommendation, p.cost ?? ''].join('\n');
}

// A — reference-coherent systems: must NOT be diagnosed flawed (no licensed constraint present).
const COHERENT = [
  ['Yamamoto/O96', 'Assess my system: Chord Hugo, Yamamoto A-08S, DeVore Orangutan O/96'],
  ['Leben/O96', 'Assess my system: Denafrips Ares II, Leben CS600, DeVore Orangutan O/96'],
  ['Decware/O96', 'Assess my system: Denafrips Ares II, Decware SE84UFO, DeVore Orangutan O/96'],
  ['Pass INT-250/Magico A3', 'Assess my system: Chord Qutest, Pass Labs INT-250, Magico A3'],
  ['Klipsch Cornwall/Leben', 'Assess my system: Denafrips Ares II, Leben CS600, Klipsch Cornwall IV'],
  ['Naim SuperNait/Harbeth', 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus'],
];

describe('A · reference-coherent systems are not diagnosed flawed', () => {
  for (const [label, sys] of COHERENT) {
    it(`${label}: coherent verdict + no-change recommendation`, () => {
      const p = payload(sys);
      expect(p, `${label} produced no artifact`).not.toBeNull();
      expect(p!.verdict).toBe(COHERENT_TITLE);
      expect(p!.recommendation).toBe(NO_CHANGE);
    });
  }
});

describe('B · genuine mismatch still diagnosed (licensed)', () => {
  // Magico A3 is fully catalogued (88 dB) so the power/sensitivity mismatch is
  // seeable. (Magico A5 lacks sensitivity data — a catalog-coverage gap that
  // leaves a real mismatch un-diagnosable; tracked separately, not an E1 fault.)
  it('2W SET → Magico A3: power_match fires', () => {
    const p = payload('Assess my system: Chord Qutest, Yamamoto A-08S, Magico A3');
    expect(p).not.toBeNull();
    expect(p!.verdict).toMatch(/can't drive|drive these speakers|need more power/i);
    expect(p!.recommendation).toMatch(/power mismatch|amplifier power|easier-to-drive/i);
  });
});

describe('C · normal-character system → no primary diagnosis', () => {
  it('all components within normal range yields the coherent no-change state', () => {
    const p = payload('Assess my system: Chord Qutest, Naim Nait XS 3, Harbeth P3ESR');
    expect(p).not.toBeNull();
    expect(p!.verdict).toBe(COHERENT_TITLE);
    expect(p!.recommendation).toBe(NO_CHANGE);
  });
});

describe('D · cross-cutting invariants (every fixture)', () => {
  const ALL = [...COHERENT.map(([, s]) => s),
    'Assess my system: Chord Qutest, Decware SE84UFO, Magico A5',
    'Assess my system: Chord Qutest, Naim Nait XS 3, Harbeth P3ESR'];
  for (const sys of ALL) {
    it(`no "the system" role, no verdict/recommendation contradiction :: ${sys.slice(18, 60)}…`, () => {
      const p = payload(sys);
      if (!p) return; // coverage gaps handled elsewhere
      const text = allText(p);
      // No unclassifiable "the system" role in any slot.
      expect(text).not.toMatch(/the system is steering|start with the system|i['’]d start with the system/i);
      // No contradiction: a coherent verdict must not co-exist with an action recommendation.
      const coherent = p.verdict === COHERENT_TITLE;
      const actionRec = /^i['’]d (start|resolve)/i.test(p.recommendation);
      expect(coherent && actionRec, `contradiction: "${p.verdict}" + "${p.recommendation}"`).toBe(false);
    });
  }
});
