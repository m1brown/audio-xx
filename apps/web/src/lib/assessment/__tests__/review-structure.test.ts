import { describe, it, expect } from 'vitest';
import { composeSystemReviewDetailed } from '@/lib/artifact/system-review';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

/**
 * THESIS → EXPLANATION → LIMITS → NEXT QUESTION.
 *
 * The review read as accumulated reasoning: fact, caveat, fact, caveat,
 * question. Every claim in it was licensed and the ORDER was the order
 * evidence happened to be retrieved — so a reader met the strongest finding
 * partway through the third paragraph, and the same unresolved question in
 * three separate places.
 *
 * Structure creates no conclusion. It decides which licensed conclusion a
 * reader meets first.
 */

const d = (
  displayName: string, role: string,
  primary: Array<{ label: string; value: string }> = [],
  secondary: Array<Record<string, unknown>> = [],
  gaps: string[] = [],
): DossierView => ({
  displayName, role,
  primary: primary.map((l) => ({ ...l, sourceClass: 'maker_published' as const })),
  secondary, gaps, hasDetail: true,
} as never);

const NATHAN = {
  components: [
    { displayName: 'dCS Rossini Apex', role: 'dac' },
    { displayName: 'ARC Reference 5', role: 'preamplifier' },
    { displayName: 'Butler MONAD A100', role: 'amplifier' },
    { displayName: 'Acora QRC-2', role: 'speaker' },
  ],
  dossiers: [
    d('dCS Rossini Apex', 'dac', [], [{
      label: 'Stereophile',
      value: 'deeper silences — only direct A/B comparison with earlier Rossini DAC under same setup',
      publication: 'Stereophile', sourceClass: 'listening_observation',
    }]),
    d('ARC Reference 5', 'preamplifier', [], [{ label: 'tube complement', value: '(4)-6H30P' }]),
    d('Butler MONAD A100', 'amplifier', [{
      label: 'power output',
      value: '100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms',
    }], [{ label: 'tube complement', value: 'Butler Model 300B directly heated power triode' }]),
    d('Acora QRC-2', 'speaker', [
      { label: 'impedance', value: '4 ohm' },
      { label: 'power handling', value: '10 W – 250 W' },
    ], [], ['the published sensitivity figure']),
  ],
  driveFinding: 'Published figures put the Butler MONAD A100 at 200 watts into 4 ohms.',
  driveQualification: "The Acora QRC-2's sensitivity is not published.",
  coverageNote: 'Audio XX does not hold enough product-specific listening evidence for most of this chain.',
};

const r = composeSystemReviewDetailed(NATHAN);

describe('the review opens with the principal assessment', () => {
  it('states the settled relationship first, before any supporting detail', () => {
    expect(r.paragraphs[0]).toMatch(/The one relationship in this chain that published evidence settles/);
    expect(r.paragraphs[0]).toMatch(/Butler MONAD A100 and Acora QRC-2/);
  });

  it('names the limit on it in the same opening', () => {
    // A reader who stops here should know both what was concluded and what
    // bounds it.
    expect(r.paragraphs[0]).toMatch(/sensitivity/);
  });

  it('does not restate the verdict printed above it', () => {
    expect(r.paragraphs[0]).not.toContain(NATHAN.driveFinding);
  });
});

describe('the explanation is ordered by significance, not retrieval', () => {
  it('leads with the quantitative amplifier-to-loudspeaker analysis', () => {
    expect(r.paragraphs[1]).toMatch(/Which of the amplifier's published figures applies/);
    expect(r.paragraphs[1]).toMatch(/about 1\.6×/);
  });

  it('places the single-component listening evidence after the relationships', () => {
    const rel = r.paragraphs.findIndex((p) => /published figures applies/.test(p));
    const obs = r.paragraphs.findIndex((p) => /listening evidence Audio XX holds/.test(p));
    expect(rel).toBeGreaterThan(-1);
    expect(obs).toBeGreaterThan(rel);
  });
});

describe('the signal chain appears once', () => {
  it('the architecture paragraph states the fact rather than re-listing the boxes', () => {
    const arch = r.paragraphs.find((p) => /separate boxes/.test(p))!;
    expect(arch).toBeTruthy();
    // The chain line is printed directly above the section; naming all three
    // boxes again was repetition dressed as analysis.
    expect(arch).not.toMatch(/keeps every stage separate/);
    expect(arch).not.toMatch(/as source,/);
  });
});

describe('limits are consolidated, and the closing question is last', () => {
  it('puts the limits after the explanation and before the close', () => {
    const limit = r.paragraphs.findIndex((p) => /Suitability and loudness/.test(p));
    expect(limit).toBeGreaterThan(1);
    expect(limit).toBeLessThan(r.nextIndex!);
  });

  it('ends on what would materially improve the assessment', () => {
    expect(r.paragraphs[r.paragraphs.length - 1]).toMatch(/The gap is narrow and specific/);
    expect(r.nextIndex).toBe(r.paragraphs.length - 1);
  });

  it('exposes where a caller should insert its own limits material', () => {
    // An unresolved-evidence statement appended at the very end landed BELOW
    // "here is what would help" — an afterthought to the thing it motivates.
    expect(typeof r.nextIndex).toBe('number');
    expect(r.nextIndex).toBeLessThan(r.paragraphs.length);
  });
});

describe('structure creates no unlicensed conclusion', () => {
  const all = r.paragraphs.join('\n');
  it('still refuses difficulty, synergy and sonic prediction', () => {
    for (const overclaim of [
      /demand for current rather than for voltage/i, /current[- ]hungry/i,
      /difficult load/i, /easy to drive/i, /synerg/i, /will sound/i,
    ]) expect(all, String(overclaim)).not.toMatch(overclaim);
  });

  it('the thesis claims only what the explanation then supports', () => {
    expect(r.paragraphs[0]).toMatch(/on the makers' own figures rather than on reputation/);
    expect(all).toMatch(/within the limits both makers state/);
  });
});
