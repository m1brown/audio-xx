import { describe, it, expect } from 'vitest';
import { factLookupNames } from '../fact-lookup-names';
import { productKeyFor } from '../evidence/manufacturer-facts';
import { extractSubjectMatches } from '../intent';
import { parseLabelledComponents } from '../labelled-components';
import { buildSystemAssessment } from '../consultation';

/**
 * A stored fact is only worth storing if the read path can find it.
 *
 * Facts are written under the name the ACQUIRING path resolved — a resolved
 * component display name, "Denafrips Pontus II 12th-1". The deterministic read
 * asks under what the LISTENER wrote, "Denafrips Pontus II". `productKeyFor`
 * normalises case, not identity, so those are two different keys and the
 * stored fact is unreachable.
 *
 * This is not academic. 46% of catalogued loudspeakers carry no
 * `sensitivity_db`, so a catalogued speaker is a realistic case where the
 * maker's published figure is the only thing that makes a pairing assessable.
 */

/** Keys the acquisition path would write under, for a given message. */
function writeKeys(text: string): string[] {
  const r = buildSystemAssessment(
    text, extractSubjectMatches(text), undefined, undefined, undefined,
  ) as { components?: Array<{ displayName: string }>;
         findings?: { componentVerdicts?: Array<{ name: string }> } };
  const names = r?.components?.map((c) => c.displayName)
    ?? r?.findings?.componentVerdicts?.map((c) => c.name)
    ?? [];
  return [...new Set(names.map(productKeyFor))];
}

/** Keys the read path asks for, exactly as both call sites compose them. */
function readKeys(text: string): string[] {
  return [...new Set(
    factLookupNames(extractSubjectMatches(text), parseLabelledComponents(text))
      .map(productKeyFor),
  )];
}

const SYSTEMS: Array<[string, string]> = [
  ['catalogued + uncatalogued mix',
   'Assess my system: Amp: Decware SE84UFO Speakers: Acora QRC-2 Dac: Denafrips Pontus II'],
  ['fully uncatalogued separates (the beta system)',
   'Assess my system: Dac: dCS Rossini Apex Pre: Audio Research Reference 5 '
   + 'Amp: Butler MONAD A100 Speakers: Acora QRC-2'],
];

describe('every key the acquisition path writes is reachable by the read path', () => {
  it.each(SYSTEMS)('%s', (_label, text) => {
    const write = writeKeys(text);
    const read = new Set(readKeys(text));
    expect(write.length).toBeGreaterThan(0);
    const unreachable = write.filter((k) => !read.has(k));
    expect(unreachable).toEqual([]);
  });
});

describe('the canonical catalogue name is asked for as well as the listener’s', () => {
  const text = 'Assess my system: Amp: Decware SE84UFO Speakers: Acora QRC-2 '
    + 'Dac: Denafrips Pontus II';
  const keys = readKeys(text);

  it('includes the catalogue’s resolved identity', () => {
    // The listener wrote "Denafrips Pontus II"; the catalogue calls it
    // "Denafrips Pontus II 12th-1", and that is where a fact would be stored.
    expect(keys).toContain('denafrips pontus ii 12th-1');
  });

  it('still includes what the listener actually wrote', () => {
    expect(keys).toContain('denafrips pontus ii');
  });

  it('still includes the uncatalogued component', () => {
    // The primary case: no catalogue entry exists, so only the listener's
    // label can name it.
    expect(keys).toContain('acora qrc-2');
  });
});

describe('it asks for nothing it cannot justify', () => {
  it('ignores brands and parentheticals', () => {
    const names = factLookupNames([
      { name: 'Goldmund', kind: 'brand' },
      { name: 'Job', kind: 'product', parenthetical: true },
    ]);
    expect(names).toEqual([]);
  });

  it('returns no duplicates by product key', () => {
    const names = factLookupNames(
      [{ name: 'Chord Qutest', kind: 'product' }],
      [{ rawName: 'chord  qutest' }, { rawName: 'Chord Qutest' }],
    );
    const keys = names.map(productKeyFor);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
