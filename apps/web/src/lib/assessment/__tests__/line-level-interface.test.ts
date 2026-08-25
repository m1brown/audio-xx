import { describe, it, expect } from 'vitest';
import { composeSystemReview } from '@/lib/artifact/system-review';
import { causalCoverage } from '@/lib/artifact/causal-coverage';
import { readImpedanceFigures, pairImpedances } from '@/lib/evidence/quantity-compatibility';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

/**
 * THE LINE-LEVEL INTERFACE NOW REASONS, INSTEAD OF MERELY DETECTING.
 *
 * Coverage reported EXPLAINED whenever an output-impedance label and an
 * input-impedance label both existed — while nothing composed a single
 * sentence from the figures. "Explained" meant "detected", which is coverage
 * over-claiming, and that is worse than a gap because it hides one.
 *
 * The specifications below are the Audio Research Reference 5 as published in
 * The Absolute Sound (TAS 205): a REPORTED source, not maker-published, and
 * the non-SE model — its "Four 6H30P dual triodes" matches the tube complement
 * Audio XX already held.
 */

const d = (
  displayName: string, role: string,
  primary: Array<{ label: string; value: string }>,
): DossierView => ({
  displayName, role,
  primary: primary.map((l) => ({ ...l, sourceClass: 'third_party_reported' as const })),
  secondary: [], gaps: [], hasDetail: true,
} as never);

const ARC = d('ARC Reference 5', 'preamplifier', [
  { label: 'output impedance', value: '600 ohms balanced, 300 ohms single-ended' },
  { label: 'input impedance', value: '120k ohms balanced, 300k ohms single-ended' },
  { label: 'gain', value: '12dB balanced output, 6dB single-ended output' },
]);

describe('conditions are matched before the ratio', () => {
  it('reads each figure with the connection it was stated for', () => {
    const f = readImpedanceFigures('600 ohms balanced, 300 ohms single-ended');
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ ohms: 600, connection: 'balanced' });
    expect(f[1]).toMatchObject({ ohms: 300, connection: 'single_ended' });
  });

  it('reads k-ohms as thousands', () => {
    expect(readImpedanceFigures('120k ohms balanced')[0].ohms).toBe(120000);
  });

  it('pairs balanced with balanced, never across connections', () => {
    const p = pairImpedances(
      readImpedanceFigures('600 ohms balanced, 300 ohms single-ended'),
      readImpedanceFigures('47k ohms balanced'),
    );
    expect(p.ok).toBe(true);
    if (p.ok) { expect(p.out.ohms).toBe(600); expect(p.in.ohms).toBe(47000); }
  });

  it('refuses with a stated reason when only opposite connections exist', () => {
    const p = pairImpedances(
      readImpedanceFigures('600 ohms balanced'),
      readImpedanceFigures('47k ohms single-ended'),
    );
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.reason).toMatch(/stated for different connections/);
  });
});

describe('the rule states a MARGIN and refuses a sonic consequence', () => {
  const out = composeSystemReview({
    components: [
      { displayName: 'ARC Reference 5', role: 'preamplifier' },
      { displayName: 'Test Amp', role: 'amplifier' },
    ],
    dossiers: [ARC, d('Test Amp', 'amplifier', [
      { label: 'input impedance', value: '47k ohms balanced' },
    ])],
  }).join('\n\n');

  it('computes the like-for-like ratio', () => {
    expect(out).toMatch(/600 ohms into an input impedance of 47000 ohms/);
    expect(out).toMatch(/about 78 times the source impedance/);
    expect(out).toMatch(/inside the conventional margin/);
  });

  it('names the connection the comparison holds for', () => {
    expect(out).toMatch(/on the balanced connection/);
  });

  it('claims nothing about what the listener would hear', () => {
    expect(out).toMatch(/statement about the loading margin and nothing else/);
    expect(out).toMatch(/how that output impedance behaves across frequency, which neither maker publishes/);
    for (const overclaim of [
      /will sound/i, /veiled/i, /rolled off/i, /bass will/i,
      /synerg/i, /well matched/i, /ideal pairing/i,
    ]) expect(out, String(overclaim)).not.toMatch(overclaim);
  });

  it('reports a short margin as short, not as a failure', () => {
    const tight = composeSystemReview({
      components: [
        { displayName: 'ARC Reference 5', role: 'preamplifier' },
        { displayName: 'Low-Z Amp', role: 'amplifier' },
      ],
      dossiers: [ARC, d('Low-Z Amp', 'amplifier', [
        { label: 'input impedance', value: '3000 ohms balanced' },
      ])],
    }).join('\n\n');
    expect(tight).toMatch(/short of the conventional margin/);
    expect(tight).not.toMatch(/incompatible|will not work|cannot drive/i);
  });
});

describe('coverage no longer calls detection explanation', () => {
  it('is UNRESOLVED when the two figures cannot be compared', () => {
    const rows = causalCoverage({
      components: [
        { displayName: 'ARC Reference 5', role: 'preamplifier' },
        { displayName: 'SE Only Amp', role: 'amplifier' },
      ],
      dossiers: [
        d('ARC Reference 5', 'preamplifier', [{ label: 'output impedance', value: '600 ohms balanced' }]),
        d('SE Only Amp', 'amplifier', [{ label: 'input impedance', value: '47k ohms single-ended' }]),
      ],
    });
    const row = rows.find((r) => r.to === 'SE Only Amp')!;
    expect(row.state).toBe('unresolved');
    expect(row.cause).toBe('incompatible_conditions');
  });

  it('is EXPLAINED only when a comparable pair exists', () => {
    const rows = causalCoverage({
      components: [
        { displayName: 'ARC Reference 5', role: 'preamplifier' },
        { displayName: 'Test Amp', role: 'amplifier' },
      ],
      dossiers: [ARC, d('Test Amp', 'amplifier', [
        { label: 'input impedance', value: '47k ohms balanced' },
      ])],
    });
    expect(rows.find((r) => r.to === 'Test Amp')!.state).toBe('explained');
  });
});
