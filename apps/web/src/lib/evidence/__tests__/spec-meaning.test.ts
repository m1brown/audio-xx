import { describe, it, expect } from 'vitest';
import { meaningFor, SPEC_MEANINGS } from '../spec-meaning';

describe('spec glosses explain the quantity, never the product', () => {
  it('names no product, brand or model anywhere', () => {
    for (const m of SPEC_MEANINGS) {
      expect(m.meaning, m.meaning).not.toMatch(
        /dCS|Rossini|Acora|Butler|Audio Research|Stereophile|this DAC|this amplifier's sound/i);
    }
  });

  it('makes no sonic claim', () => {
    // The line: a gloss may say what a figure MEASURES, never how anything sounds.
    for (const m of SPEC_MEANINGS) {
      expect(m.meaning, m.meaning).not.toMatch(
        /\b(sounds?|warm|bright|musical|detailed|smooth|harsh|lush|analytical)\b/i);
    }
  });

  it('distinguishes an input load from a loudspeaker load', () => {
    expect(meaningFor('Input impedance, balanced; 60K ohms single-ended'))
      .toMatch(/how heavily this input loads/i);
    expect(meaningFor('Impedance')).toMatch(/nominal load these loudspeakers present/i);
  });

  it('distinguishes amplifier input sensitivity from loudspeaker sensitivity', () => {
    expect(meaningFor('Input sensitivity for full 100 watts output at 8 ohms'))
      .toMatch(/input voltage needed/i);
    expect(meaningFor('Sensitivity')).toMatch(/how loud the loudspeaker plays/i);
  });

  it('says a tube complement does not locate the valves', () => {
    expect(meaningFor('Tube complement')).toMatch(/does not say where in the circuit/i);
  });

  it('tells the reader which power figure applies', () => {
    expect(meaningFor('Power output')).toMatch(/not the largest number on the list/i);
  });

  it('returns nothing for labels that need no explaining', () => {
    for (const l of ['Dimensions', 'Weight', 'Inputs', 'Cabinet material', '']) {
      expect(meaningFor(l), l).toBeUndefined();
    }
  });
});
