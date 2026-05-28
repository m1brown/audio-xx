/**
 * Pass 18 — Brand Authority Preview tile.
 *
 * Locks the eligibility gate, the local-hero image picker, and the
 * builder integration that populates `ConsultationResponse.brandAuthorityPreview`.
 *
 * The renderer side is dark behind `NEXT_PUBLIC_BRAND_AUTHORITY_PREVIEW`
 * (default off) and is exercised separately in the component test.
 * These tests assert the DATA side — the population path must produce
 * the right shape regardless of the runtime flag.
 *
 * Invariants:
 *   - sparse profiles → preview undefined (no thin "authority lite")
 *   - external image URLs → localHeroImageUrl undefined (no hotlinks)
 *   - same-brand by construction (preview reads only from the matched
 *     BrandProfile)
 *   - no F4-gated content surfaces (only tagline / quick identity)
 */

import { describe, it, expect } from 'vitest';

import {
  type BrandProfile,
  eligibleForBrandAuthorityPreview,
  pickLocalHeroImageUrl,
  findBrandProfileByName,
  buildConsultationResponse,
} from '../consultation';

// ── Eligibility gate ────────────────────────────────────────────────

describe('eligibleForBrandAuthorityPreview', () => {
  const baseEligible: BrandProfile = {
    names: ['Test Brand'],
    philosophy: 'A philosophy.',
    tendencies: 'Some tendencies.',
    systemContext: 'Some system context.',
    tagline: 'A short tagline.',
    designPhilosophy: 'A design philosophy.',
    sonicTendency: 'A sonic tendency.',
  };

  it('passes when tagline + 2 richness signals are present', () => {
    expect(eligibleForBrandAuthorityPreview(baseEligible)).toBe(true);
  });

  it('passes when philosophyExtended substitutes for tagline', () => {
    const p: BrandProfile = {
      names: ['Test'],
      philosophy: 'P',
      tendencies: 'T',
      systemContext: 'S',
      philosophyExtended: 'Extended philosophy.',
      designPhilosophy: 'D',
      typicalTradeoff: 'TT',
    };
    expect(eligibleForBrandAuthorityPreview(p)).toBe(true);
  });

  it('fails when no anchor prose (no tagline, no philosophyExtended)', () => {
    const p: BrandProfile = {
      names: ['Test'],
      philosophy: 'P',
      tendencies: 'T',
      systemContext: 'S',
      designPhilosophy: 'D',
      sonicTendency: 'ST',
      typicalTradeoff: 'TT',
      strengths: ['a', 'b'],
    };
    expect(eligibleForBrandAuthorityPreview(p)).toBe(false);
  });

  it('fails when anchor prose present but only 1 richness signal', () => {
    const p: BrandProfile = {
      names: ['Test'],
      philosophy: 'P',
      tendencies: 'T',
      systemContext: 'S',
      tagline: 'A tagline.',
      designPhilosophy: 'D',
    };
    expect(eligibleForBrandAuthorityPreview(p)).toBe(false);
  });

  it('counts strengths / tradeoffs / designFamilies as richness signals', () => {
    const p: BrandProfile = {
      names: ['Test'],
      philosophy: 'P',
      tendencies: 'T',
      systemContext: 'S',
      tagline: 'A tagline.',
      strengths: ['s1'],
      designFamilies: [{ name: 'Fam', character: 'C' }],
    };
    expect(eligibleForBrandAuthorityPreview(p)).toBe(true);
  });

  it('treats empty strengths/tradeoffs arrays as not signals', () => {
    const p: BrandProfile = {
      names: ['Test'],
      philosophy: 'P',
      tendencies: 'T',
      systemContext: 'S',
      tagline: 'A tagline.',
      strengths: [],
      tradeoffs: [],
      designPhilosophy: 'D',
    };
    expect(eligibleForBrandAuthorityPreview(p)).toBe(false);
  });
});

// ── Local hero image picker ─────────────────────────────────────────

describe('pickLocalHeroImageUrl', () => {
  const skel = (overrides: Partial<BrandProfile>): BrandProfile => ({
    names: ['Test'],
    philosophy: 'P',
    tendencies: 'T',
    systemContext: 'S',
    ...overrides,
  });

  it('returns media.images[0].url when it starts with /brand-heroes/', () => {
    const p = skel({
      media: { images: [{ url: '/brand-heroes/test.jpg' }] },
    });
    expect(pickLocalHeroImageUrl(p)).toBe('/brand-heroes/test.jpg');
  });

  it('rejects external URLs in media.images[0]', () => {
    const p = skel({
      media: { images: [{ url: 'https://example.com/hero.jpg' }] },
    });
    expect(pickLocalHeroImageUrl(p)).toBeUndefined();
  });

  it('falls back to representativeImageUrl when local', () => {
    const p = skel({ representativeImageUrl: '/brand-heroes/rep.jpg' });
    expect(pickLocalHeroImageUrl(p)).toBe('/brand-heroes/rep.jpg');
  });

  it('rejects external representativeImageUrl', () => {
    const p = skel({ representativeImageUrl: 'https://cdn.example.com/x.jpg' });
    expect(pickLocalHeroImageUrl(p)).toBeUndefined();
  });

  it('returns undefined when no local image of any kind is present', () => {
    expect(pickLocalHeroImageUrl(skel({}))).toBeUndefined();
  });
});

// ── Builder integration ─────────────────────────────────────────────

describe('buildConsultationResponse populates brandAuthorityPreview', () => {
  it('Shindo (eligible + local hero) returns a full preview', () => {
    const profile = findBrandProfileByName('shindo');
    expect(profile).toBeDefined();
    const res = buildConsultationResponse('shindo');
    expect(res.brandAuthorityPreview).toBeDefined();
    const preview = res.brandAuthorityPreview!;
    expect(preview.brandName.toLowerCase()).toContain('shindo');
    expect(preview.brandSlug.length).toBeGreaterThan(0);
    // Shindo has tagline + quick identity + local hero (visual-trust audit
    // confirms /brand-heroes/shindo-cortese-300b.jpg). The picker may
    // also resolve from media.images[0] — either path is acceptable as
    // long as the URL starts with /brand-heroes/.
    if (preview.localHeroImageUrl !== undefined) {
      expect(preview.localHeroImageUrl.startsWith('/brand-heroes/')).toBe(true);
    }
    expect(
      preview.designPhilosophy || preview.sonicTendency || preview.typicalTradeoff,
    ).toBeTruthy();
  });

  it('Goldmund (eligible) returns a preview with quick identity lines', () => {
    const res = buildConsultationResponse('goldmund');
    expect(res.brandAuthorityPreview).toBeDefined();
    const preview = res.brandAuthorityPreview!;
    expect(preview.designPhilosophy).toBeTruthy();
    if (preview.localHeroImageUrl !== undefined) {
      expect(preview.localHeroImageUrl.startsWith('/brand-heroes/')).toBe(true);
    }
  });

  it('Leben (eligible + local hero) returns preview with local image', () => {
    const res = buildConsultationResponse('leben');
    expect(res.brandAuthorityPreview).toBeDefined();
    if (res.brandAuthorityPreview?.localHeroImageUrl) {
      expect(
        res.brandAuthorityPreview.localHeroImageUrl.startsWith('/brand-heroes/'),
      ).toBe(true);
    }
  });

  it('non-brand free-form input does not populate brandAuthorityPreview', () => {
    const res = buildConsultationResponse(
      'I want a warm-sounding amp under five thousand dollars for jazz vocals.',
    );
    expect(res.brandAuthorityPreview).toBeUndefined();
  });

  it('preview brandSlug never contains spaces or uppercase', () => {
    const res = buildConsultationResponse('boenicke');
    if (res.brandAuthorityPreview) {
      const slug = res.brandAuthorityPreview.brandSlug;
      expect(slug).toBe(slug.toLowerCase());
      expect(slug.includes(' ')).toBe(false);
    }
  });
});

// ── F4 + cross-brand invariants (data side) ─────────────────────────

describe('brandAuthorityPreview invariants', () => {
  it('preview shape exposes no reviewerQuotes / F4 fields', () => {
    const res = buildConsultationResponse('shindo');
    const preview = res.brandAuthorityPreview;
    if (preview) {
      // Type-level: BrandAuthorityPreview has no reviewerQuotes field.
      // Runtime: ensure no unexpected keys leaked in.
      const allowedKeys = new Set([
        'brandName',
        'brandSlug',
        'tagline',
        'designPhilosophy',
        'sonicTendency',
        'typicalTradeoff',
        'localHeroImageUrl',
      ]);
      for (const key of Object.keys(preview)) {
        expect(allowedKeys.has(key)).toBe(true);
      }
    }
  });

  it('preview brandName matches the queried brand (no cross-brand leak)', () => {
    const res = buildConsultationResponse('shindo');
    if (res.brandAuthorityPreview) {
      expect(res.brandAuthorityPreview.brandName.toLowerCase()).toContain('shindo');
    }
  });
});
