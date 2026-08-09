import { describe, it, expect } from 'vitest';
import { hasExtraModelToken } from '../shopping-intent';

/**
 * A model variant is not the user's current component.
 *
 * Reported from production: asking to upgrade from a Chord Hugo produced a
 * primary recommendation of the Chord Hugo TT2 — stamped CURRENT, as though
 * the user already owned the thing being recommended. The match used raw
 * substring containment, and "chord hugo tt2".includes("chord hugo") is true.
 *
 * Containment still has a job: `currentNames` holds free text, so someone who
 * owns a Chord Hugo may type "chord hugo dac". The rule that separates the two
 * cases is whether the extra words form a model designation.
 */

describe('a model variant is a different product', () => {
  it('Hugo TT2 is not a Hugo — the reported case', () => {
    expect(hasExtraModelToken('chord hugo tt2', 'chord hugo')).toBe(true);
  });

  it('recognises roman-numeral variants', () => {
    expect(hasExtraModelToken('denafrips ares ii', 'denafrips ares')).toBe(true);
  });

  it('recognises numeric variants', () => {
    expect(hasExtraModelToken('schiit bifrost 2', 'schiit bifrost')).toBe(true);
  });

  it('recognises mk-suffix variants', () => {
    expect(hasExtraModelToken('musical fidelity m6 mkii', 'musical fidelity m6')).toBe(true);
  });

  it('holds in the other direction — owning the TT2 does not make the Hugo current', () => {
    expect(hasExtraModelToken('chord hugo tt2', 'hugo')).toBe(true);
  });
});

describe('phrasing noise still matches', () => {
  it('a trailing category word is not a model designation', () => {
    expect(hasExtraModelToken('chord hugo dac', 'chord hugo')).toBe(false);
  });

  it('a leading brand word is not a model designation', () => {
    expect(hasExtraModelToken('chord hugo', 'hugo')).toBe(false);
  });

  it('ordinary descriptive words are not designations', () => {
    expect(hasExtraModelToken('my chord hugo amplifier', 'chord hugo')).toBe(false);
  });

  it('identical names carry no extra token', () => {
    expect(hasExtraModelToken('chord hugo', 'chord hugo')).toBe(false);
  });

  it('a model number already present in both is not "extra"', () => {
    // "Hugo 2" recommended to a "Hugo 2" owner is genuinely the current one.
    expect(hasExtraModelToken('chord hugo 2', 'chord hugo 2')).toBe(false);
  });
});
