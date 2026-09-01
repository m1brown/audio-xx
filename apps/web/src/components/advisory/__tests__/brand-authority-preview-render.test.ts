/**
 * Pass 18 — BrandAuthorityPreview component render contract.
 *
 * Uses `react-dom/server` renderToStaticMarkup to validate the rendered
 * HTML without relying on jsdom or testing-library (neither is wired
 * into this repo's vitest setup — environment: 'node').
 *
 * Locks:
 *   - all four render states (full / no-image / minimal-eligible / image-only)
 *   - `referrerPolicy="no-referrer"` on the hero <img>
 *   - the CTA link points to `/brand/<slug>`
 *   - no reviewer-quote content surfaces
 *   - tagline / quick-identity lines are omitted when their values are absent
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import BrandAuthorityPreview from '../BrandAuthorityPreview';
import type { BrandAuthorityPreview as PreviewData } from '../../../lib/consultation';

function render(preview: PreviewData): string {
  return renderToStaticMarkup(createElement(BrandAuthorityPreview, { preview }));
}

const FULL: PreviewData = {
  brandName: 'Shindo',
  brandSlug: 'shindo',
  tagline: 'Hand-built tube amplifiers voiced for musical truth.',
  designPhilosophy: 'Each circuit designed around its chosen tubes.',
  sonicTendency: 'Dense, harmonically alive, flowing.',
  typicalTradeoff: 'Tonal saturation over transient precision.',
  localHeroImageUrl: '/brand-heroes/shindo-cortese-300b.jpg',
};

describe('BrandAuthorityPreview — full state', () => {
  const html = render(FULL);

  it('renders the brand name', () => {
    expect(html).toContain('Shindo');
  });

  it('renders the tagline', () => {
    expect(html).toContain('Hand-built tube amplifiers');
  });

  it('renders the three quick-identity labels', () => {
    expect(html).toContain('Design:');
    expect(html).toContain('Tendency:');
    expect(html).toContain('Trade-off:');
  });

  it('renders the hero <img> with the local URL', () => {
    expect(html).toContain('src="/brand-heroes/shindo-cortese-300b.jpg"');
  });

  it('sets referrerPolicy="no-referrer" on the hero image', () => {
    // React serializes referrerPolicy as the HTML referrerpolicy attribute.
    expect(html).toMatch(/referrerpolicy="no-referrer"/i);
  });

  it('CTA link points to /brand/shindo', () => {
    expect(html).toContain('href="/brand/shindo"');
  });

  it('CTA text says "Read full brand profile"', () => {
    expect(html).toContain('Read full brand profile');
  });
});

describe('BrandAuthorityPreview — no local image', () => {
  const html = render({ ...FULL, localHeroImageUrl: undefined });

  it('omits the <img> tag entirely (no placeholder)', () => {
    expect(html).not.toContain('<img');
  });

  it('still renders the brand name + tagline + identity + CTA', () => {
    expect(html).toContain('Shindo');
    expect(html).toContain('Hand-built tube amplifiers');
    expect(html).toContain('Design:');
    expect(html).toContain('href="/brand/shindo"');
  });
});

describe('BrandAuthorityPreview — minimal eligible (no tagline, only design + tendency)', () => {
  const minimal: PreviewData = {
    brandName: 'Test',
    brandSlug: 'test',
    designPhilosophy: 'A philosophy.',
    sonicTendency: 'A tendency.',
  };
  const html = render(minimal);

  it('renders identity lines that are present', () => {
    expect(html).toContain('Design:');
    expect(html).toContain('Tendency:');
  });

  it('omits the trade-off line when typicalTradeoff is absent', () => {
    expect(html).not.toContain('Trade-off:');
  });

  it('omits the tagline when absent', () => {
    // No italic tagline paragraph should render.
    expect(html).not.toMatch(/font-style:\s*italic/);
  });

  it('CTA still renders', () => {
    expect(html).toContain('Read full brand profile');
    expect(html).toContain('href="/brand/test"');
  });
});

describe('BrandAuthorityPreview — image-only quick-identity check', () => {
  const noIdentity: PreviewData = {
    brandName: 'TagOnly',
    brandSlug: 'tag-only',
    tagline: 'A tagline-only brand.',
    localHeroImageUrl: '/brand-heroes/tag-only.jpg',
  };
  const html = render(noIdentity);

  it('omits the identity <ul> when no Design/Tendency/Trade-off fields exist', () => {
    expect(html).not.toContain('Design:');
    expect(html).not.toContain('Tendency:');
    expect(html).not.toContain('Trade-off:');
  });

  it('keeps the brand name, tagline, image, and CTA', () => {
    expect(html).toContain('TagOnly');
    expect(html).toContain('tagline-only');
    expect(html).toContain('src="/brand-heroes/tag-only.jpg"');
    expect(html).toContain('href="/brand/tag-only"');
  });
});

describe('BrandAuthorityPreview — F4 / cross-brand surface invariants', () => {
  it('does not render any reviewer-quote markup regardless of input', () => {
    const html = render(FULL);
    // The component has no reviewer-quote branch. Belt-and-braces: ensure
    // no blockquote / cite emerges from the static markup.
    expect(html).not.toContain('<blockquote');
    expect(html).not.toContain('<cite');
  });

  it('aria-label names the queried brand (no cross-brand leak in label)', () => {
    const html = render({ ...FULL, brandName: 'Boenicke' });
    expect(html).toContain('Brand authority preview for Boenicke');
  });
});
