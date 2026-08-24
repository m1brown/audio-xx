import { describe, it, expect } from 'vitest';
import { extractSubjectMatches, detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';
import { parseLabelledComponents, TURN_SEPARATOR } from '../labelled-components';

/**
 * PERMANENT REGRESSION — turn-boundary contamination (production, 2026-08-24).
 *
 * The list-marker repair fixed a name absorbing the next LIST ITEM's marker.
 * Production then failed a turn later, for the same reason at a different
 * boundary: accumulated turns are joined into one string so an incrementally
 * described system reads as one system, and they were joined with "\n".
 *
 * A newline is not a turn boundary — a single turn contains several, because a
 * listener who types a numbered list types four of them. So the parser saw one
 * span and ran the last component of turn N into the prose opening turn N+1:
 *
 *   "… Speakers: Acora QRC-2" + "Assess my system: - Pre-amp: …"
 *      → speaker: "Acora QRC-2 Assess my system"
 *
 * The listener was then told two components had gone unmatched, in a turn that
 * named all four.
 *
 * THE RULE: conversation turns are hard PARSE boundaries. Parse each turn
 * independently, reconcile the component records afterwards — never
 * concatenate raw turns and parse once. Hard parse boundaries are NOT hard
 * memory boundaries; the incremental control below pins that.
 */

const NUMBERED = 'Assess my system:\n1. Pre-amp: ARC ref 5\n2. Amps: Butler Monads\n3. Dac/Streamer: dCS Rossini Apex\n4. Speakers: Acora QRC-2';
const BULLETED = 'Assess my system:\n- Pre-amp: ARC ref 5\n- Amps: Butler Monads\n- Dac/Streamer: dCS Rossini Apex\n- Speakers: Acora QRC-2';
const NATHAN = ['dCS Rossini Apex', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2'];

const joined = (...turns: string[]) => turns.join(TURN_SEPARATOR);
const labelled = (m: string) => parseLabelledComponents(m).map((l) => l.rawName);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assess = (q: string): any => {
  const subs = extractSubjectMatches(q);
  const { desires } = detectIntent(q) as unknown as { desires: unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buildSystemAssessment(q, subs, null, desires as any);
};

describe('conversation turns are hard parse boundaries', () => {
  it('no name carries text from an adjacent turn, in either order', () => {
    for (const m of [joined(NUMBERED, BULLETED), joined(BULLETED, NUMBERED)]) {
      for (const name of labelled(m)) {
        expect(name, `"${name}" absorbed adjacent-turn text`).not.toMatch(/assess|my system/i);
        expect(name).not.toContain(TURN_SEPARATOR);
        expect(NATHAN).toContain(name);
      }
    }
  });

  it('the exact production sequence yields four components after every turn', () => {
    const sequences: Array<[string, string]> = [
      ['numbered then bulleted', joined(NUMBERED, BULLETED)],
      ['bulleted then numbered', joined(BULLETED, NUMBERED)],
      ['numbered twice', joined(NUMBERED, NUMBERED)],
      ['bulleted twice', joined(BULLETED, BULLETED)],
      ['three turns', joined(NUMBERED, BULLETED, NUMBERED)],
    ];
    for (const [label, m] of sequences) {
      const r = assess(m);
      expect(r?.kind, `${label}: blocked by a clarification`).not.toBe('clarification');
      const names = (r?.components ?? []).map((c: { displayName: string }) => c.displayName);
      expect([...names].sort(), label).toEqual([...NATHAN].sort());
    }
  });

  it('restating a system does not report components as dropped', () => {
    // countMeaningfulInputComponents deduped by normalised segment, but
    // "1. pre amp arc ref 5" and "pre amp arc ref 5" are different strings, so
    // the same four components written twice counted as six, and the shortfall
    // was reported as components it could not match. Formatting is structure,
    // never identity — the same rule the parser follows.
    for (const m of [joined(NUMBERED, BULLETED), joined(BULLETED, NUMBERED)]) {
      const r = assess(m);
      expect(r?.clarification?.question ?? '').not.toMatch(/couldn't match/i);
    }
  });

  it('no duplicate-role clarification fires from two representations', () => {
    const r = assess(joined(NUMBERED, BULLETED));
    expect(r?.clarification?.question ?? '').not.toMatch(/both appear as|all appear in the/i);
  });

  it('the separator is structural — it can never be typed into a name', () => {
    // A control character (U+001E RECORD SEPARATOR): not on a keyboard, not
    // survivable through a paste from a product page, and stripped by every
    // identity normaliser here. That is the whole reason it is the boundary.
    expect(TURN_SEPARATOR).toHaveLength(1);
    expect(TURN_SEPARATOR.charCodeAt(0)).toBe(0x1e);
    expect(/[\p{L}\p{N}\p{P}\p{Z}]/u.test(TURN_SEPARATOR)).toBe(false);
  });
});

describe('SEMANTIC MEMORY survives the parse boundary', () => {
  // Hard PARSE boundaries are not hard MEMORY boundaries. Turns are parsed
  // separately and their component RECORDS are reconciled afterwards, so a
  // system described a piece at a time still assembles into one system.
  const INCREMENTAL = joined(
    'My DAC is a Chord Qutest',
    'The amp is a Rega Elex-R',
    'Speakers are KEF LS50 Meta',
  );

  it('every turn contributes its component to one shared graph', () => {
    // All three turns reach the graph: the response names components from
    // turns 2 and 3, which only exist because earlier turns were retained.
    const r = assess(INCREMENTAL);
    const surface = JSON.stringify(r);
    expect(surface).toMatch(/rega/i);
    expect(surface).toMatch(/kef/i);
  });

  it('but one turn never lends its prose to another', () => {
    for (const n of labelled(INCREMENTAL)) {
      expect(n).not.toMatch(/the amp is|speakers are|my dac is/i);
    }
  });

  it('a follow-up naming one component does not erase the rest', () => {
    // "Actually, change the DAC to a Bartok" after the full Nathan turn. The
    // components the listener did not mention again must still be present —
    // that is the memory the parse boundary must not cut.
    const r = assess(joined(NUMBERED, 'Actually, change the DAC to a Bartok'));
    const surface = JSON.stringify(r);
    expect(surface).toMatch(/rossini apex/i);
    expect(surface).toMatch(/bartok/i);
  });

  it('and two genuinely different DACs still clarify (invariant 4)', () => {
    // Whether "change the DAC to X" REPLACES or ADDS is a question about the
    // listener's intent, not about string adjacency. Two distinct products in
    // one role is real ambiguity and must still be asked about.
    //
    // Before the repair this same turn produced a truncated role-label
    // conflict — "You described the Acora QRC-2" — because the loudspeaker's
    // name had absorbed the follow-up's prose. The question is now coherent.
    const r = assess(joined(NUMBERED, 'Actually, change the DAC to a Bartok'));
    expect(r?.kind).toBe('clarification');
    expect(r.clarification.question).toMatch(/both appear as dacs/i);
    expect(r.clarification.question).toMatch(/bartok/i);
    expect(r.clarification.question).not.toMatch(/you described the acora/i);
  });
});
