import { describe, it, expect } from 'vitest';
import {
  admitReviewObservation, isSameProduct, isPublicationDomain, claimStatesCondition,
  toEvidenceItem, MAX_QUOTE_CHARS, type ReviewObservation,
} from '../evidence/independent-review';
import { isAdmissible, REQUIRES_QUOTATION, REQUIRES_PUBLICATION } from '../evidence/evidence-types';

/**
 * Independent-review admission contract — slice 1.
 *
 * The fixtures are the four real beta products, and the coverage behind them
 * was determined by searching the approved publications rather than assumed:
 *
 *   dCS Rossini APEX     rich — listening, measurement and positioning all exist
 *   ARC Reference 5      covered, but Stereophile reviewed the SE variant
 *   Butler MONAD A100    no approved coverage at all
 *   Acora QRC-2          siblings heavily reviewed, this model barely
 *
 * Two of the four carry a variant trap and one has nothing. That is why exact
 * scoping is an admission rule and why zero coverage is a passing state.
 */

const base = (over: Partial<ReviewObservation>): Partial<ReviewObservation> => ({
  productKey: 'dcs rossini apex',
  productName: 'dCS Rossini APEX',
  publication: 'Stereophile',
  sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor',
  observationType: 'listening',
  claim: 'Reports greater differentiation of instrumental texture and more space around instruments.',
  retrievedAt: Date.now(),
  ...over,
});

// ── FIXTURE 1 — dCS Rossini APEX: the rich positive ──────────────────
describe('FIXTURE dCS Rossini APEX — rich coverage admits all three types', () => {
  it('admits a listening observation', () => {
    expect(admitReviewObservation('dCS Rossini APEX', base({}))).toEqual({ admitted: true });
  });

  it('admits a measurement the publication made on its own sample', () => {
    expect(admitReviewObservation('dCS Rossini APEX', base({
      observationType: 'measurement',
      claim: 'Measured THD+N of 0.00026% at 1kHz full scale into the 6V output.',
      sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor-measurements',
    }))).toEqual({ admitted: true });
  });

  it('admits a positioning observation', () => {
    expect(admitReviewObservation('dCS Rossini APEX', base({
      observationType: 'positioning',
      claim: 'Listed in Recommended Components.',
      sourceUrl: 'https://www.stereophile.com/content/recommended-components-2025-edition-digital-processors',
    }))).toEqual({ admitted: true });
  });

  it('admits from a second approved publication, separately', () => {
    // Two publications on one product are two observations. Nothing merges
    // them, because merging is what destroys disagreement.
    expect(admitReviewObservation('dCS Rossini APEX', base({
      publication: 'Twittering Machines',
      sourceUrl: 'https://twitteringmachines.com/dcs-apex-next-gen-ring-dacs/',
    }))).toEqual({ admitted: true });
  });

  it('admits a short quotation alongside the paraphrase', () => {
    expect(admitReviewObservation('dCS Rossini APEX', base({
      quote: 'beyond reproach',
    }))).toEqual({ admitted: true });
  });

  it('refuses a quotation long enough to be reproduction', () => {
    const v = admitReviewObservation('dCS Rossini APEX', base({
      quote: 'x'.repeat(MAX_QUOTE_CHARS + 1),
    }));
    expect(v).toMatchObject({ admitted: false, reason: 'quote_too_long' });
  });
});

// ── FIXTURE 2 — ARC Reference 5: variant + condition ─────────────────
describe('FIXTURE ARC Reference 5 — the SE is a DIFFERENT product', () => {
  const REF5 = 'Audio Research Reference 5';

  it('admits The Absolute Sound on the Reference 5 itself', () => {
    expect(admitReviewObservation(REF5, base({
      productKey: 'audio research reference 5',
      productName: 'Audio Research Reference 5',
      publication: 'The Absolute Sound',
      sourceUrl: 'https://www.theabsolutesound.com/articles/audio-research-reference-5-linestage-preamplifier/',
      claim: 'Describes a darker balance with denser tone colour and tighter imaging than the Reference 3.',
    }))).toEqual({ admitted: true });
  });

  it('REJECTS Stereophile’s Reference 5 SE review as evidence for the Reference 5', () => {
    // Not weaker evidence. A different product: doubled power-supply
    // capacitance, Teflon coupling capacitors.
    const v = admitReviewObservation(REF5, base({
      productKey: 'audio research reference 5',
      productName: 'Audio Research Reference 5 SE',
      sourceUrl: 'https://www.stereophile.com/content/audio-research-reference-5-se-line-preamplifier',
      claim: 'Describes it as something of a best buy among super-preamps.',
    }));
    expect(v).toMatchObject({ admitted: false, reason: 'different_product' });
  });

  it('rejects the reverse direction too', () => {
    expect(admitReviewObservation('Audio Research Reference 5 SE', base({
      productName: 'Audio Research Reference 5',
    }))).toMatchObject({ admitted: false, reason: 'different_product' });
  });

  it('admits a conditioned observation WITH its condition', () => {
    expect(admitReviewObservation(REF5, base({
      productKey: 'audio research reference 5',
      productName: 'Audio Research Reference 5',
      publication: 'The Absolute Sound',
      sourceUrl: 'https://www.theabsolutesound.com/articles/audio-research-reference-5-linestage-preamplifier/',
      claim: 'Reports the presentation opens up markedly after roughly 500 hours of use.',
      condition: { kind: 'break_in', description: 'after approximately 500 hours' },
    }))).toEqual({ admitted: true });
  });

  it('REJECTS the same observation with its condition dropped', () => {
    // The claim still states the condition in prose while the data no longer
    // carries it — storing that would record a claim the publication never
    // made unqualified.
    const v = admitReviewObservation(REF5, base({
      productKey: 'audio research reference 5',
      productName: 'Audio Research Reference 5',
      publication: 'The Absolute Sound',
      sourceUrl: 'https://www.theabsolutesound.com/articles/audio-research-reference-5-linestage-preamplifier/',
      claim: 'Reports the presentation opens up markedly after roughly 500 hours of use.',
    }));
    expect(v).toMatchObject({ admitted: false, reason: 'condition_dropped' });
  });

  it('rejects a condition with no description', () => {
    expect(admitReviewObservation('dCS Rossini APEX', base({
      condition: { kind: 'break_in', description: '   ' },
    }))).toMatchObject({ admitted: false, reason: 'empty_condition' });
  });

  it('detects the conditional constructions that must carry data', () => {
    for (const c of [
      'Opens up after 500 hours.',
      'Only with the balanced outputs engaged.',
      'When driven by a high-current amplifier it tightens.',
      'Improves once broken in.',
      'At low listening levels the bass thins.',
    ]) expect(claimStatesCondition(c)).toBe(true);
    expect(claimStatesCondition('Reports a darker tonal balance than the Reference 3.')).toBe(false);
  });

  it('admits a cross-variant claim only when the publication says so', () => {
    expect(admitReviewObservation(REF5, base({
      productName: 'Audio Research Reference 5 SE',
      observationType: 'positioning',
      claim: 'States the Reference line as a whole occupies the super-preamp segment.',
      appliesAcrossVariants: true,
    }))).toEqual({ admitted: true });
  });
});

// ── FIXTURE 3 — Butler MONAD A100: zero coverage is a PASS ───────────
describe('FIXTURE Butler MONAD A100 — zero approved coverage is a passing state', () => {
  it('admits nothing, because no approved publication covered it', () => {
    // The whitelist is not widened to eliminate zeros. An empty result is the
    // correct answer, not a gap to fill.
    const observations: Partial<ReviewObservation>[] = [];
    const admitted = observations.filter(
      (o) => admitReviewObservation('Butler MONAD A100', o).admitted);
    expect(admitted).toHaveLength(0);
  });

  it('rejects a non-approved publication that did cover it', () => {
    expect(admitReviewObservation('Butler MONAD A100', base({
      productKey: 'butler monad a100', productName: 'Butler MONAD A100',
      publication: 'Some Enthusiast Blog',
      sourceUrl: 'https://example.com/butler-monad-a100',
    }))).toMatchObject({ admitted: false, reason: 'publication_not_approved' });
  });

  it('REJECTS 6moons, whose exclusion is its absence from the whitelist', () => {
    expect(admitReviewObservation('Butler MONAD A100', base({
      productKey: 'butler monad a100', productName: 'Butler MONAD A100',
      publication: '6moons',
      sourceUrl: 'https://6moons.com/audioreviews/butler/monad.html',
    }))).toMatchObject({ admitted: false, reason: 'publication_not_approved' });
  });
});

// ── FIXTURE 4 — Acora QRC-2: sibling exclusion ───────────────────────
describe('FIXTURE Acora QRC-2 — siblings are different products, not weak evidence', () => {
  const QRC2 = 'Acora Acoustics QRC-2';

  it.each([
    ['Acora Acoustics SRB', 'https://www.stereophile.com/content/acora-srb-loudspeaker'],
    ['Acora Acoustics VRC', 'https://www.theabsolutesound.com/articles/acora-acoustics-vrc-loudspeaker/'],
    ['Acora Acoustics SRC-1', 'https://www.theabsolutesound.com/articles/acora-acoustics-src-1-loudspeaker/'],
    ['Acora Acoustics MRC-2', 'https://www.soundstageultra.com/index.php/equipment-menu/1284-acora-acoustics-mrc-2-loudspeaker'],
  ])('rejects the %s review', (productName, sourceUrl) => {
    const publication = sourceUrl.includes('stereophile') ? 'Stereophile'
      : sourceUrl.includes('soundstage') ? 'SoundStage!' : 'The Absolute Sound';
    expect(admitReviewObservation(QRC2, base({
      productKey: 'acora qrc-2', productName, publication, sourceUrl,
      claim: 'Describes a smooth presentation from the stone enclosure.',
    }))).toMatchObject({ admitted: false, reason: 'different_product' });
  });

  it('admits a genuine QRC-2 observation when one exists', () => {
    expect(admitReviewObservation(QRC2, base({
      productKey: 'acora qrc-2',
      productName: 'Acora Acoustics QRC-2',
      publication: 'SoundStage!',
      sourceUrl: 'https://www.soundstageultra.com/index.php/equipment-menu/1284-acora-acoustics-mrc-2-loudspeaker',
      claim: 'Reports the QRC-2 sounding larger in scale than the MRC-2 without compression.',
    }))).toEqual({ admitted: true });
  });
});

// ── Provenance and mapping ───────────────────────────────────────────
describe('provenance rules', () => {
  it('rejects a mirror carrying the publication’s text', () => {
    // The manualzz.com lesson from the manufacturer regime.
    expect(isPublicationDomain('https://manualzz.com/doc/stereophile-rossini', 'Stereophile'))
      .toBe(false);
    expect(isPublicationDomain(
      'https://www.stereophile.com/content/dcs-rossini-apex-da-processor', 'Stereophile')).toBe(true);
  });

  it('requires attribution rather than quotation for this class', () => {
    expect(REQUIRES_QUOTATION.has('manufacturer')).toBe(true);
    expect(REQUIRES_QUOTATION.has('independent_review')).toBe(false);
    expect(REQUIRES_PUBLICATION.has('independent_review')).toBe(true);
  });

  it('maps to an admissible EvidenceItem with no quote at all', () => {
    const item = toEvidenceItem(base({}) as ReviewObservation);
    expect(item.evidenceClass).toBe('independent_review');
    expect(item.tier).toBe('independent_review');
    expect(item.scope).toBe('product');
    expect(item.attribution?.quotedText).toBe('');
    expect(isAdmissible(item)).toBe(true);
  });

  it('refuses an item with no publication', () => {
    const item = toEvidenceItem(base({}) as ReviewObservation);
    expect(isAdmissible({ ...item, attribution: { ...item.attribution!, publication: undefined } }))
      .toBe(false);
  });

  it('carries the condition INSIDE the value, so no consumer can drop it', () => {
    const item = toEvidenceItem(base({
      claim: 'Opens up markedly after roughly 500 hours.',
      condition: { kind: 'break_in', description: 'after approximately 500 hours' },
    }) as ReviewObservation);
    expect(item.value).toContain('break_in');
    expect(item.value).toContain('500 hours');
  });

  it('stores no score, average or consensus field', () => {
    const item = toEvidenceItem(base({}) as ReviewObservation);
    for (const k of ['score', 'rating', 'average', 'consensus', 'stars'])
      expect(Object.keys(item)).not.toContain(k);
  });
});

describe('exact-product matching', () => {
  it('matches the same product across case and spacing', () => {
    expect(isSameProduct('dCS Rossini Apex', 'dCS Rossini APEX')).toBe(true);
  });

  it('treats an extra designation token as a different product', () => {
    expect(isSameProduct('Audio Research Reference 5', 'Audio Research Reference 5 SE')).toBe(false);
  });

  it('distinguishes models that differ by one character', () => {
    expect(isSameProduct('Acora Acoustics QRC-2', 'Acora Acoustics MRC-2')).toBe(false);
    expect(isSameProduct('Acora Acoustics QRC-2', 'Acora Acoustics QRC-1')).toBe(false);
  });
});
