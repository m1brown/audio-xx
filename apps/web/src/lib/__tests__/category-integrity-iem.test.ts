import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { extractDesires } from '../intent';
import { reason } from '../reasoning';
import { HEADPHONE_PRODUCTS } from '../products/headphones';
import { SPEAKER_PRODUCTS } from '../products/speakers';
import type { ExtractedSignals } from '../signal-types';

/**
 * REC-1 (Final pre-beta mission, 2026-08-12) — an explicitly requested
 * product category constrains the recommendation set.
 *
 * Founder observation, reproduced exactly on production 8988c23:
 *   "Recommend some in-ear monitors" → "WHAT ACTUALLY MATTERS WHEN
 *   CHOOSING SPEAKERS" + Harbeth P3ESR / DeVore O/93 / Harbeth SHL5+
 *   loudspeaker cards. ("I want some IEMs" reached the headphone family
 *   but returned only over-ears: Susvara / 1995 Immanis / Empyrean II.)
 *
 * Root causes:
 *   1. "monitors" is a speaker keyword in four pattern sites and the
 *      "in-ear" qualifier never overrode it — category extraction is the
 *      first layer where IEM ceased to be authoritative.
 *   2. The headphone catalog carried nine genuine in-ears (Aria 2,
 *      ER2XR, Blessing 3, AONIC 3, IER-M7, AirPods Pro 2, Honeydew,
 *      Andromeda, Solaris) all tagged subcategory 'other' — form factor
 *      was not modeled, so selection could not constrain to it.
 *
 * Invariant: explicit category wins over catalog availability. If
 * coverage were insufficient the honest answer is an empty/degraded set,
 * never a silent substitution of a stronger-covered category.
 */

const EMPTY: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

function answerFor(text: string) {
  const ctx = detectShoppingIntent(text, EMPTY, [], text);
  const reasoning = reason(text, extractDesires(text), EMPTY, null, ctx, undefined);
  return { ctx, answer: buildShoppingAnswer(ctx, EMPTY, undefined, reasoning, []) };
}

const IEM_NAMES = new Set(
  (HEADPHONE_PRODUCTS as Array<{ name: string; subcategory?: string }>)
    .filter((p) => p.subcategory === 'iem')
    .map((p) => p.name),
);
const SPEAKER_NAMES = new Set((SPEAKER_PRODUCTS as Array<{ name: string }>).map((p) => p.name));

describe('IEM catalog form factor is modeled', () => {
  it('the catalog carries at least 5 IEM-tagged headphone products', () => {
    expect(IEM_NAMES.size).toBeGreaterThanOrEqual(5);
  });
});

describe('explicit IEM requests stay in the IEM form factor', () => {
  const IEM_QUERIES = [
    'I want some IEMs',
    'Recommend some in-ear monitors',
    'What IEMs should I buy?',
  ];
  for (const q of IEM_QUERIES) {
    it(`"${q}" resolves headphone category and returns only IEMs`, () => {
      const { ctx, answer } = answerFor(q);
      expect(ctx.category).toBe('headphone');
      expect(answer.productExamples.length).toBeGreaterThan(0);
      for (const ex of answer.productExamples) {
        // Display names may carry a form-factor suffix ("Solaris [IEM]");
        // compare against the catalog name with suffixes stripped.
        const base = ex.name.replace(/\s*\[[^\]]+\]\s*$/, '');
        expect(SPEAKER_NAMES.has(base), `speaker card leaked: ${ex.name}`).toBe(false);
        expect(IEM_NAMES.has(base), `non-IEM headphone leaked: ${ex.name}`).toBe(true);
      }
    });
  }
});

describe('neighboring categories are unchanged (controls)', () => {
  it('"I need headphones" stays headphone and never emits speakers', () => {
    const { ctx, answer } = answerFor('I need headphones under 500');
    expect(ctx.category).toBe('headphone');
    for (const ex of answer.productExamples) {
      expect(SPEAKER_NAMES.has(ex.name.replace(/\s*\[[^\]]+\]\s*$/, ''))).toBe(false);
    }
  });

  it('"Recommend speakers" stays speaker', () => {
    const { ctx, answer } = answerFor('Recommend speakers');
    expect(ctx.category).toBe('speaker');
    expect(answer.productExamples.length).toBeGreaterThan(0);
    for (const ex of answer.productExamples) {
      expect(SPEAKER_NAMES.has(ex.name)).toBe(true);
    }
  });

  it('amplifier control: "recommend an integrated amp" stays amplifier', () => {
    const { ctx } = answerFor('recommend an integrated amp');
    expect(ctx.category).toBe('amplifier');
  });

  it('DAC control: "recommend a dac" stays dac', () => {
    const { ctx } = answerFor('recommend a dac under 1000');
    expect(ctx.category).toBe('dac');
  });

  it('weak/unknown category degrades to general, not a substituted category', () => {
    const { ctx } = answerFor('recommend something nice');
    expect(ctx.category).toBe('general');
  });
});
