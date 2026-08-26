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

/*
 * The DRIVE thesis, wherever it sits.
 *
 * It used to be paragraph 0. A verified-price classification now leads,
 * because "what kind of system is this" is the question a listener asks
 * first. These assertions are about the drive paragraph's CONTENT, not its
 * index, so they find it rather than assuming position.
 */
const drivePara = () => r.paragraphs.find((x) => /into .* is the interface where/.test(x))
  ?? r.paragraphs.find((x) => /nominal .* load/.test(x)) ?? '';

describe('the review opens with the principal assessment', () => {
  it('states the principal conclusion first', () => {
    /*
     * "the one interface ... Audio XX can assess quantitatively" was true when
     * the amplifier-to-loudspeaker pairing was the only one with figures on
     * both sides. A targeted gap search closed three more, so the claim became
     * false in its own document — the review went on to settle two loading
     * interfaces and a gain structure underneath it.
     */
    expect(drivePara()).toMatch(
      /Butler MONAD A100 into Acora QRC-2 is the interface where the published figures/);
  });

  it('names what licenses that conclusion', () => {
    expect(drivePara()).toMatch(/makers' own figures establish compatibility/);
    expect(drivePara()).toMatch(/nominal 4 ohm load/);
  });

  it('names the most important limitations, and why they hold', () => {
    // A reader who stops here should know what was concluded, on what, and
    // what bounds it.
    expect(drivePara()).toMatch(/how difficult that load actually is to drive/);
    expect(drivePara()).toMatch(/how much acoustic headroom the system has/);
    expect(drivePara()).toMatch(/impedance minimum and phase behaviour/);
    expect(drivePara()).toMatch(/sensitivity figure/);
  });

  it('is DERIVED from the dossiers, not authored separately', () => {
    /*
     * An opening composed from its own reading of the evidence is a second
     * account of the assessment, and two accounts drift. Removing the
     * loudspeaker's impedance line must change the thesis, because that line
     * is where the load in it comes from.
     */
    const noLoad = composeSystemReviewDetailed({
      ...NATHAN,
      dossiers: NATHAN.dossiers.map((x) => (x.displayName === 'Acora QRC-2'
        ? { ...x, primary: x.primary.filter((l) => l.label !== 'impedance') } : x)),
    });
    expect(noLoad.paragraphs.join('\n')).not.toMatch(/nominal 4 ohm load/);
  });

  it('drops a limitation the dossier actually resolves', () => {
    // With sensitivity held, the headroom limit must disappear from the
    // thesis — a hardcoded caveat would keep claiming a figure was missing
    // that the dossier holds.
    const withSens = composeSystemReviewDetailed({
      ...NATHAN,
      dossiers: NATHAN.dossiers.map((x) => (x.displayName === 'Acora QRC-2'
        ? { ...x, primary: [...x.primary, { label: 'sensitivity', value: '86 dB', sourceClass: 'maker_published' as const }] } : x)),
    });
    const p = withSens.paragraphs.find((x) => /how difficult that load actually is/.test(x)) ?? '';
    expect(p).toBeTruthy();
    // Sensitivity is held, so it is no longer listed among the missing figures
    // in the drive paragraph — the headroom conclusion computes it elsewhere.
    expect(p).not.toMatch(/how much acoustic headroom the system has/);
  });

  it('does not restate the verdict printed above it', () => {
    expect(r.paragraphs[0]).not.toContain(NATHAN.driveFinding);
  });
});

describe('the explanation is ordered by significance, not retrieval', () => {
  it('leads with the quantitative amplifier-to-loudspeaker analysis', () => {
    // The five propositions are now separate paragraphs rather than one wall
    // of text, so the scaling inference is no longer inside the first of them.
    expect(r.paragraphs.join('\n')).toMatch(/Which of the amplifier's published figures applies/);
    expect(r.paragraphs.join('\n')).toMatch(/about 1\.6×/);
  });

  it('breaks the causal reasoning into readable units', () => {
    /*
     * The slot was renamed from "what the numbers tell us" to "why the system
     * makes sense" when the review was re-cut as an argument rather than an
     * audit of the evidence. The requirement it pins is unchanged: distinct
     * propositions get distinct paragraphs.
     */
    const why = r.sections?.find((sec) => /why the system makes sense/i.test(sec.label));
    expect(why).toBeTruthy();
    expect(why!.paragraphs.length).toBeGreaterThanOrEqual(3);
  });

  it('names its semantic slots, and omits the ones with nothing to say', () => {
    const labels = (r.sections ?? []).map((sec) => sec.label);
    // Roles a reader can act on, in the order an argument runs.
    expect(labels[0]).toBe('The assessment');
    expect(labels).toContain('Why the system makes sense');
    // A slot is only present when the material exists.
    for (const sec of r.sections ?? []) expect(sec.paragraphs.length).toBeGreaterThan(0);
  });

  it('a sparsely evidenced system acquires no empty headings', () => {
    const bare = composeSystemReviewDetailed({
      components: [
        { displayName: 'Blang 2', role: 'amplifier' },
        { displayName: 'Frooble X', role: 'speaker' },
      ],
      dossiers: [
        { displayName: 'Blang 2', role: 'amplifier', primary: [], secondary: [], gaps: [], hasDetail: false } as never,
        { displayName: 'Frooble X', role: 'speaker', primary: [], secondary: [], gaps: [], hasDetail: false } as never,
      ],
    });
    expect(bare.sections ?? []).toHaveLength(0);
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
    // The coverage note is the surviving LIMITS paragraph now that the
    // headroom boundary lives in the thesis.
    const limit = r.paragraphs.findIndex((p) => /does not hold enough product-specific/.test(p));
    expect(limit).toBeGreaterThan(1);
    expect(limit).toBeLessThan(r.nextIndex!);
  });

  it('ends on what would materially improve the assessment', () => {
    /*
     * The gap paragraph moved from a closing NEXT slot into WHAT REMAINS
     * UNKNOWN, which now closes the argument (recommendation before unknowns,
     * per the convergence brief). The requirement it pins is unchanged: the
     * document's final material is the specific missing evidence, not a
     * generic sign-off.
     */
    expect(r.paragraphs[r.paragraphs.length - 1]).toMatch(/The gap is narrow and specific/);
  });

  it('exposes where a caller should insert its own limits material', () => {
    // Unresolved-evidence statements are LIMITS material, and the unknown
    // region now closes the document — so the insertion point is its end.
    expect(typeof r.nextIndex).toBe('number');
    expect(r.nextIndex).toBe(r.paragraphs.length);
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
    expect(drivePara()).toMatch(/makers' own figures establish compatibility/);
    expect(all).toMatch(/within the limits both makers state/);
  });

  it('the body develops the thesis rather than restating its limits', () => {
    /*
     * Each limitation is STATED once. The closing paragraph now also
     * DISTINGUISHES acoustic headroom from load difficulty — the two were
     * being conflated, and one specification was said to settle a question it
     * cannot touch. That sentence is a distinction, not a restatement, so it
     * is excluded before counting.
     */
    const withoutDisambiguation = all
      .replace(/not the same question as acoustic headroom[\s\S]*?into the real load\./g, '');
    expect(withoutDisambiguation.match(/acoustic headroom/g) ?? []).toHaveLength(1);
    expect(all.match(/impedance minimum and phase behaviour/g) ?? []).toHaveLength(1);
    expect(all).not.toMatch(/Suitability and loudness are two different questions/);
  });
});
