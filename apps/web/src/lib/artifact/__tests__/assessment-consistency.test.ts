/**
 * Assessment consistency — P1 pins (2026-09-13).
 *
 * A real listener's Accuphase E-600 / DP-450 / Harbeth SHL5 Plus assessment
 * (a) silently dropped the DP-450, (b) said "amply powered" and "genuinely
 * power-constrained" on one page, and (c) printed "30 watts into 6 ohms"
 * for an amplifier whose maker states no 6-ohm figure.
 *
 * The repairs these pins protect:
 *   - a bare brand match never claims a segment carrying another model;
 *   - an unstated-load watt figure never wears the loudspeaker's load;
 *   - headroom has ONE arithmetic and ONE banded calibration
 *     (acousticHeadroom), read by both electrical owners — the same
 *     figures cannot yield opposite verdicts;
 *   - "a live constraint" is licensed only by the severe band; the modest
 *     band is condition-dependent prose;
 *   - a load the maker's ladder brackets but does not state produces the
 *     honest third state, not an inferred figure;
 *   - an unclassified material component is acknowledged, never dropped.
 */
import { describe, it, expect } from 'vitest';
import { extractSubjectMatches } from '@/lib/intent';
import { detectSystemDescription } from '@/lib/system-extraction';
import {
  assessDriveCapability, parseQuantities, driveConclusionFor, acousticHeadroom,
} from '@/lib/evidence/physical-quantities';
import { interfaceConclusions } from '../interface-conclusions';
import { composeSystemReviewDetailed } from '../system-review';
import { synthesiseChain } from '../sonic-synthesis';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

const GUEST = {
  activeSystemRef: { kind: 'none' }, savedSystems: [], draftSystem: null,
  loading: false, proposedSystem: null,
} as never;

const dossier = (displayName: string, lines: Array<[string, string]>): DossierView => ({
  displayName, role: '', secondary: [], gaps: [],
  primary: lines.map(([label, value]) => ({
    label, value, provenance: 'maker_published', source: 'maker',
  })),
} as unknown as DossierView);

const USER_INPUT = 'assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus.';

describe('1 — a second product of the same brand survives extraction', () => {
  const p = detectSystemDescription(USER_INPUT, extractSubjectMatches(USER_INPUT), GUEST);
  const ids = (p?.components ?? []).map((c) => `${c.brand} ${c.name}`.trim().toLowerCase());

  it('all three components are present', () => {
    expect(ids).toHaveLength(3);
    expect(ids).toContain('accuphase e-600');
    expect(ids).toContain('accuphase dp-450');
    expect(ids.join(' | ')).toMatch(/shl5 plus/);
  });
});

describe('2 — an unstated-load figure never wears the loudspeaker load', () => {
  it('unqualified watts stay usable but never claim the loudspeaker load', () => {
    // The established controls (a 5W SET into a Magnepan) depend on
    // load-less figures remaining assessable; the defect was ONLY the
    // prose wearing the speaker's load as if the maker had stated it.
    const pw = parseQuantities('Amp X', 'power_output', '30W per channel');
    const imp = parseQuantities('Speaker Y', 'nominal_impedance', '6 ohms')[0];
    const sens = parseQuantities('Speaker Y', 'sensitivity', '86dB/2.83V/1m')[0];
    const d = assessDriveCapability(pw, imp, sens);
    expect(d.status).toBe('assessable');
    expect((d as { intoOhms?: number }).intoOhms).toBeUndefined();
    const prose = driveConclusionFor(d, 'Amp X', 'Speaker Y').sentence!;
    expect(prose).not.toMatch(/watts into 6 ohms/);
    expect(prose).not.toMatch(/amply powered/); // ~98dB ceiling: modest band
    expect(prose).toMatch(/depends on how far you sit/);
  });

  it('a ladder that brackets the load stays a mismatch, with the honest ask', () => {
    const pw = parseQuantities('Accuphase E-600', 'power_output',
      '30W/ch into 8 ohms; 60W/ch into 4 ohms; 120W/ch into 2 ohms');
    const imp = parseQuantities('Harbeth SHL5 Plus', 'nominal_impedance', '6 ohms')[0];
    const sens = parseQuantities('Harbeth SHL5 Plus', 'sensitivity', '86dB/2.83V/1m axial')[0];
    const d = assessDriveCapability(pw, imp, sens);
    expect(d.status).toBe('load_mismatch');
    expect(driveConclusionFor(d, 'Accuphase E-600', 'Harbeth SHL5 Plus').sentence)
      .toMatch(/not published, so drive cannot be established/);
  });
});

describe('3 — one arithmetic, one calibration, one vocabulary', () => {
  it('the drive lane says "amply powered" only in the generous band', () => {
    const pw = parseQuantities('Big Amp', 'power_output', '200W into 8 ohms');
    const imp = parseQuantities('Easy Speaker', 'nominal_impedance', '8 ohms')[0];
    const sens = parseQuantities('Easy Speaker', 'sensitivity', '95dB/W/m')[0];
    const d = assessDriveCapability(pw, imp, sens);
    expect(d.status).toBe('assessable');
    expect(driveConclusionFor(d, 'Big Amp', 'Easy Speaker').sentence)
      .toMatch(/amply powered/);
  });

  it('a modest-band pairing is condition-dependent, never "a live constraint"', () => {
    const pw = parseQuantities('Small Amp', 'power_output', '30W into 6 ohms');
    const imp = parseQuantities('Hungry Speaker', 'nominal_impedance', '6 ohms')[0];
    const sens = parseQuantities('Hungry Speaker', 'sensitivity', '86dB/2.83V/1m')[0];
    const d = assessDriveCapability(pw, imp, sens);
    expect(d.status).toBe('assessable');
    const prose = driveConclusionFor(d, 'Small Amp', 'Hungry Speaker').sentence!;
    expect(prose).not.toMatch(/amply powered/);
    expect(prose).toMatch(/depends on how far you sit and how loud/);
  });

  it('the interface owner reads the same bands', () => {
    const conclusions = interfaceConclusions(
      [{ displayName: 'Small Amp', role: 'amplifier' },
        { displayName: 'Hungry Speaker', role: 'speaker' }],
      [dossier('Small Amp', [['power output', '30W into 6 ohms']]),
        dossier('Hungry Speaker', [
          ['sensitivity', '86dB/2.83V/1m'], ['nominal impedance', '6 ohms'],
        ])],
      { conversionPathAmbiguous: false },
    );
    const headroom = conclusions.find((c) => c.kind === 'headroom');
    expect(headroom).toBeTruthy();
    expect(headroom!.favourable).toBe(true); // modest is a question, not a constraint
    expect(headroom!.statement).toMatch(/Whether that bites depends on how far you sit/);
    expect(headroom!.statement).not.toMatch(/live constraint/);
  });

  it('the severe band remains a genuine constraint (Decware-class strength)', () => {
    const h = acousticHeadroom(2, 4, '86dB/2.83V/1m');
    expect(h?.band).toBe('severe');
    const conclusions = interfaceConclusions(
      [{ displayName: 'Tiny Amp', role: 'amplifier' },
        { displayName: 'Panel', role: 'speaker' }],
      [dossier('Tiny Amp', [['power output', '2W into 4 ohms']]),
        dossier('Panel', [['sensitivity', '86dB/2.83V/1m'], ['nominal impedance', '4 ohms']])],
      { conversionPathAmbiguous: false },
    );
    const headroom = conclusions.find((c) => c.kind === 'headroom');
    expect(headroom!.favourable).toBe(false);
    expect(headroom!.statement).toMatch(/genuinely power-constrained/);
  });

  it('no headroom conclusion is composed without a figure at the actual load', () => {
    const conclusions = interfaceConclusions(
      [{ displayName: 'Accuphase E-600', role: 'amplifier' },
        { displayName: 'Harbeth SHL5 Plus', role: 'speaker' }],
      [dossier('Accuphase E-600', [['power output',
        '30W/ch into 8 ohms; 60W/ch into 4 ohms; 120W/ch into 2 ohms']]),
        dossier('Harbeth SHL5 Plus', [
          ['sensitivity', '86dB/2.83V/1m axial'], ['nominal impedance', '6 ohms'],
        ])],
      { conversionPathAmbiguous: false },
    );
    expect(conclusions.find((c) => c.kind === 'headroom')).toBeUndefined();
  });
});

describe('3b — a comma-separated ladder answers each load with ITS wattage', () => {
  it('returns the figure at the queried load, not the first figure', async () => {
    const { wattsAtStatedLoad } = await import('../interface-conclusions');
    const ladder = '30 W/ch (8 ohms), 60 W/ch (4 ohms), 120 W/ch (2 ohms), 150 W/ch (1 ohm, music signals)';
    expect(wattsAtStatedLoad(ladder, 8)).toBe(30);
    expect(wattsAtStatedLoad(ladder, 4)).toBe(60);
    expect(wattsAtStatedLoad(ladder, 2)).toBe(120);
    expect(wattsAtStatedLoad(ladder, 6)).toBeUndefined();
  });
});

describe('4 — the composed control is coherent and complete', () => {
  const COMPS = [
    { displayName: 'Accuphase DP-450', role: 'other' },
    { displayName: 'Accuphase E-600', role: 'amplifier' },
    { displayName: 'Harbeth SHL5 Plus', role: 'speaker' },
  ];
  const DS = [
    dossier('Accuphase DP-450', []),
    dossier('Accuphase E-600', [['power output',
      '30W/ch into 8 ohms; 60W/ch into 4 ohms; 120W/ch into 2 ohms; 150W/ch into 1 ohm (music signals)']]),
    dossier('Harbeth SHL5 Plus', [
      ['sensitivity', '86dB/2.83V/1m axial'], ['nominal impedance', '6 ohms'],
    ])];
  const det = composeSystemReviewDetailed({
    components: COMPS, dossiers: DS, synthesis: synthesiseChain(COMPS),
    rawQuery: USER_INPUT,
  });
  const all = det.paragraphs.join('\n');

  it('states the bracketed-ladder third state without inventing a figure', () => {
    expect(all).toMatch(/stated loads do not include/);
    expect(all).toMatch(/does not infer output across loads/);
    expect(all).not.toMatch(/30 watts into 6 ohms|30W (?:at|into) the 6-ohm/);
  });

  it('contains no contradictory headroom judgments', () => {
    const ample = /amply powered|substantial acoustic headroom/.test(all);
    const constrained = /power-constrained|live constraint/.test(all);
    expect(ample && constrained).toBe(false);
    expect(ample).toBe(false);
    expect(constrained).toBe(false);
  });

  it('acknowledges the DP-450 instead of dropping it', () => {
    expect(all).toMatch(/Accuphase DP-450’s place in this chain isn’t established/);
  });
});
