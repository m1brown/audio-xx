import { describe, it, expect } from 'vitest';
import { interfaceConclusions } from '../interface-conclusions';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

/**
 * The four defects visible in the 2026-08-26 production assessment,
 * reproduced from the values PRODUCTION actually holds — which differ from
 * the local development store, and that difference is why none of these
 * showed up in local rendering.
 */
const D = (displayName: string, role: string, l: Array<[string,string]>): DossierView =>
  // `gaps` is always an array on a real dossier; leaving it undefined here made
  // the review's flatMap yield undefined for the first component and skip the
  // block entirely — a fixture defect that looked like a product one.
  ({ displayName, role, primary: l.map(([label,value])=>({label,value})),
     secondary: [], gaps: [] } as never);

const NATHAN = [
  { displayName: 'dCS Rossini Apex', role: 'dac' },
  { displayName: 'ARC ref 5', role: 'preamplifier' },
  { displayName: 'Butler Monads', role: 'amplifier' },
  { displayName: 'Acora QRC-2', role: 'speaker' },
];

const PROD_DOSSIERS = [
  D('dCS Rossini Apex', 'dac', [
    /*
     * THE SHADOWING LINE. An admitted Stereophile observation that MENTIONS
     * output impedance in prose, carrying no figure — and it sorts above the
     * typed specification. A first-match lookup found this, failed to parse
     * ohms from it, and reported the quantity unpublished while the dossier
     * displayed it four lines below.
     */
    ['Stereophile', 'Measured performance was beyond reproach, with wide input '
      + 'sampling range, very low output impedance, and excellent distortion metrics'],
    ['Output impedance, balanced, measured 20Hz–20kHz; 51 ohms single-ended', '2 ohms'],
    ['Selectable maximum balanced output; measured 5.95V, 2.014V, 594.7mV and 201.3mV respectively', '6V / 2V / 0.6V / 0.2V'],
  ]),
  D('ARC ref 5', 'preamplifier', [
    ['Output impedance, balanced; 300 ohms single-ended', '600 ohms'],
    ['Input impedance, balanced; 60K ohms single-ended', '120K ohms'],
    ['Gain, balanced output; 6dB single-ended', '12dB'],
  ]),
  D('Butler Monads', 'amplifier', [
    // PRODUCTION holds the maker's full multi-figure string, not "200 Watts into 4 ohm loads".
    ['Power output', 'Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms'],
    ['Input impedance, at each input (RCA and XLR)', '47K ohms'],
    ['Input sensitivity for full 100 watts output at 8 ohms', '1.7 volts'],
  ]),
  D('Acora QRC-2', 'speaker', [
    ['Sensitivity', '92.5dB 1W/1m'],
    ['Impedance', '4 ohm'],
    ['Power handling', '10w - 250w'],
  ]),
];

const conclusions = () => interfaceConclusions(NATHAN, PROD_DOSSIERS);

describe('A — dCS into ARC must not report an unpublished figure it holds', () => {
  it('resolves the source-to-preamplifier loading interface', () => {
    const c = conclusions().find(
      (x) => x.upstream === 'dCS Rossini Apex' && x.downstream === 'ARC ref 5');
    expect(c).toBeTruthy();
    expect(c!.status).toBe('established');
  });

  it('and never claims the output impedance is unpublished', () => {
    for (const c of conclusions()) {
      expect(c.statement).not.toMatch(/dCS Rossini Apex's output impedance is not published/);
    }
  });
});

describe('B — headroom reads the figure at the loudspeaker’s own load', () => {
  it('uses 200W at 4 ohms, not the 100W minimum at 8', () => {
    const h = conclusions().find((c) => c.kind === 'headroom');
    expect(h).toBeTruthy();
    // 92.5 + 10*log10(200) = 115.5 dB.  Reading the first number in the
    // maker's multi-figure string gave 100W and therefore 112.5 -> "113dB".
    expect(h!.statement).toMatch(/115\.5dB/);
    expect(h!.statement).not.toMatch(/113dB|112\.5dB/);
  });

  it('and states which figure it read', () => {
    const h = conclusions().find((c) => c.kind === 'headroom');
    expect(h!.statement).toMatch(/200W figure at the 4-ohm load/);
    // A ceiling, not a prediction — and it says which assumption it rests on.
    expect(h!.statement).toMatch(/ceiling, not a prediction/);
  });
});

import { composeSystemReviewDetailed } from '../system-review';

const review = (extra: Partial<DossierView>[] = []) => composeSystemReviewDetailed({
  components: NATHAN,
  dossiers: PROD_DOSSIERS.map((d, i) => ({ ...d, ...(extra[i] ?? {}) })),
});

describe('C — a tube complement establishes contents, not topology', () => {
  const withTubes = () => composeSystemReviewDetailed({
    components: NATHAN,
    dossiers: PROD_DOSSIERS.map((d) => (
      d.displayName === 'ARC ref 5'
        ? { ...d, primary: [...d.primary, { label: 'Tube complement', value: '(4)-6H30P dual triodes, plus (1 each) 6550C and 6H30P in power supply' }] } as DossierView
        : d.displayName === 'Butler Monads'
          ? { ...d, primary: [...d.primary, { label: 'Tube complement', value: 'Butler Model 300B directly heated power triode' }] } as DossierView
          : d
    )),
  });

  it('never claims both stages are valve designs', () => {
    const all = withTubes().paragraphs.join('\n');
    expect(all).not.toMatch(/Both amplification stages are valve designs/);
    expect(all).not.toMatch(/passes through vacuum tubes twice/);
  });

  it('never puts the 300B in the loudspeaker output stage', () => {
    const all = withTubes().paragraphs.join('\n');
    expect(all).not.toMatch(/output stage built on/);
    expect(all).not.toMatch(/valve output stage(?!\.)/);
  });

  it('still reports that the signal meets valves at two points', () => {
    expect(withTubes().paragraphs.join('\n')).toMatch(/both carry vacuum tubes/);
  });

  it('says explicitly that a tube list does not locate the valves', () => {
    expect(withTubes().paragraphs.join('\n'))
      .toMatch(/not where in its circuit they operate/);
  });
});

describe('D — load difficulty is not acoustic headroom', () => {
  const withGap = () => composeSystemReviewDetailed({
    components: NATHAN,
    dossiers: PROD_DOSSIERS.map((d) => (
      d.displayName === 'Acora QRC-2'
        ? { ...d, gaps: ['an impedance-magnitude and phase plot, which Acora does not publish'] } as DossierView
        : d
    )),
  });

  it('does not claim one plot would finish the headroom question', () => {
    const all = withGap().paragraphs.join('\n');
    expect(all).not.toMatch(/finish the headroom question/);
    expect(all).not.toMatch(/it alone would/);
  });

  it('names what the missing plot actually resolves', () => {
    expect(withGap().paragraphs.join('\n')).toMatch(/how hard this loudspeaker is to drive/);
  });

  it('names separately what bounds headroom', () => {
    const all = withGap().paragraphs.join('\n');
    expect(all).toMatch(/not the same question as acoustic headroom/);
    expect(all).toMatch(/listening distance, the level you actually use/);
  });
});
