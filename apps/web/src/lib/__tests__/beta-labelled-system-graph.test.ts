import { describe, it, expect } from 'vitest';
import { extractSubjectMatches, detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';
import { parseLabelledComponents, labelContradictsCategory } from '../labelled-components';

/**
 * PERMANENT REGRESSION — first real beta-user defect (2026-08-15).
 *
 * A tester submitted a clean, explicitly labelled system description and got
 * no assessment. Three mechanisms failed at once:
 *
 *   1. "Dac/Streamer:" was split on "/" as a CHAIN separator, so only the half
 *      after the slash survived as the role — making the outcome depend on
 *      word order. "Streamer/DAC:" assessed; "Dac/Streamer:" did not.
 *   2. Role for brand-resolved components came from a fixed ±40-CHARACTER
 *      window that could reach into the next component's label, so a
 *      component's role was decided by typography.
 *   3. Components the catalog could not resolve were dropped SILENTLY, and the
 *      assessment then described "your system" minus a node the user named.
 *
 * The repair separates two questions the implementation had conflated: whether
 * the GRAPH is trustworthy, and whether we KNOW anything about each node. An
 * explicit label is the user stating a fact about their own system, and it can
 * establish structure even where identity coverage is partial.
 *
 * NOTE ON SCOPE: Butler and Acora are deliberately NOT added to BRAND_NAMES.
 * Making this green by extending a hand-maintained recognition list would hide
 * the architectural failure this turn exposed.
 */
const BETA_INPUT =
  'Assess my system: Pre-amp: ARC ref 5 Amps: Butler Monads Dac/Streamer: dCS Rossini Apex Speakers: Acora QRC-2';

const assess = (q: string) => {
  const subs = extractSubjectMatches(q);
  const { desires } = detectIntent(q) as unknown as { desires: unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buildSystemAssessment(q, subs, null, desires as any) as any;
};

describe('beta regression — the exact real-user turn', () => {
  const r = assess(BETA_INPUT);

  it('does not block on a clarification', () => {
    expect(r?.kind).not.toBe('clarification');
  });

  it('all four user-supplied component names survive parsing', () => {
    const names = (r?.components ?? []).map((c: { displayName: string }) => c.displayName);
    for (const expected of ['ARC ref 5', 'Butler Monads', 'dCS Rossini Apex', 'Acora QRC-2']) {
      expect(names).toContain(expected);
    }
  });

  it('the explicitly labelled roles survive parsing', () => {
    const byName = new Map<string, { role: string; roles: string[] }>(
      (r?.components ?? []).map((c: { displayName: string }) => [c.displayName, c] as const),
    );
    expect(byName.get('ARC ref 5')?.role).toBe('preamplifier');
    expect(byName.get('Butler Monads')?.role).toBe('amplifier');
    expect(byName.get('Acora QRC-2')?.role).toBe('speaker');
  });

  it('no false amplifier-role assignment (the ±40-char proximity defect)', () => {
    const dcs = (r?.components ?? []).find(
      (c: { displayName: string }) => c.displayName === 'dCS Rossini Apex',
    ) as { role: string; roles: string[] };
    expect(dcs.role).not.toBe('amplifier');
    expect(dcs.roles).not.toContain('amplifier');
  });

  it('the compound label is carried as a role SET, not a conflict', () => {
    const dcs = (r?.components ?? []).find(
      (c: { displayName: string }) => c.displayName === 'dCS Rossini Apex',
    ) as { roles: string[] };
    expect(dcs.roles).toEqual(expect.arrayContaining(['dac', 'streamer']));
  });

  it('unresolved components stay visibly unresolved rather than disappearing', () => {
    expect(r?.unknownComponents).toEqual(
      expect.arrayContaining(['ARC ref 5', 'Butler Monads', 'Acora QRC-2']),
    );
  });

  it('D-7: an unresolved node never wears its manufacturer tendencies', () => {
    for (const c of (r?.components ?? []) as Array<{ unresolved?: boolean; brandProfile?: unknown }>) {
      if (c.unresolved) expect(c.brandProfile).toBeUndefined();
    }
  });
});

describe('beta regression — D-8 materiality', () => {
  it('never asks for makes and models the user already supplied', () => {
    const r = assess(BETA_INPUT);
    const q: string = r?.clarification?.question ?? '';
    expect(q).not.toMatch(/exact make and model/i);
    expect(q).not.toMatch(/couldn't match/i);
  });

  it('answering a clarification cannot lead back to another clarification', () => {
    // The original defect was a loop: the role question was answered, and the
    // next turn asked for models that were already present in the text.
    const answered = `built-in streaming function. ${BETA_INPUT}`;
    expect(assess(answered)?.kind).not.toBe('clarification');
  });
});

describe('compound labels are order-independent', () => {
  const tail = ' Amp: Leben CS300 Speakers: Harbeth P3ESR';
  for (const form of ['DAC:', 'DAC/Streamer:', 'Streamer/DAC:', 'Source:']) {
    it(`"${form} dCS Bartok" assesses`, () => {
      expect(assess(`Assess my system: ${form} dCS Bartok${tail}`)?.kind).toBe('assessment');
    });
  }

  it('"DAC/Streamer" and "Streamer/DAC" produce the same role set', () => {
    const a = parseLabelledComponents('DAC/Streamer: dCS Bartok')[0].roles;
    const b = parseLabelledComponents('Streamer/DAC: dCS Bartok')[0].roles;
    expect([...a].sort()).toEqual([...b].sort());
  });
});

describe('the repair does not blunt genuine conflicts or invent structure', () => {
  it('a real role conflict is still raised', () => {
    const r = assess('Assess my system: Speakers: dCS Bartok Amp: Leben CS300');
    expect(r?.kind).toBe('clarification');
    expect(r.clarification.question).toMatch(/speaker/i);
  });

  it('labelContradictsCategory still rejects an impossible role', () => {
    expect(labelContradictsCategory(['speaker'], 'dac')).toBe(true);
    expect(labelContradictsCategory(['dac', 'streamer'], 'dac')).toBe(false);
  });

  it('a labelled system with one invented component keeps that component', () => {
    // The invariant is REPRESENTATION: an opaque node must never silently
    // disappear. Which field carries it depends on the path — a system with
    // enough curated evidence reaches the core assessment (chain in
    // `findings`), a thinner one returns the provisional shape (`components`).
    // Once brand-tier evidence stopped being discarded, this case correctly
    // moved from provisional to core, so the assertion must read both.
    const r = assess('Assess my system: DAC: dCS Bartok Amp: Leben CS300 Speakers: Zorblax QRC-2');
    const represented: string[] = [
      ...(r?.components ?? []).map((c: { displayName: string }) => c.displayName),
      ...(r?.findings?.componentNames ?? []),
      ...(r?.findings?.systemChain?.names ?? []),
    ];
    expect(represented).toContain('Zorblax QRC-2');
  });

  it('a fully catalogued labelled system still assesses normally', () => {
    const r = assess('Assess my system: DAC: dCS Bartok Amp: Leben CS300 Speakers: Harbeth P3ESR');
    expect(r?.kind).toBe('assessment');
  });

  it('ambiguous unlabelled prose is granted NO structure by this repair', () => {
    expect(
      parseLabelledComponents('I have an Eversolo DMP-A6 into a Leben CS300 and Harbeth P3ESR'),
    ).toEqual([]);
  });

  it('CONTROL: the unlabelled FRANCE system is unaffected', () => {
    const r = assess('Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor');
    expect(r?.kind).toBe('assessment');
  });
});
