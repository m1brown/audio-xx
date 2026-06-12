'use client';

// React imported explicitly for vitest node-env JSX classic transform.
// See BrandAuthorityPreview.tsx for the explanation; same pattern.
import React from 'react';

import { COLOR } from '@/lib/editorial-tokens';

/**
 * Audio XX — Editorial sub-card primitive.
 *
 * Generalized version of the Brand Authority Design Families sub-card
 * pattern. Used inside the System Assessment Artifact for:
 *   - §5 The Components       (one card per component)
 *   - §8 What's Already Working (one card per kept component)
 *   - §9 If You Were to Change Something (one card per upgrade path)
 *
 * Visual contract matches `/brand/[slug]` Design Families cards:
 *   - cardBg fill
 *   - 1px borderLight outer border
 *   - 4px corner radius
 *   - 0.75rem 1rem padding
 *   - bold name + optional muted subtitle + body prose + optional verdict
 *
 * Optional `accentColor` (typically a borderLeft) lets consumers signal
 * priority (e.g. the primary upgrade path in §9 gets the accent strip).
 */

interface EditorialSubCardProps {
  /** Required bold heading for the card. */
  name: string;
  /** Optional muted line beneath the name (role label, step number, etc). */
  subtitle?: string;
  /** Optional body prose. */
  body?: string;
  /** Optional short verdict / closing line in italic muted tone. */
  verdict?: string;
  /**
   * Optional left-border accent. When provided, renders a 3px borderLeft
   * in this color (matching the Brand Authority Quick Identity card
   * pattern). Use COLOR.accent for primary cards, omit for neutral.
   */
  accentColor?: string;
  /**
   * Optional product image URL. When provided, renders a restrained
   * fixed-height thumbnail at the top of the card so each component
   * card carries equal visual weight. Sized for editorial recognition,
   * not for product-catalog browsing. Consumers MUST pass undefined
   * to keep the card text-only (the Commit 6 scope locks images to
   * §5 The Components — §8 *What's Already Working* and §9 *If You
   * Were to Change Something* both omit this prop).
   */
  imageUrl?: string;
  /**
   * Optional educational-navigation link rendered as a small muted
   * line at the card's bottom (Workstream #5 Objective 2 — System
   * Assessment linking). Used by §5 The Components to link a card to
   * its brand's editorial page when the brand resolves to a
   * BrandProfile. Both props must be present for the link to render.
   * Pure presentation — no effect on card content or engine output.
   */
  linkHref?: string;
  linkLabel?: string;
}

export default function EditorialSubCard({
  name,
  subtitle,
  body,
  verdict,
  accentColor,
  imageUrl,
  linkHref,
  linkLabel,
}: EditorialSubCardProps) {
  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        background: COLOR.cardBg,
        border: `1px solid ${COLOR.borderLight}`,
        borderLeft: accentColor ? `3px solid ${accentColor}` : `1px solid ${COLOR.borderLight}`,
        borderRadius: '4px',
      }}
    >
      {imageUrl && (
        <div
          style={{
            // Equal-weight thumbnail strip. Fixed height keeps card
            // rhythm consistent whether an image resolves or not; the
            // graceful no-image case (text-only card) still reads as
            // intentional. Mobile stays comfortable because the strip
            // is height-bounded and the prose below is unchanged.
            marginBottom: '0.6rem',
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: '#FAF6EC',
            borderRadius: '3px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      )}
      <div
        style={{
          fontWeight: 600,
          fontSize: '0.94rem',
          color: COLOR.textPrimary,
          marginBottom: subtitle ? '0.15rem' : '0.25rem',
        }}
      >
        {name}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: '0.82rem',
            color: COLOR.textMuted,
            marginBottom: '0.25rem',
          }}
        >
          {subtitle}
        </div>
      )}
      {body && (
        <p
          style={{
            margin: 0,
            fontSize: '0.91rem',
            lineHeight: 1.6,
            color: COLOR.textSecondary,
          }}
        >
          {body}
        </p>
      )}
      {verdict && (
        <p
          style={{
            margin: '0.3rem 0 0',
            fontSize: '0.88rem',
            lineHeight: 1.55,
            color: COLOR.textMuted,
            fontStyle: 'italic',
          }}
        >
          {verdict}
        </p>
      )}
      {linkHref && linkLabel && (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem' }}>
          <a
            href={linkHref}
            style={{
              color: COLOR.textMuted,
              textDecoration: 'none',
              borderBottom: `1px solid ${COLOR.borderLight}`,
            }}
          >
            {linkLabel}
          </a>
        </p>
      )}
    </div>
  );
}
