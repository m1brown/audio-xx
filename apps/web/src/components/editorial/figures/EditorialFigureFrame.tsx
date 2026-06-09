/**
 * Audio XX — EditorialFigureFrame primitive.
 *
 * Wraps any Editorial Figure (image, signal-chain, future kinds) with
 * a consistent visual frame: subtle border, soft cardBg background,
 * generous padding, optional title row, mandatory caption.
 *
 * The frame is the visual unit. The doctrine rule is:
 *
 *   "Every figure must justify its existence by helping the reader
 *    understand something that would otherwise require substantial
 *    explanation."
 *
 * The caption answers "why does this figure exist?" — and the frame
 * enforces that the caption is always present. The schema makes
 * `caption` non-optional on every figure kind for the same reason.
 *
 * Pure presentation. No client-side state. Server-component-safe.
 */

import React from 'react';
import { COLOR, proseStyle } from '@/lib/editorial-tokens';

interface EditorialFigureFrameProps {
  /** Optional figure heading (typically the title of the chain, map, or image's role). */
  title?: string;
  /**
   * Optional small italic clarification rendered between the title
   * and the figure body. Used when the title alone leaves a possible
   * misreading on the table — e.g. the SET system signal-chain figure
   * uses the subtitle "The SET system, not the SET topology" to keep
   * the reader from mistaking the system chain for a topology diagram.
   */
  subtitle?: string;
  /** Editorial caption (required). Magazine-style — names the WHY, not just the WHAT. */
  caption: string;
  /** The figure body. */
  children: React.ReactNode;
}

export function EditorialFigureFrame({ title, subtitle, caption, children }: EditorialFigureFrameProps) {
  return (
    <figure
      style={{
        margin: '0 0 1.25rem',
        padding: '1.1rem 1.1rem 1rem',
        background: COLOR.cardBg,
        border: `1px solid ${COLOR.border}`,
        borderRadius: '8px',
      }}
    >
      {title && (
        <h3
          style={{
            margin: '0 0 0.4rem',
            fontSize: '0.78rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: COLOR.textMuted,
          }}
        >
          {title}
        </h3>
      )}
      {subtitle && (
        <p
          style={{
            margin: '0 0 0.85rem',
            fontSize: '0.82rem',
            color: COLOR.textSecondary,
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </p>
      )}
      <div>{children}</div>
      <figcaption
        style={{
          ...proseStyle,
          marginTop: '0.9rem',
          fontSize: '0.88rem',
          color: COLOR.textSecondary,
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}
      >
        {caption}
      </figcaption>
    </figure>
  );
}
