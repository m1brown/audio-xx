/**
 * Pass 19 — editorial-tokens lock test.
 *
 * Guards against silent palette drift in the shared warm-editorial
 * design tokens consumed by:
 *   - Brand Authority page (`app/brand/[slug]/page.tsx`)
 *   - Brand Authority Preview tile (`components/advisory/BrandAuthorityPreview.tsx`)
 *   - Future editorial artifact surfaces (System Assessment, etc.)
 *
 * The exact values are byte-locked. Any change to the COLOR palette,
 * the sectionHeadingStyle, or the proseStyle must be intentional and
 * accompanied by an update to this test plus a visual review across
 * all consuming surfaces.
 *
 * This test does NOT validate visual rendering — that's covered by
 * the BrandAuthorityPreview render tests and (planned) System
 * Assessment artifact render tests. It locks the design contract.
 */

import { describe, it, expect } from 'vitest';

import { COLOR, EDITORIAL, sectionHeadingStyle, proseStyle } from '../editorial-tokens';

describe('editorial-tokens: COLOR palette', () => {
  it('locks all 7 color tokens to exact values', () => {
    expect(COLOR).toEqual({
      textPrimary: '#1F1D1B',
      textSecondary: '#5C5852',
      textMuted: '#8C877F',
      accent: '#B08D57',
      border: '#D8D2C5',
      borderLight: '#E8E3D7',
      cardBg: '#FFFEFA',
    });
  });

  it('uses warm near-black text primary (not cool slate)', () => {
    // Cross-check with the design-system gap audit:
    // chat surface uses #111827 (cool slate); the warm-editorial
    // tokens must NOT regress to that palette.
    expect(COLOR.textPrimary).not.toBe('#111827');
    expect(COLOR.textPrimary.startsWith('#1')).toBe(true);
  });

  it('uses warm gold-tan accent (not navy)', () => {
    // Cross-check: AdvisoryProductCard uses #1F3A5F navy as its accent.
    // The warm-editorial tokens must NOT regress to that.
    expect(COLOR.accent).not.toBe('#1F3A5F');
    expect(COLOR.accent).toBe('#B08D57');
  });

  it('uses cream card background (not pure white)', () => {
    // Cross-check: pure white #FFFFFF is the cool-slate card-bg.
    // The warm-editorial cards must lift off the warm page bg.
    expect(COLOR.cardBg).not.toBe('#FFFFFF');
    expect(COLOR.cardBg).toBe('#FFFEFA');
  });
});

describe('editorial-tokens: EDITORIAL palette (canonical artifact palette)', () => {
  it('locks all canonical editorial tokens to exact values', () => {
    // Source of truth: apps/web/src/app/artifact/artifact.css.
    // The first four are the core artifact palette (#L22-L25).
    // The remainder are derived editorial tokens consumed by the
    // homepage and (incrementally) every other editorial surface
    // under the 2026-06-30 Design Doctrine — every consumer must
    // reference these constants by name, never inline hex.
    expect(EDITORIAL).toEqual({
      paper: '#FCF8EE',
      ink: '#1B1A18',
      inkMuted: '#6B6862',
      accent: '#A8231B',
      hairline: 'rgba(27, 26, 24, 0.14)',
      faint: '#9E9A93',
      buttonHover: '#000000',
      measure: '40rem',
      narrow: '42rem',
    });
  });

  it('uses deliberate cream paper (clearly off-white, not pure white)', () => {
    // Pure #FFFFFF reads as a SaaS card. The Brand Authority cardBg
    // (#FFFEFA) is a near-white variant. The canonical paper is a
    // deliberate cream — clearly off-white so the page reads as a
    // publication surface against browser chrome, not as an
    // application background.
    //
    // 2026-06-30 → 2026-07-01: paper iterated four times — #FBFAF6
    // (too white) → #F5EFE2 (too saturated) → #FAF5EA (still slightly
    // dark) → #FCF8EE (lighter cream, close to traditional editorial
    // paper). Lockstep with --ground in artifact.css and body bg in
    // globals.css.
    expect(EDITORIAL.paper).not.toBe('#FFFFFF');
    expect(EDITORIAL.paper).not.toBe(COLOR.cardBg);
    expect(EDITORIAL.paper).toBe('#FCF8EE');
  });

  it('uses near-black ink (not pure black)', () => {
    // Pure #000000 reads as a print-grade cold value. The canonical
    // ink is warmer and softer — a near-black tuned for warm paper.
    expect(EDITORIAL.ink).not.toBe('#000000');
    expect(EDITORIAL.ink).toBe('#1B1A18');
  });

  it('uses restrained editorial red (not bright red, not warm gold)', () => {
    // Bright #FF0000 / #E63946 read as alarm. The Brand Authority
    // accent (#B08D57) is warm gold, not red. The canonical accent
    // is the artifact's deeper editorial red.
    expect(EDITORIAL.accent).not.toBe('#FF0000');
    expect(EDITORIAL.accent).not.toBe(COLOR.accent);
    expect(EDITORIAL.accent).toBe('#A8231B');
  });
});

describe('editorial-tokens: sectionHeadingStyle', () => {
  it('locks the uppercase eyebrow style', () => {
    expect(sectionHeadingStyle).toEqual({
      fontSize: '0.8rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: COLOR.accent,
      marginBottom: '0.55rem',
      marginTop: 0,
    });
  });

  it('uses the warm accent color (not the cool slate eyebrow color)', () => {
    // Cross-check with the design-system gap audit:
    // AdvisorySection uses #96875e (third distinct muted brown) as
    // its eyebrow color today. The shared editorial token must use
    // the canonical accent.
    expect(sectionHeadingStyle.color).toBe(COLOR.accent);
    expect(sectionHeadingStyle.color).not.toBe('#96875e');
  });

  it('uses 0.08em letter-spacing (not the chat surface 0.07em)', () => {
    // Cross-check with AdvisorySection.tsx default eyebrow: 0.07em.
    // The Brand Authority eyebrow tracking is 0.08em.
    expect(sectionHeadingStyle.letterSpacing).toBe('0.08em');
  });
});

describe('editorial-tokens: proseStyle', () => {
  it('locks the editorial body prose style', () => {
    expect(proseStyle).toEqual({
      margin: 0,
      fontSize: '0.96rem',
      lineHeight: 1.75,
      color: COLOR.textSecondary,
    });
  });

  it('uses lighter prose density than the chat surface', () => {
    // Cross-check with AdvisoryMessage FONTS.bodySize (1.02rem).
    // Brand Authority intentionally renders lighter prose.
    expect(proseStyle.fontSize).toBe('0.96rem');
    expect(proseStyle.lineHeight).toBe(1.75);
  });
});
