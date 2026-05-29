/**
 * Audio XX — shared editorial design tokens.
 *
 * Single source of truth for the warm-editorial palette and section
 * typography used by the Brand Authority artifact surfaces:
 *
 *   - apps/web/src/app/brand/[slug]/page.tsx     (Brand Authority page)
 *   - apps/web/src/components/advisory/BrandAuthorityPreview.tsx (preview tile)
 *
 * Extracted from inlined definitions on both surfaces so future editorial
 * artifact surfaces (System Assessment, Comparison Brief, etc.) consume
 * the same tokens by reference rather than copying values by hand.
 *
 * Pure refactor: every exported value is byte-identical to the inline
 * definitions it replaces. A lock test in
 * `apps/web/src/lib/__tests__/editorial-tokens.test.ts` guards against
 * silent drift.
 *
 * NOTE: `FONTS` and `LAYOUT` constants did not exist as named blocks on
 * either Brand Authority surface at the time of extraction (2026-05-29).
 * They are intentionally NOT exported here — the extraction is scoped to
 * what already existed, in keeping with the "pure refactor" property.
 * Extracting font / layout tokens into this module is a future commit.
 */

import type React from 'react';

/**
 * Brand Authority warm-editorial palette.
 *
 * Values are byte-identical to those previously inlined at:
 *   - apps/web/src/app/brand/[slug]/page.tsx#L33-L41
 *   - apps/web/src/components/advisory/BrandAuthorityPreview.tsx#L38-L45
 *
 * The preview tile previously omitted `border` because it had no
 * consumer of that token; the shared `COLOR` export includes it for
 * completeness. Consumers reference only the keys they need.
 */
export const COLOR = {
  textPrimary: '#1F1D1B',
  textSecondary: '#5C5852',
  textMuted: '#8C877F',
  accent: '#B08D57',
  border: '#D8D2C5',
  borderLight: '#E8E3D7',
  cardBg: '#FFFEFA',
} as const;

/**
 * Section heading eyebrow style.
 *
 * Small-cap accent label that opens every editorial section on
 * `/brand/[slug]`. Values byte-identical to the inline definition at
 * `apps/web/src/app/brand/[slug]/page.tsx#L44-L52`.
 */
export const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: COLOR.accent,
  marginBottom: '0.55rem',
  marginTop: 0,
};

/**
 * Body prose style for editorial section text.
 *
 * Values byte-identical to the inline definition at
 * `apps/web/src/app/brand/[slug]/page.tsx#L54-L59`.
 */
export const proseStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.96rem',
  lineHeight: 1.75,
  color: COLOR.textSecondary,
};
