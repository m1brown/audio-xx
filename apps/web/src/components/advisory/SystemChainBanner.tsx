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
 * Hardening Phase E-3 — auxiliary annotation. When the optional
 * `auxiliary` parallel boolean array is provided, components flagged as
 * auxiliary (power supplies / clocks / network accessories) are
 * excluded from the main arrow chain and instead listed in a compact
 * "Support" sub-row beneath. The sub-row labels each auxiliary with
 * which signal-path component it supports (chain-adjacent
 * non-auxiliary, walking backward first then forward). When
 * `auxiliary` is absent or all-false, behavior is identical to
 * pre-E-3: every name in the arrow chain, no sub-row.
 *
 * Visual contract: warm-editorial palette only.
 *   - Names: textPrimary at 0.94rem weight 600
 *   - Role labels: textMuted at 0.78rem
 *   - Arrows: accent color, small fontSize, vertically centered
 *   - Flex layout with wrap so long chains reflow gracefully on mobile
 *   - Phase E-3 sub-row: 0.78rem muted text, padded inline with the
 *     main card, no separate border (it is an annotation, not a peer)
 *
 * Pure presentational component. No data manipulation beyond the
 * trivial signal-vs-auxiliary partition; auxiliary detection is the
 * caller's responsibility.
 */

interface SystemChainBannerProps {
  /** Ordered component names. Required. */
  names: string[];
  /**
   * Optional role labels matching the `names` indices. When provided
   * and same length, each role renders beneath its name in muted style.
   */
  roles?: string[];
  /**
   * Hardening Phase E-3 — optional parallel boolean array marking which
   * entries are auxiliary components (power supplies / clocks / network
   * accessories). When provided AND at least one entry is true, the
   * banner partitions: signal-path entries render in the main arrow
   * chain (unchanged from pre-E-3); auxiliary entries render in a
   * compact "Support" sub-row beneath. When `auxiliary` is absent or
   * all-false, the component behaves identically to pre-E-3.
   *
   * Caller computes this array via the same auxiliary detector used in
   * §5 contribution prose. The banner has no role-string awareness of
   * its own.
   */
  auxiliary?: boolean[];
}

/**
 * Phase E-3 — for an auxiliary at `idx`, return the chain-adjacent
 * non-auxiliary component name (the "supported" component). Walks
 * backward first; falls back to forward if no signal-path component
 * exists earlier in the chain. Returns undefined when every entry is
 * auxiliary (pathological).
 */
function findSupportedName(
  idx: number,
  names: string[],
  auxiliary: boolean[],
): string | undefined {
  for (let i = idx - 1; i >= 0; i--) {
    if (!auxiliary[i]) return names[i];
  }
  for (let i = idx + 1; i < names.length; i++) {
    if (!auxiliary[i]) return names[i];
  }
  return undefined;
}

export default function SystemChainBanner({
  names,
  roles,
  auxiliary,
}: SystemChainBannerProps) {
  if (!names || names.length === 0) return null;

  const hasMatchingRoles = roles && roles.length === names.length;
  const hasMatchingAux =
    auxiliary && auxiliary.length === names.length && auxiliary.some(Boolean);

  // Partition indices. When no aux array, all indices stay in the
  // signal-path row (unchanged pre-E-3 behavior).
  const signalIndices: number[] = [];
  const auxIndices: number[] = [];
  for (let i = 0; i < names.length; i++) {
    if (hasMatchingAux && auxiliary![i]) auxIndices.push(i);
    else signalIndices.push(i);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Signal-path arrow chain */}
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
        {signalIndices.map((nameIdx, position) => (
          <React.Fragment key={`signal-${nameIdx}`}>
            {position > 0 && (
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
                {names[nameIdx]}
              </span>
              {hasMatchingRoles && roles![nameIdx] && (
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: COLOR.textMuted,
                    marginTop: '0.1rem',
                    letterSpacing: '0.02em',
                  }}
                >
                  {roles![nameIdx]}
                </span>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
      {/* Phase E-3 — auxiliary support sub-row */}
      {hasMatchingAux && auxIndices.length > 0 && (
        <div
          aria-label="System auxiliary components"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '0.3rem 0.6rem',
            padding: '0 0.25rem',
            fontSize: '0.78rem',
            color: COLOR.textMuted,
            lineHeight: 1.5,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: COLOR.textMuted,
              fontSize: '0.7rem',
            }}
          >
            Support
          </span>
          {auxIndices.map((nameIdx, position) => {
            const supports = findSupportedName(nameIdx, names, auxiliary!);
            return (
              <React.Fragment key={`aux-${nameIdx}`}>
                {position > 0 && (
                  <span aria-hidden="true" style={{ color: COLOR.borderLight }}>
                    ·
                  </span>
                )}
                <span>
                  <span style={{ color: COLOR.textPrimary, fontWeight: 600 }}>
                    {names[nameIdx]}
                  </span>
                  {hasMatchingRoles && roles![nameIdx] && (
                    <span style={{ color: COLOR.textMuted }}>
                      {' '}
                      ({roles![nameIdx]})
                    </span>
                  )}
                  {supports && (
                    <>
                      <span style={{ color: COLOR.textMuted }}> — supports the </span>
                      <span style={{ color: COLOR.textPrimary, fontWeight: 600 }}>
                        {supports}
                      </span>
                    </>
                  )}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
