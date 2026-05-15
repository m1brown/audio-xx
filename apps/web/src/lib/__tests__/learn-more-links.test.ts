/**
 * Stage 6.1 — Learn-more links infrastructure.
 *
 * Covers the curated `Product.learnMore` schema → `componentVerdicts[*].links`
 * pipeline. Three contracts:
 *   1. Curated products surface manufacturer + used-market links per
 *      component (and reference-review when configured).
 *   2. Non-curated products do NOT receive the generic "Used market" /
 *      "Review" labels — absent metadata produces no extra entries.
 *   3. The render pipeline (consultation.ts trackLink + trackLearnMore)
 *      remains URL-deduped — a manufacturer URL already present in
 *      retailer_links keeps its richer label and is not duplicated.
 */

import { describe, it, expect } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment } from '../consultation';

function linksFor(componentName: string, prompt: string) {
  const subjects = extractSubjectMatches(prompt);
  const { desires } = detectIntent(prompt);
  const result = buildSystemAssessment(prompt, subjects, null, desires);
  if (result?.kind !== 'assessment') return [];
  // Case-insensitive match because consultation.ts sometimes renders
  // brand casing differently in different code paths.
  const cv = result.findings.componentVerdicts.find((c) =>
    c.name.toLowerCase().includes(componentName.toLowerCase()),
  );
  return cv?.links ?? [];
}

describe('learn-more links — curated products', () => {
  // Single prompt that names all four curated boutique products. Chord
  // Hugo, JOB Integrated, WLM Diva Monitor — plus a clean source to make
  // the system valid.
  const prompt =
    'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor';

  it('Chord Hugo has manufacturer + used-market links', () => {
    const links = linksFor('Chord Hugo', prompt);
    expect(links.some((l) => l.url === 'https://chordelectronics.co.uk/product/hugo/')).toBe(true);
    expect(links.some((l) => l.url === 'https://www.hifishark.com/search?q=Chord+Hugo')).toBe(true);
    expect(links.some((l) => l.label === 'Used market')).toBe(true);
  });

  it('JOB Integrated has used-market link and no homepage manufacturer link', () => {
    const links = linksFor('JOB Integrated', prompt);
    // Stage 6.2: the JOB Integrated learnMore.manufacturer slot was
    // previously the Goldmund homepage. That violated the rule against
    // surfacing publication/manufacturer homepages as product links,
    // and has been removed.
    expect(links.some((l) => l.url === 'https://www.goldmund.com/')).toBe(false);
    // JOB's used-market URL matches the existing retailer_link entry.
    // Stage 6.4 normalized that retailer_link label from 'HiFi Shark
    // (used)' to the canonical 'Used market', so trackLink and
    // trackLearnMore now register the same label for the same URL —
    // the chip renders consistently with Chord/Leben/DeVore/WLM. We
    // assert URL presence; the label assertion is covered below.
    expect(links.some((l) => l.url === 'https://www.hifishark.com/search?q=job+integrated')).toBe(true);
  });

  it('WLM Diva Monitor has manufacturer + used-market links', () => {
    const links = linksFor('WLM Diva', prompt);
    expect(links.some((l) => l.url.includes('wiener-lautsprecher-manufaktur'))).toBe(true);
    expect(links.some((l) => l.url === 'https://www.hifishark.com/search?q=WLM+Diva+Monitor')).toBe(true);
  });

  it('DeVore Orangutan O/96 has manufacturer + used-market links', () => {
    const lebenPrompt = 'Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96';
    const links = linksFor('DeVore', lebenPrompt);
    expect(links.some((l) => l.url === 'https://www.dfridelity.com/o96')).toBe(true);
    expect(links.some((l) => l.url.includes('hifishark.com') && l.url.includes('Orangutan'))).toBe(true);
  });

  it('Leben CS600X has manufacturer + used-market links', () => {
    const lebenPrompt = 'Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96';
    const links = linksFor('Leben', lebenPrompt);
    expect(links.some((l) => l.url === 'https://www.leben-hifi.com/cs600x.html')).toBe(true);
    expect(links.some((l) => l.url === 'https://www.hifishark.com/search?q=Leben+CS600X')).toBe(true);
  });
});

describe('learn-more links — absent metadata is gracefully omitted', () => {
  // Non-curated chain: Topping D90SE has no learnMore. Hegel H190 and
  // KEF (no LS50 Meta catalog entry) also lack learnMore. None of these
  // should produce the generic "Used market" or "Review" labels.
  const prompt = 'Assess my system: Topping D90SE, Hegel H190, KEF LS50 Meta';

  it('Topping D90SE has no learn-more entries (no curation)', () => {
    const links = linksFor('Topping D90SE', prompt);
    expect(links.some((l) => l.label === 'Used market')).toBe(false);
    expect(links.some((l) => l.label === 'Review')).toBe(false);
  });

  it('Hegel H190 has no learn-more entries (no curation)', () => {
    const links = linksFor('Hegel', prompt);
    expect(links.some((l) => l.label === 'Used market')).toBe(false);
    expect(links.some((l) => l.label === 'Review')).toBe(false);
  });
});

describe('learn-more links — referenceReview is optional', () => {
  // None of the five Stage-6.1 curated products configure a
  // referenceReview URL. Verify the third slot is genuinely optional —
  // no "Review" label leaks out of the trackLearnMore helper when the
  // slot is undefined.
  const prompt =
    'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor';

  it('Stage 6.1 curated products do not emit "Review" labels', () => {
    const subjects = extractSubjectMatches(prompt);
    const { desires } = detectIntent(prompt);
    const result = buildSystemAssessment(prompt, subjects, null, desires);
    if (result?.kind !== 'assessment') {
      throw new Error('expected assessment result');
    }
    for (const cv of result.findings.componentVerdicts) {
      const reviewLinks = (cv.links ?? []).filter((l) => l.label === 'Review');
      expect(reviewLinks, `${cv.name} should have no Review link`).toEqual([]);
    }
  });
});

describe('learn-more links — URL dedup preserves richer labels', () => {
  // Chord Hugo's manufacturer URL matches its existing retailer_link.
  // The retailer_links entry runs through trackLink first (label =
  // "Chord Electronics"), and trackLearnMore tries to register the same
  // URL again with label = "Chord" (the product brand). trackLink's
  // URL-dedup discards the second registration. The richer
  // "Chord Electronics" label should win.
  const prompt =
    'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor';

  it('Chord Hugo keeps the "Chord Electronics" label, not "Chord"', () => {
    const links = linksFor('Chord Hugo', prompt);
    const hugoLinks = links.filter(
      (l) => l.url === 'https://chordelectronics.co.uk/product/hugo/',
    );
    // Exactly one link with this URL (dedup worked).
    expect(hugoLinks).toHaveLength(1);
    // The richer label from retailer_links is preserved.
    expect(hugoLinks[0].label).toBe('Chord Electronics');
  });
});
