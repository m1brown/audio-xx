import { describe, it, expect } from 'vitest';
import { extractSubjectMatches, detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';
import { prefixMatchIsSafe, suffixMatchIsSafe, remainderIsVariant } from '../product-identity-match';

/**
 * ONE PHYSICAL COMPONENT → ONE CANONICAL NODE → MANY EVIDENCE RECORDS.
 *
 * Evidence records are not components. Aliases are not components. Catalog
 * candidates are not components. Formatting variants are not components.
 *
 * These are stated as universal rules rather than as a list of the products
 * that happened to break, because which product breaks depends on the catalog
 * and on how the listener typed — neither of which a named test can anticipate.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assess = (q: string): any => {
  const { desires } = detectIntent(q) as unknown as { desires: unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buildSystemAssessment(q, extractSubjectMatches(q), null, desires as any);
};

const namesOf = (q: string): string[] => {
  const r = assess(q);
  if (r?.kind === 'clarification') {
    // A clarification still exposes the graph it reasoned about.
    return (r.clarification.recognized ?? []) as string[];
  }
  return (r?.components ?? []).map((c: { displayName: string }) => c.displayName)
    .concat(r?.findings?.componentNames ?? []);
};

/** Every name a clarification or assessment put in front of the reader. */
const surfaceOf = (q: string): string => JSON.stringify(assess(q));

describe('a partial match may not cross a variant boundary', () => {
  it('a trailing variant marker is recognised however it is attached', () => {
    expect(remainderIsVariant('X')).toBe(true);        // CS600 → CS600X
    expect(remainderIsVariant(' SE')).toBe(true);      // Reference 5 → Reference 5 SE
    expect(remainderIsVariant(' TT2')).toBe(true);     // Hugo → Hugo TT2
    expect(remainderIsVariant(' Gen 2')).toBe(true);
    expect(remainderIsVariant(' Meta')).toBe(true);
  });

  it('a family word is not a variant marker', () => {
    expect(remainderIsVariant('Orangutan ')).toBe(false);
    expect(remainderIsVariant('Compact ')).toBe(false);
  });

  it('prefix matching never reaches a sibling', () => {
    expect(prefixMatchIsSafe('cs600', 'cs600x')).toBe(false);
    expect(prefixMatchIsSafe('reference 5', 'reference 5 se')).toBe(false);
    expect(prefixMatchIsSafe('hugo', 'hugo tt2')).toBe(false);
    expect(prefixMatchIsSafe('ls50', 'ls50 meta')).toBe(false);
  });

  it('suffix matching still resolves a model inside a family name', () => {
    expect(suffixMatchIsSafe('o/96', 'orangutan o/96')).toBe(true);
  });
});

describe('a typed model never becomes a different model', () => {
  it('CS600 does not become the CS600X', () => {
    // The catalog holds the CS300 and the CS600X. A listener who owns a CS600
    // owns something the catalog does not have, and saying so is correct;
    // reasoning from the CS600X's specifications is not.
    const s = surfaceOf('Assess my system: Amp: Leben CS600 Speakers: KEF LS50 Meta Dac: Chord Qutest');
    expect(s).not.toMatch(/CS600X/);
  });

  it('the CS600X still resolves to itself', () => {
    expect(surfaceOf('Assess my system: Amp: Leben CS600X Speakers: KEF LS50 Meta Dac: Chord Qutest'))
      .toMatch(/CS600X/);
  });
});

describe('an alias is not a physical component', () => {
  it('a brand sharing an editorial profile never names another brand\'s component', () => {
    // Pass Labs and First Watt share one BrandProfile, so the catalog pool for
    // a Pass Labs mention contains First Watt products. The display name was
    // taken from whichever sorted first, putting a FIRST WATT component in the
    // signal path of a listener who typed "Pass Labs XA25".
    // Asserted on the PHYSICAL GRAPH, not on the whole response. The Pass Labs
    // brand profile legitimately carries a First Watt reference link — that is
    // editorial material about a brand family, and the invariant is about what
    // occupies the signal path, not about which names may ever appear.
    const names = namesOf('Assess my system: DAC: Chord Qutest Amp: Pass Labs XA25 Speakers: KEF LS50 Meta');
    expect(names.some((n) => /first watt/i.test(n))).toBe(false);
    expect(names.some((n) => /pass labs/i.test(n))).toBe(true);
  });
});

describe('an under-resolved mention is not a second component', () => {
  it('the listener\'s words and the catalog record of one box are one node', () => {
    // "DeVore O/96" produced BOTH "DeVore Orangutan O/96" (catalog) and
    // "DeVore O/96" (typed), and the listener was asked which of their two
    // identical loudspeakers was in the signal path. Span overlap cannot see
    // this: the canonical name appears nowhere in the message.
    const names = namesOf('Assess my system: Dac: Chord Qutest Amp: Rega Elex-R Speakers: DeVore O/96');
    const devore = names.filter((n) => /devore/i.test(n));
    expect(devore).toHaveLength(1);
  });

  it('but two genuinely distinct products in one role still clarify', () => {
    const r = assess('Assess my system: DAC: Chord Qutest Amp: Pass Labs XA25 Amp: Rega Elex-R Speakers: KEF LS50 Meta');
    expect(r?.kind).toBe('clarification');
    expect(r.clarification.question).toMatch(/Pass Labs XA25/);
    expect(r.clarification.question).toMatch(/Rega Elex-R/);
  });
});

describe('formatting is structure, never identity', () => {
  const ITEMS = ['Dac: Chord Qutest', 'Amp: Rega Elex-R', 'Speakers: KEF LS50 Meta'];
  const FORMATS: Array<(i: string[]) => string> = [
    (i) => `Assess my system: ${i.join(' ')}`,
    (i) => `Assess my system: ${i.map((x, n) => `${n + 1}. ${x}`).join(' ')}`,
    (i) => `Assess my system: ${i.map((x) => `- ${x}`).join(' ')}`,
    (i) => `Assess my system:\n${i.join('\n')}`,
    (i) => `Assess my system: ${i.join(' · ')}`,
  ];

  it('every formatting yields the same canonical graph', () => {
    const graphs = FORMATS.map((f) => [...namesOf(f(ITEMS))].sort().join('|'));
    expect(new Set(graphs).size, JSON.stringify(graphs)).toBe(1);
  });

  it('no list marker or separator survives into a name', () => {
    for (const f of FORMATS) {
      for (const n of namesOf(f(ITEMS))) {
        expect(n, n).not.toMatch(/[·•]|(^|\s)[-–—]($|\s)|(^|\s)\d{1,2}[.)]($|\s)/);
        expect(n).not.toMatch(/assess|my system/i);
      }
    }
  });
});

describe('resource links are built from canonical identity', () => {
  // Contaminated names once reached the marketplace queries — a listener saw
  // `?q=Dcs%20Rossini%20Apex%204.%20Speakers` and `_nkw=ARC+ref+5+2`. Those
  // searches find nothing, and affiliate income depends on them working.
  //
  // The construction already reads the canonical product, so this is a guard
  // against the PARSER regressing rather than against the constructor.
  const links = (q: string): string[] => {
    const r = assess(q);
    const views = r?.systemComponentViews ?? [];
    return views.flatMap((v: { hifiSharkUrl?: string; ebayUrl?: string }) =>
      [v.hifiSharkUrl, v.ebayUrl].filter(Boolean) as string[]);
  };

  const FORMATS = [
    'Assess my system: Dac: Chord Qutest Amp: Rega Elex-R Speakers: KEF LS50 Meta',
    'Assess my system: 1. Dac: Chord Qutest 2. Amp: Rega Elex-R 3. Speakers: KEF LS50 Meta',
    'Assess my system:\n- Dac: Chord Qutest\n- Amp: Rega Elex-R\n- Speakers: KEF LS50 Meta',
  ];

  it('no query carries list markers, separators or turn text', () => {
    for (const f of FORMATS) {
      for (const url of links(f)) {
        const q = decodeURIComponent(url);
        expect(q, q).not.toMatch(/assess|my system/i);
        expect(q, q).not.toMatch(/\d{1,2}\.\s|·|\s[-–—]\s/);
      }
    }
  });

  it('the same system yields the same queries however it was typed', () => {
    const sets = FORMATS.map((f) => [...links(f)].sort().join('|'));
    expect(new Set(sets).size, JSON.stringify(sets)).toBe(1);
  });
});
