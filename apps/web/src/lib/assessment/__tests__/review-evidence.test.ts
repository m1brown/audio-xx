import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { composeSystemReview } from '@/lib/artifact/system-review';
import { deriveEvidenceLedger } from '@/lib/artifact/evidence-ledger';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

/**
 * LISTENING EVIDENCE IS FIRST-CLASS EVIDENCE.
 *
 * Removing the unlicensed trait/axis prose must not turn Audio XX into a
 * specification-only product. The prose was wrong because nothing licensed
 * it — not because audio qualities are unmentionable. Where an independent
 * reviewer reports what they heard, under stated conditions, that is real
 * evidence and Audio XX should use it.
 *
 * The discipline is SCOPE, and it has two halves:
 *
 *   the observation keeps the comparison it was made under — "warmer than the
 *   earlier Rossini" never becomes "the Rossini Apex is warm";
 *
 *   an observation about ONE component licenses nothing about another. Two
 *   independently supported adjectives do not establish synergy, cancellation
 *   or counterweight between the boxes that carry them.
 */

const dcs: DossierView = {
  displayName: 'dCS Rossini Apex',
  primary: [],
  secondary: [
    {
      label: 'Stereophile',
      value: 'deeper silences — only direct A/B comparison with earlier Rossini DAC under same setup',
      publication: 'Stereophile',
      sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor',
      sourceClass: 'listening_observation',
    },
    {
      label: 'Stereophile',
      value: 'more saturated colors — only comparison between Ethernet input and USB input',
      publication: 'Stereophile',
      sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor',
      sourceClass: 'listening_observation',
    },
  ],
  gaps: [], hasDetail: true,
} as never;

const butler: DossierView = {
  displayName: 'Butler Monads',
  primary: [{
    label: 'power output',
    value: 'Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms',
    sourceClass: 'maker_published',
  }],
  secondary: [], gaps: [], hasDetail: true,
} as never;

const acora: DossierView = {
  displayName: 'Acora QRC-2',
  primary: [
    { label: 'impedance', value: '4 ohm', sourceClass: 'maker_published' },
    { label: 'power handling', value: '10 W – 250 W', sourceClass: 'maker_published' },
  ],
  secondary: [], gaps: ['the published sensitivity figure'], hasDetail: false,
} as never;

const NATHAN = {
  components: [
    { displayName: 'dCS Rossini Apex', role: 'dac' },
    { displayName: 'Butler Monads', role: 'amplifier' },
    { displayName: 'Acora QRC-2', role: 'speaker' },
  ],
  dossiers: [dcs, butler, acora],
};

const review = () => composeSystemReview(NATHAN).join('\n\n');

describe('listening evidence reaches SYSTEM REVIEW rather than being dropped', () => {
  it('uses the observations at all', () => {
    /*
     * SUPERSEDED FRAME (2026-08-26): the review no longer narrates the
     * evidence methodology; observations reach the reader through the
     * dossiers, and the review's listening section carries only synthesis.
     * What must remain true: a system with observations never simply loses
     * them. The fixture has no synthesis map, so the review is silent on
     * listening — and must not FABRICATE any listening claim either way.
     */
    const out = review();
    expect(out).not.toMatch(/the (dCS )?Rossini Apex is (warm|detailed|smooth|bright)/i);
  });

  it('disappears entirely when no observation is held', () => {
    // The paragraph must be evidence-gated, not decorative — a system with no
    // listening evidence gets no listening paragraph rather than a hedge.
    const out = composeSystemReview({
      ...NATHAN, dossiers: [{ ...dcs, secondary: [] } as never, butler, acora],
    }).join('\n\n');
    expect(out).not.toMatch(/evidence about a DIFFERENCE/);
  });
});

describe('the comparison an observation was made under is preserved', () => {
  const out = review();

  it('refuses the generalisation from comparative to absolute', () => {
    /*
     * The methodology narration ("stated under a specific comparison...") was
     * cut per the convergence brief; the comparative bound now travels INSIDE
     * each statement ("next to the earlier Rossini — a comparison, not an
     * absolute placement"), which the character tests pin. What this review
     * fixture must never do is flatten a comparison into a character claim.
     */
    for (const flattened of [
      /the (dCS )?Rossini Apex is (warm|detailed|smooth|bright)/i,
      /the Rossini Apex sounds/i,
    ]) expect(out, String(flattened)).not.toMatch(flattened);
  });
});

describe('an observation about one component licenses nothing about another', () => {
  const out = review();

  it('licenses nothing about the other components', () => {
    // The explicit sentence was methodology narration and is gone. The
    // INVARIANT stays: no other component acquires character from the dCS
    // observations in this fixture.
    expect(out).not.toMatch(/Leben.{0,40}(warm|detailed|smooth|rich)/i);
    expect(out).not.toMatch(/(Cornwall|speaker).{0,30}(warm|rich|smooth)\b/i);
  });

  it('claims no synergy, cancellation or counterweight', () => {
    // Two independently supported adjectives are two facts, not a relationship.
    for (const unlicensed of [
      /synerg/i, /counterweight/i, /cancel/i, /compensat/i,
      /balances the/i, /offsets the/i, /pairs well/i,
    ]) expect(out, String(unlicensed)).not.toMatch(unlicensed);
  });
});

describe('the ledger distinguishes listening evidence from maker evidence', () => {
  it('classes the publication as an independent review, scoped to its component', () => {
    const ledger = deriveEvidenceLedger([dcs, butler, acora]);
    const entry = ledger.entries.find((e) => /stereophile/i.test(e.label));
    expect(entry).toBeTruthy();
    expect(entry!.evidenceClass).toBe('independent_review');
    // Scope travels with the source: a publication may never appear to support
    // a component it said nothing about.
    expect(entry!.licensedFor).toContain('dCS Rossini Apex');
    expect(entry!.licensedFor).not.toContain('Butler Monads');
    expect(entry!.licensedFor).not.toContain('Acora QRC-2');
  });
});

describe('both evidence regimes reach BOTH assessment paths', () => {
  const page = readFileSync('apps/web/src/app/page.tsx', 'utf8');

  it('the catalogued path reads independent reviews', () => {
    /*
     * The read-only review fetch existed only on the uncatalogued branch, so
     * FRANCE, Magnepan, Leben/Cornwall and the balanced reference never read a
     * single listening observation. The trait prose had been standing in for
     * evidence that was never fetched — which is why removing it left those
     * assessments looking specification-only.
     *
     * The remedy is the evidence, not the prose.
     */
    expect([...page.matchAll(/'\/api\/independent-reviews'/g)].length).toBeGreaterThanOrEqual(2);
  });

  it('and reads them WITHOUT acquiring', () => {
    // `mode: 'read'` returns what the site already holds. A search-backed call
    // per component does not belong inside a listener's wait.
    expect(page).toMatch(/mode: 'read'/);
  });

  it('the catalogued path attaches resources from canonical identity', () => {
    // HiFiShark and eBay were attached only on the uncatalogued branch, so the
    // commercial surface was present for the products Audio XX knew least
    // about and absent for the ones it knew best.
    expect([...page.matchAll(/hifiSharkUrl/g)].length).toBeGreaterThanOrEqual(2);
    expect(page).toMatch(/buildComponentViews\(\s*\n\s*chainComponents/);
  });
});
