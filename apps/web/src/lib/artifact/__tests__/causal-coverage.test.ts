import { describe, it, expect } from 'vitest';
import { causalCoverage, formatCoverage } from '../causal-coverage';
import { composeSystemReview } from '../system-review';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

/**
 * MATERIALLY DIFFERENT SYSTEMS MUST PRODUCE MATERIALLY DIFFERENT ASSESSMENTS.
 *
 * The failure this guards against is one essay structure with the nouns
 * swapped. Each system below holds a different SHAPE of evidence, and each
 * must therefore reach a different conclusion — including the two conclusions
 * that are easiest to get wrong in opposite directions:
 *
 *   the flawed pairing, where evidence licenses a problem and silence would
 *   be a failure, not restraint;
 *
 *   the unremarkable pairing, where nothing is established and inventing a
 *   weakness would be the failure instead.
 */

const d = (
  displayName: string,
  primary: Array<{ label: string; value: string }>,
  extra: Partial<DossierView> = {},
): DossierView => ({
  displayName,
  primary: primary.map((l) => ({ ...l, sourceClass: 'maker_published' as const })),
  secondary: [], gaps: [], hasDetail: true, ...extra,
});

describe('the coverage matrix names the missing figure, never "insufficient evidence"', () => {
  it('names both sides of an unresolved line-level interface', () => {
    const rows = causalCoverage({
      components: [
        { displayName: 'Chord Qutest', role: 'dac' },
        { displayName: 'Rega Elex-R', role: 'amplifier' },
      ],
      dossiers: [d('Chord Qutest', []), d('Rega Elex-R', [])],
    });
    const line = rows.find((r) => r.to === 'Rega Elex-R')!;
    expect(line.state).toBe('unresolved');
    expect(line.cause).toBe('missing_product_evidence');
    expect(line.detail).toMatch(/output impedance/);
    expect(line.detail).toMatch(/input impedance/);
    // The uselessly generic phrasing must never be the answer.
    expect(line.detail).not.toMatch(/insufficient evidence/i);
  });

  it('distinguishes a missing figure from incompatible conditions', () => {
    // Both sides publish; the loads simply do not correspond.
    const rows = causalCoverage({
      components: [
        { displayName: 'Amp', role: 'amplifier' },
        { displayName: 'Spk', role: 'speaker' },
      ],
      dossiers: [
        d('Amp', [{ label: 'power output', value: '50 Watts @ 8 Ohms' }]),
        d('Spk', [{ label: 'impedance', value: '4 ohm' }]),
      ],
    });
    const row = rows.find((r) => r.state === 'unresolved')!;
    expect(row.cause).toBe('incompatible_conditions');
    expect(row.detail).toMatch(/no published output figure at 4 ohms/);
  });

  it('reports partial explanation when only loudness is unanswerable', () => {
    const rows = causalCoverage({
      components: [
        { displayName: 'Amp', role: 'amplifier' },
        { displayName: 'Spk', role: 'speaker' },
      ],
      dossiers: [
        d('Amp', [{ label: 'power output', value: '50 Watts @ 8 Ohms' }]),
        d('Spk', [{ label: 'impedance', value: '8 ohm' }]),
      ],
    });
    const row = rows[0];
    expect(row.state).toBe('partially_explained');
    expect(row.detail).toMatch(/sensitivity is not published/);
  });

  it('an interface the system does not contain is never reported', () => {
    // A matrix padded with absent interfaces measures the ontology rather
    // than the assessment in front of it.
    const rows = causalCoverage({
      components: [{ displayName: 'Spk', role: 'speaker' }],
      dossiers: [d('Spk', [])],
    });
    expect(rows).toEqual([]);
  });

  it('formats one readable line per interface', () => {
    const rows = causalCoverage({
      components: [
        { displayName: 'Amp', role: 'amplifier' },
        { displayName: 'Spk', role: 'speaker' },
      ],
      dossiers: [d('Amp', []), d('Spk', [])],
    });
    expect(formatCoverage(rows)[0]).toMatch(/Amp → Spk: UNRESOLVED — /);
  });
});

describe('a licensed problem is stated, not softened into silence', () => {
  const FLAWED = {
    components: [
      { displayName: 'Decware SE84', role: 'amplifier' },
      { displayName: 'Magnepan LRS+', role: 'speaker' },
    ],
    dossiers: [
      d('Decware SE84', [{ label: 'power output', value: '2 Watts @ 8 Ohms' }]),
      d('Magnepan LRS+', [
        { label: 'impedance', value: '4 ohm' },
        { label: 'power handling', value: '60 W - 200 W' },
      ]),
    ],
  };

  it('says the published figures do not meet when they do not', () => {
    // The positive branch once stood alone: inside the window was reported,
    // outside it produced nothing. Both rest on the same two published
    // figures, so both must be sayable.
    const out = composeSystemReview({
      ...FLAWED,
      dossiers: [
        d('Decware SE84', [{ label: 'power output', value: '2 Watts @ 4 Ohms' }]),
        FLAWED.dossiers[1],
      ],
    }).join('\n\n');
    expect(out).toMatch(/The published figures do not meet/);
    expect(out).toMatch(/falls below the bottom of that range/);
  });

  it('but claims nothing about how it will sound or fail', () => {
    const out = composeSystemReview({
      ...FLAWED,
      dossiers: [
        d('Decware SE84', [{ label: 'power output', value: '2 Watts @ 4 Ohms' }]),
        FLAWED.dossiers[1],
      ],
    }).join('\n\n');
    for (const overclaim of [
      /will clip/i, /will strain/i, /will damage/i, /will sound/i,
      /too little power/i, /underpowered/i, /badly matched/i,
    ]) expect(out, String(overclaim)).not.toMatch(overclaim);
    // And it names what the published minimum is NOT.
    expect(out).toMatch(/not a measurement of the pairing/);
  });
});

describe('restraint where nothing is established', () => {
  it('a pairing inside the window is not talked up', () => {
    const out = composeSystemReview({
      components: [
        { displayName: 'Leben CS600X', role: 'integrated' },
        { displayName: 'Klipsch Cornwall IV', role: 'speaker' },
      ],
      dossiers: [
        d('Leben CS600X', [{ label: 'power output', value: '32 Watts @ 8 Ohms' }]),
        d('Klipsch Cornwall IV', [
          { label: 'impedance', value: '8 ohm' },
          { label: 'power handling', value: '10 W - 150 W' },
        ]),
      ],
    }).join('\n\n');
    expect(out).toMatch(/within the limits both makers state/);
    expect(out).toMatch(/not that the match is an easy one/);
    for (const overclaim of [/excellent match/i, /ideal/i, /synerg/i, /well matched/i]) {
      expect(out, String(overclaim)).not.toMatch(overclaim);
    }
  });

  it('a system with no held figures produces no electrical claims at all', () => {
    const out = composeSystemReview({
      components: [
        { displayName: 'Blang 2', role: 'amplifier' },
        { displayName: 'Frooble X', role: 'speaker' },
      ],
      dossiers: [d('Blang 2', []), d('Frooble X', [])],
    }).join('\n\n');
    expect(out).not.toMatch(/watts/i);
    expect(out).not.toMatch(/within the limits/);
    expect(out).not.toMatch(/do not meet/);
  });
});

describe('materially different systems produce materially different reviews', () => {
  const review = (i: Parameters<typeof composeSystemReview>[0]) =>
    composeSystemReview(i).join('\n\n');

  const inWindow = review({
    components: [
      { displayName: 'Leben CS600X', role: 'integrated' },
      { displayName: 'Klipsch Cornwall IV', role: 'speaker' },
    ],
    dossiers: [
      d('Leben CS600X', [{ label: 'power output', value: '32 Watts @ 8 Ohms' }]),
      d('Klipsch Cornwall IV', [
        { label: 'impedance', value: '8 ohm' },
        { label: 'power handling', value: '10 W - 150 W' },
      ]),
    ],
  });

  const outOfWindow = review({
    components: [
      { displayName: 'Decware SE84', role: 'amplifier' },
      { displayName: 'Magnepan LRS+', role: 'speaker' },
    ],
    dossiers: [
      d('Decware SE84', [{ label: 'power output', value: '2 Watts @ 4 Ohms' }]),
      d('Magnepan LRS+', [
        { label: 'impedance', value: '4 ohm' },
        { label: 'power handling', value: '60 W - 200 W' },
      ]),
    ],
  });

  const noEvidence = review({
    components: [
      { displayName: 'Blang 2', role: 'amplifier' },
      { displayName: 'Frooble X', role: 'speaker' },
    ],
    dossiers: [d('Blang 2', []), d('Frooble X', [])],
  });

  it('reaches three different conclusions, not one template', () => {
    expect(inWindow).not.toEqual(outOfWindow);
    expect(outOfWindow).not.toEqual(noEvidence);
    expect(inWindow).not.toEqual(noEvidence);
  });

  it('length follows the evidence rather than a target', () => {
    expect(noEvidence.length).toBeLessThan(inWindow.length);
  });
});
