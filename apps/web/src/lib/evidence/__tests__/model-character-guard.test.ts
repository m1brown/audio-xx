import { describe, it, expect } from 'vitest';
import { guardModelProse, licensedCharacterFrom, isUnlicensedCharacter } from '../model-character-guard';
import { deriveCharacter } from '../component-character';
import { seedObservations } from '../independent-review-seed';
import { resolveObservationKey } from '@/lib/artifact/sonic-synthesis';

const admitted = seedObservations().admitted;
const NAMES = ['dCS Rossini Apex', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2'];
const licensed = licensedCharacterFrom(new Map(NAMES.map((n) => {
  const k = resolveObservationKey(n, admitted);
  return [n, k ? deriveCharacter(k, n, admitted).propositions : []];
})));

describe('the model may not originate sonic character', () => {
  it('removes the production sentence that started this', () => {
    /*
     * Unsourced, and the opposite of what Stereophile reported three
     * paragraphs below it in the same document.
     */
    const r = guardModelProse(
      'The dCS Rossini Apex contributes to the overall transparency and detailed '
      + 'nature of the system, offering a bright character that facilitates separation.',
      licensed,
    );
    expect(r.text).toBe('');
    expect(r.removed).toHaveLength(1);
  });

  it('does not replace it with another characterisation', () => {
    const r = guardModelProse('The Acora QRC-2 sounds notably lean and cool.', licensed);
    expect(r.text).toBe('');
    // Removal only. No substitute wording is invented.
    expect(r.removed[0]).toMatch(/lean and cool/);
  });

  it('removes brand generalisation, which is not evidence about this unit', () => {
    const r = guardModelProse(
      'dCS components are described as transparent, controlled and spatially precise.',
      licensed,
    );
    expect(r.text).toBe('');
  });

  it('keeps character the evidence licenses WITHOUT qualification', () => {
    /*
     * The ARC's neutrality is a direct, unconditioned observation, so prose
     * may state it plainly. Its RESOLUTION is comparative — "high relative to
     * the Reference 3" — and is handled by the comparative-licence rule
     * below, which now refuses the unqualified form.
     */
    expect(isUnlicensedCharacter(
      'The ARC ref 5 is described as neutral rather than coloured.', licensed,
    )).toBe(false);
  });

  it('leaves non-character prose untouched', () => {
    const text = 'Gain and power are handled in separate boxes here, with ARC ref 5 '
      + 'doing the first and Butler Monads the second.';
    expect(guardModelProse(text, licensed).text).toBe(text);
  });

  it('keeps the licensed half of a paragraph and drops the rest', () => {
    const r = guardModelProse(
      'Gain and power are handled in separate boxes here. '
      + 'The Acora QRC-2 sounds notably lean and cool.',
      licensed,
    );
    expect(r.text).toMatch(/Gain and power/);
    expect(r.text).not.toMatch(/lean and cool/);
  });

  it('drops a sentence if ANY named component is unlicensed in it', () => {
    // One sentence asserts both; there is no honest way to keep half of it.
    expect(isUnlicensedCharacter(
      'The ARC ref 5 and the Butler Monads both sound bright and lean.', licensed,
    )).toBe(true);
  });

  it('says nothing rather than something when everything is unlicensed', () => {
    // Sparse evidence must produce bounded synthesis or an explicit unknown —
    // never filler. Empty is the correct output here.
    const r = guardModelProse('The Butler Monads impart a warm, syrupy character.', licensed);
    expect(r.text).toBe('');
  });

  it('handles empty and absent input', () => {
    expect(guardModelProse(undefined, licensed).text).toBe('');
    expect(guardModelProse('   ', licensed).text).toBe('');
  });

  it('does not fire on components it has no licence record for', () => {
    // A component absent from the licence list is not this guard's business —
    // other rules govern whether it may be characterised at all.
    expect(isUnlicensedCharacter('The Rega P3 sounds bright.', licensed)).toBe(false);
  });
});

describe('a comparative licence does not license an absolute claim', () => {
  it('removes the absolute restatement of a comparative proposition', () => {
    /*
     * The Rossini's resolution is admitted only as "high relative to the
     * earlier Rossini". The model wrote it as a settled property of the unit,
     * and the dimension check passed because the dimension IS licensed.
     */
    const r = guardModelProse(
      "The system benefits from the dCS Rossini Apex's known transparency, detail "
      + 'resolution, and spatial accuracy, which likely define its overall clarity.',
      licensed,
    );
    expect(r.text).toBe('');
  });

  it('still permits prose on an unqualified direct observation', () => {
    // The ARC's neutrality is a direct, unconditioned observation.
    expect(isUnlicensedCharacter(
      'The ARC ref 5 is described as neutral rather than coloured.', licensed,
    )).toBe(false);
  });
});
