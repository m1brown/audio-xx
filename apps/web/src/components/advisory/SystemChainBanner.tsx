'use client';

// React imported explicitly for vitest node-env JSX classic transform.
import React from 'react';

import { COLOR } from '@/lib/editorial-tokens';

/**
 * Audio XX — System signal-chain banner.
 *
 * Renders the user's signal chain as an arrow-separated row of component
 * names with optional role labels beneath each name. Used inside
 * `SystemHero` as the structural anchor for §1 *Your System*.
 *
 * Visual contract: warm-editorial palette only.
 *   - Names: textPrimary at 0.94rem weight 600
 *   - Role labels: textMuted at 0.78rem
 *   - Arrows: accent color, small fontSize, vertically centered
 *   - Flex layout with wrap so long chains reflow gracefully on mobile
 *
 * Pure presentational component. No data manipulation, no derivation.
 * Renders nothing when `names` is empty.
 */

interface SystemChainBannerProps {
  /** Ordered component names. Required. */
  names: string[];
  /**
   * Optional role labels matching the `names` indices. When provided
   * and same length, each role renders beneath its name in muted style.
   */
  roles?: string[];
}

export default function SystemChainBanner({ names, roles }: SystemChainBannerProps) {
  if (!names || names.length === 0) return null;

  const hasMatchingRoles = roles && roles.length === names.length;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '0.55rem 0.65rem',
        padding: '0.85rem 1rem',
        background: COLOR.cardBg,
        border: `1px solid ${COLOR.borderLight}`,
        borderRadius: '4px',
      }}
    >
      {names.map((name, i) => (
        <React.Fragment key={`${name}-${i}`}>
          {i > 0 && (
            <span
              style={{
                color: COLOR.accent,
                fontSize: '0.95rem',
                fontWeight: 500,
                lineHeight: 1.25,
                alignSelf: hasMatchingRoles ? 'flex-start' : 'center',
                paddingTop: hasMatchingRoles ? '0.1rem' : 0,
              }}
              aria-hidden="true"
            >
              →
            </span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: '0.94rem',
                color: COLOR.textPrimary,
                lineHeight: 1.25,
              }}
            >
              {name}
            </span>
            {hasMatchingRoles && roles![i] && (
              <span
                style={{
                  fontSize: '0.78rem',
                  color: COLOR.textMuted,
                  marginTop: '0.1rem',
                  letterSpacing: '0.02em',
                }}
              >
                {roles![i]}
              </span>
            )}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
