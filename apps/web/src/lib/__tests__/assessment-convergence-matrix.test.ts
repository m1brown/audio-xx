import { describe, it, expect } from 'vitest';
import { extractSubjectMatches, detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';

/**
 * ARCHITECTURAL DISCIPLINE ACROSS SYSTEMS — not identical output.
 *
 * Each of these produces a different, correct answer: some assess, some
 * clarify, some fall to expanded reasoning. What must be identical is the
 * discipline — one node per physical component, no formatting residue, no
 * alias promoted to a component, and a clarification only where the ambiguity
 * is genuine.
 *
 * The matrix exists because every identity defect found so far was invisible
 * on the system it was found with and visible on another.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assess = (q: string): any => {
  const { desires } = detectIntent(q) as unknown as { desires: unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buildSystemAssessment(q, extractSubjectMatches(q), null, desires as any);
};

const graphOf = (q: string): string[] => {
  const r = assess(q);
  return (r?.components ?? []).map((c: { displayName: string }) => c.displayName)
    .concat(r?.findings?.componentNames ?? []);
};

type Row = { label: string; text: string; expect: number | 'clarifies' };

const MATRIX: Row[] = [
  { label: 'NATHAN', expect: 4,
    text: 'Assess my system:\n1. Pre-amp: ARC ref 5\n2. Amps: Butler Monads\n3. Dac/Streamer: dCS Rossini Apex\n4. Speakers: Acora QRC-2' },
  { label: 'FRANCE', expect: 3,
    text: 'Assess my system: Streamer: Eversolo DMP-A6 Amp: JOB INTegrated Speakers: WLM Diva Monitor' },
  { label: 'MAGNEPAN', expect: 3,
    text: 'Assess my system: Dac: Chord Qutest Amp: Rega Elex-R Speakers: Magnepan LRS+' },
  { label: 'LEBEN/CORNWALL', expect: 2,
    text: 'Assess my system: Amp: Leben CS600X Speakers: Klipsch Cornwall IV' },
  { label: 'BALANCED REFERENCE', expect: 3,
    text: 'Assess my system: Dac: Chord Qutest Amp: Naim SuperNait 3 Speakers: Harbeth SHL5+' },
  { label: 'FLAWED REFERENCE', expect: 3,
    text: 'Assess my system: Dac: Holo May Amp: Decware 2W SET Speakers: Magnepan LRS+' },
  { label: 'PREAMP + INTEGRATED', expect: 3,
    text: 'Assess my system: Pre-amp: ARC ref 5 Integrated: Leben CS600X Speakers: KEF LS50 Meta' },
  { label: 'UNKNOWN PRODUCT', expect: 3,
    text: 'Assess my system: Dac: Qwibble Q1 Amp: Rega Elex-R Speakers: KEF LS50 Meta' },
  // Genuine ambiguity must survive: these SHOULD ask.
  { label: 'TWO GENUINE DACS', expect: 'clarifies',
    text: 'Assess my system: DAC: Chord Qutest DAC: Denafrips Ares II Amp: Rega Elex-R Speakers: KEF LS50 Meta' },
  { label: 'LISTENER-ONLY', expect: 'clarifies',
    text: 'Assess my system: Dac: Zorb 9 Amp: Blang 2 Speakers: Frooble X' },
];

describe('every reference system keeps one node per physical component', () => {
  for (const row of MATRIX) {
    it(`${row.label}: ${row.expect === 'clarifies' ? 'asks a genuine question' : `${row.expect} components, once each`}`, () => {
      const r = assess(row.text);
      if (row.expect === 'clarifies') {
        expect(r?.kind).toBe('clarification');
        return;
      }
      expect(r?.kind, `${row.label} blocked: ${r?.clarification?.question ?? ''}`)
        .not.toBe('clarification');
      const names = graphOf(row.text);
      expect(names).toHaveLength(row.expect);
      expect(new Set(names).size, `${row.label} duplicated a component`).toBe(row.expect);
    });
  }

  it('no system anywhere carries formatting residue in a component name', () => {
    for (const row of MATRIX) {
      for (const n of graphOf(row.text)) {
        expect(n, `${row.label}: "${n}"`).not.toMatch(/assess|my system/i);
        expect(n, `${row.label}: "${n}"`).not.toMatch(/[·•]|(^|\s)[-–—]($|\s)|\d{1,2}[.)]\s/);
      }
    }
  });

  it('an alias never occupies a slot in any signal path', () => {
    // Pass Labs / First Watt share a BrandProfile; Harbeth SHL5+ aliases to
    // Super HL5 Plus. Neither may appear as a second box.
    const passLabs = graphOf('Assess my system: DAC: Chord Qutest Amp: Pass Labs XA25 Speakers: KEF LS50 Meta');
    expect(passLabs.some((n) => /first watt/i.test(n))).toBe(false);

    const harbeth = graphOf('Assess my system: Dac: Chord Qutest Amp: Naim SuperNait 3 Speakers: Harbeth SHL5+');
    expect(harbeth.filter((n) => /harbeth/i.test(n))).toHaveLength(1);
  });
});
