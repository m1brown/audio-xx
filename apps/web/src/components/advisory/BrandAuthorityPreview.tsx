'use client';

// React is imported explicitly so the component compiles cleanly under
// the vitest node environment (which uses the classic JSX transform via
// esbuild). Production builds go through Next.js's transform and don't
// require this import, but the cost of keeping it is zero.
import React from 'react';
import Link from 'next/link';
import type { BrandAuthorityPreview as BrandAuthorityPreviewData } from '@/lib/consultation';
import { COLOR } from '@/lib/editorial-tokens';

/**
 * Audio XX — Brand Authority Preview tile.
 *
 * Rendered above the conversational brand response when:
 *   1. `NEXT_PUBLIC_BRAND_AUTHORITY_PREVIEW=on`, AND
 *   2. The consultation builder populated `brandAuthorityPreview`
 *      (eligibility gate already passed inside `buildBrandConsultation`
 *      / `buildKnowledgeBrandConsultation`).
 *
 * Surface guarantees:
 *   - Local hero image only. The builder rejects any URL that does not
 *     begin with `/brand-heroes/`; this component does NOT re-validate
 *     but renders `<img>` with `referrerPolicy="no-referrer"` as a
 *     belt-and-braces measure.
 *   - No reviewer quotes, no F4-gated content, no external imagery.
 *   - Tile is an additive sibling — the existing chat response continues
 *     to render below unchanged.
 *
 * Visual language: same accent / borderLight palette used by the
 * Quick Identity card on `/brand/[slug]`, so the tile reads as a
 * trailer for the full authority page.
 */

interface BrandAuthorityPreviewProps {
  preview: BrandAuthorityPreviewData;
}

// COLOR previously inlined here as a 6-key subset. Now imported from the
// shared editorial-tokens module (single source of truth across the
// Brand Authority page and this preview tile). All referenced keys
// (textPrimary, textSecondary, textMuted, accent, borderLight, cardBg)
// are byte-identical to the previous inline values.

export default function BrandAuthorityPreview({ preview }: BrandAuthorityPreviewProps) {
  const {
    brandName,
    brandSlug,
    tagline,
    designPhilosophy,
    sonicTendency,
    typicalTradeoff,
    localHeroImageUrl,
  } = preview;

  const hasIdentity = !!(designPhilosophy || sonicTendency || typicalTradeoff);

  return (
    <aside
      aria-label={`Brand authority preview for ${brandName}`}
      style={{
        marginBottom: '1.25rem',
        padding: '1rem 1.15rem',
        background: COLOR.cardBg,
        border: `1px solid ${COLOR.borderLight}`,
        borderLeft: `3px solid ${COLOR.accent}`,
        borderRadius: '4px',
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      {localHeroImageUrl && (
        <div
          style={{
            flex: '0 0 auto',
            width: '140px',
            maxHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FFFDF7',
            border: `1px solid ${COLOR.borderLight}`,
            borderRadius: '4px',
            padding: '0.4rem',
          }}
        >
          <img
            src={localHeroImageUrl}
            alt={brandName}
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{
              maxWidth: '100%',
              maxHeight: '100px',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      )}

      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: COLOR.textPrimary,
            lineHeight: 1.25,
          }}
        >
          {brandName}
        </div>

        {tagline && (
          <p
            style={{
              margin: '0.25rem 0 0',
              fontSize: '0.92rem',
              fontStyle: 'italic',
              color: COLOR.textSecondary,
              lineHeight: 1.4,
            }}
          >
            {tagline}
          </p>
        )}

        {hasIdentity && (
          <ul
            style={{
              margin: '0.6rem 0 0',
              padding: 0,
              listStyle: 'none',
              fontSize: '0.88rem',
              lineHeight: 1.55,
              color: COLOR.textSecondary,
            }}
          >
            {designPhilosophy && (
              <li style={{ marginBottom: '0.2rem' }}>
                <span style={{ fontWeight: 600, color: COLOR.textPrimary }}>Design:</span>{' '}
                {designPhilosophy}
              </li>
            )}
            {sonicTendency && (
              <li style={{ marginBottom: '0.2rem' }}>
                <span style={{ fontWeight: 600, color: COLOR.textPrimary }}>Tendency:</span>{' '}
                {sonicTendency}
              </li>
            )}
            {typicalTradeoff && (
              <li>
                <span style={{ fontWeight: 600, color: COLOR.textPrimary }}>Trade-off:</span>{' '}
                {typicalTradeoff}
              </li>
            )}
          </ul>
        )}

        <div style={{ marginTop: '0.75rem' }}>
          <Link
            href={`/brand/${brandSlug}`}
            style={{
              fontSize: '0.88rem',
              color: COLOR.accent,
              textDecoration: 'none',
              borderBottom: `1px solid ${COLOR.borderLight}`,
              paddingBottom: '1px',
            }}
          >
            Read full brand profile &rarr;
          </Link>
        </div>
      </div>
    </aside>
  );
}
